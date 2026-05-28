"""
Chatbot Backend Server — FastAPI application.

Exposes HTTP endpoints for the Next.js frontend to interact with
the Phase 2→5 resume processing pipeline via conversational chat.

All heavy work (PDF parse, OCR, LLM) is dispatched to Celery workers
via Redis. Endpoints return job_id for async polling.

Endpoints:
    POST /api/chat             — Main conversational interface
    POST /api/upload           — Upload + process a resume (Phase 2→4)
    POST /api/task/{t}         — Direct task execution (Phase 5)
    GET  /api/job/{job_id}     — Poll job status
    GET  /api/health           — System health check
"""

from __future__ import annotations

import logging
import os
import tempfile
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from intent_router import IntentRouter
from response_formatter import ResponseFormatter
from session_store import SessionStore
from job_tracker import JobTracker
from worker_tasks import task_process_resume, task_execute_rag, task_general_chat, task_extract_kie
from pipeline_bridge import check_health

# ── Logging ──────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("chatbot-server")

# ── App Setup ────────────────────────────────────────────

app = FastAPI(
    title="CareerIntel Chatbot API",
    description="Backend server connecting the Phase 2→5 pipeline to the chatbot frontend.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared Instances ─────────────────────────────────────

router = IntentRouter()
formatter = ResponseFormatter()
sessions = SessionStore()
jobs = JobTracker()


@app.on_event("startup")
async def startup():
    """Connect to Redis on startup."""
    await sessions.connect()
    await jobs.connect()
    logger.info("Redis connections established")


@app.on_event("shutdown")
async def shutdown():
    """Close Redis connections on shutdown."""
    await sessions.close()
    await jobs.close()
    logger.info("Redis connections closed")


# ── Request/Response Models ──────────────────────────────

class ChatRequest(BaseModel):
    """Chat message request."""
    message: str = Field(..., description="User's text message")
    session_id: Optional[str] = Field(None, description="Session ID for resume context")
    history: list[dict] = Field(default_factory=list, description="Chat history")


class ChatResponse(BaseModel):
    """Chat response envelope."""
    response: str = Field("", description="AI response text (markdown)")
    task_type: str = Field("general", description="Detected intent type")
    session_id: str = Field(..., description="Session ID")
    job_id: Optional[str] = Field(None, description="Job ID for async polling")
    metadata: dict = Field(default_factory=dict, description="Processing metadata")


class UploadResponse(BaseModel):
    """Resume upload response."""
    success: bool
    job_id: Optional[str] = None
    session_id: str = ""
    message: str = ""
    error: str = ""


class JobStatusResponse(BaseModel):
    """Job status polling response."""
    job_id: str
    status: str  # PENDING, PROCESSING, COMPLETED, FAILED
    job_type: str = ""
    result: dict = Field(default_factory=dict)
    error: str = ""


class TaskRequest(BaseModel):
    """Direct task execution request."""
    resume_id: Optional[str] = None
    resume_json: Optional[dict] = None
    session_id: Optional[str] = None
    target_role: Optional[str] = None
    generate_roadmap: bool = False


class TaskResponse(BaseModel):
    """Task execution response."""
    success: bool
    task_type: str
    job_id: Optional[str] = None
    response: str = ""
    raw_result: dict = Field(default_factory=dict)
    error: str = ""
    metadata: dict = Field(default_factory=dict)


class HealthResponse(BaseModel):
    """System health response."""
    status: str
    llm_available: bool = False
    llm_url: str = ""
    llm_model: str = ""
    qdrant_available: bool = False
    qdrant_resume_count: int = 0
    error: str = ""


# ── Endpoints ────────────────────────────────────────────

@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    """Main conversational chat endpoint.

    Classifies the user's intent, routes to the appropriate Phase 5
    task or general LLM chat. Heavy tasks are dispatched to Celery
    workers and return a job_id for async polling.
    """
    session_id = await sessions.create(req.session_id)
    resume_id, resume_dict = await sessions.get_resume(session_id)
    has_resume = resume_id is not None or resume_dict is not None

    # Classify intent
    intent = router.classify(req.message, has_resume=has_resume)
    logger.info(f"Intent: {intent.intent} (confidence={intent.confidence:.2f})")

    # Route to appropriate handler
    if intent.intent in ("assess", "match", "interview") and has_resume:
        # Dispatch Phase 5 task to Celery (medium queue)
        target_role = intent.task_params.get("target_role")
        generate_roadmap = intent.task_params.get("generate_roadmap", False)

        if intent.intent == "interview" and not target_role:
            target_role = "Software Engineer"

        celery_result = task_execute_rag.delay(
            task_type=intent.intent,
            resume_id=resume_id,
            resume_dict=resume_dict,
            target_role=target_role,
            generate_roadmap=generate_roadmap,
        )

        job_id = await jobs.create_job(
            session_id=session_id,
            job_type=intent.intent,
            celery_task_id=celery_result.id,
        )

        return ChatResponse(
            response="⏳ Đang xử lý yêu cầu của bạn...",
            task_type=intent.intent,
            session_id=session_id,
            job_id=job_id,
        )

    elif intent.intent in ("assess", "match", "interview") and not has_resume:
        # User wants a task but hasn't uploaded a resume
        return ChatResponse(
            response=(
                "📎 **Bạn chưa tải lên CV!**\n\n"
                "Để tôi có thể đánh giá, vui lòng tải lên file CV (PDF hoặc DOCX) "
                "bằng cách nhấn nút **+** bên trái ô nhập tin nhắn.\n\n"
                "Sau khi tải lên, bạn có thể yêu cầu:\n"
                '- *"Đánh giá CV của tôi"*\n'
                '- *"Tạo câu hỏi phỏng vấn"*\n'
                '- *"Tìm việc phù hợp"*'
            ),
            task_type="no_resume",
            session_id=session_id,
        )

    else:
        # General LLM chat — dispatch to Celery (light queue)
        celery_result = task_general_chat.delay(req.message, req.history)

        job_id = await jobs.create_job(
            session_id=session_id,
            job_type="chat",
            celery_task_id=celery_result.id,
        )

        return ChatResponse(
            response="⏳ Đang trả lời...",
            task_type="general",
            session_id=session_id,
            job_id=job_id,
        )


@app.post("/api/upload", response_model=UploadResponse)
async def upload_endpoint(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
):
    """Upload and process a resume through Phase 2→4.

    Accepts PDF or DOCX files. Saves to a temp file and dispatches
    to the heavy Celery queue. Returns job_id for status polling.
    """
    # Validate file type
    allowed_extensions = {".pdf", ".docx", ".doc", ".png", ".jpg", ".jpeg"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {ext}. Allowed: {', '.join(allowed_extensions)}"
        )

    # Read file
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    if len(file_bytes) > 20 * 1024 * 1024:  # 20MB limit
        raise HTTPException(status_code=400, detail="File too large (max 20MB)")

    sid = await sessions.create(session_id)
    logger.info(f"Upload: {file.filename} ({len(file_bytes)} bytes) session={sid}")

    # Save to temp file (Celery worker needs file path)
    suffix = os.path.splitext(file.filename or "")[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix="chatbot_")
    tmp.write(file_bytes)
    tmp.flush()
    tmp.close()

    # Dispatch to Celery heavy queue
    celery_result = task_process_resume.delay(
        file_path=tmp.name,
        filename=file.filename,
    )

    job_id = await jobs.create_job(
        session_id=sid,
        job_type="upload",
        celery_task_id=celery_result.id,
    )

    return UploadResponse(
        success=True,
        job_id=job_id,
        session_id=sid,
        message="📤 CV đang được xử lý. Vui lòng chờ...",
    )


@app.post("/api/kie", response_model=UploadResponse)
async def kie_endpoint(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(None),
):
    """Upload and process a resume for KIE (Key Information Extraction).
    
    Accepts PDF files, dispatches to heavy queue, returns job_id.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty file")

    sid = await sessions.create(session_id)
    
    # Save to temp file
    suffix = os.path.splitext(file.filename or "")[1]
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, prefix="kie_")
    tmp.write(file_bytes)
    tmp.flush()
    tmp.close()

    # Dispatch to Celery heavy queue
    celery_result = task_extract_kie.delay(
        file_path=tmp.name,
        filename=file.filename,
    )

    job_id = await jobs.create_job(
        session_id=sid,
        job_type="kie",
        celery_task_id=celery_result.id,
    )

    return UploadResponse(
        success=True,
        job_id=job_id,
        session_id=sid,
        message="KIE job queued",
    )


@app.get("/api/job/{job_id}", response_model=JobStatusResponse)
async def job_status_endpoint(job_id: str):
    """Poll the status of an async job.

    Frontend calls this every 2s until status is COMPLETED or FAILED.
    When a resume upload job completes, the result is automatically
    stored in the user's session.
    """
    job = await jobs.get_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    # If still pending/processing, check Celery for real-time status
    if job["status"] in ("PENDING", "PROCESSING"):
        from celery.result import AsyncResult
        from celery_app import app as celery_app

        celery_task_id = (await jobs._redis.hget(f"job:{job_id}", "celery_task_id")) or ""
        if celery_task_id:
            async_result = AsyncResult(celery_task_id, app=celery_app)

            if async_result.ready():
                # Task finished — update job tracker
                try:
                    result = async_result.get(timeout=5)
                    if isinstance(result, dict) and result.get("success"):
                        await jobs.update_status(job_id, "COMPLETED", result=result)

                        # If upload job, store resume in session
                        if job["job_type"] == "upload" and result.get("resume_id"):
                            await sessions.set_resume(
                                session_id=job["session_id"],
                                resume_id=result["resume_id"],
                                resume_dict=result.get("resume_dict", {}),
                                resume_name=result.get("resume_name", ""),
                            )

                        job["status"] = "COMPLETED"
                        job["result"] = result
                    else:
                        error = result.get("error", "Unknown error") if isinstance(result, dict) else str(result)
                        await jobs.update_status(job_id, "FAILED", error=error)
                        job["status"] = "FAILED"
                        job["error"] = error
                except Exception as e:
                    await jobs.update_status(job_id, "FAILED", error=str(e))
                    job["status"] = "FAILED"
                    job["error"] = str(e)

            elif async_result.state == "PROCESSING":
                await jobs.update_status(job_id, "PROCESSING")
                job["status"] = "PROCESSING"

    return JobStatusResponse(
        job_id=job["job_id"],
        status=job["status"],
        job_type=job.get("job_type", ""),
        result=job.get("result", {}),
        error=job.get("error", ""),
    )


@app.post("/api/task/{task_type}", response_model=TaskResponse)
async def task_endpoint(task_type: str, req: TaskRequest):
    """Execute a specific Phase 5 task directly.

    Dispatches to Celery medium queue and returns job_id.
    """
    valid_tasks = {"assess", "match", "interview"}
    if task_type not in valid_tasks:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid task_type: {task_type}. Valid: {valid_tasks}"
        )

    # Get resume from session if needed
    resume_id = req.resume_id
    resume_dict = req.resume_json
    if not resume_id and not resume_dict and req.session_id:
        rid, rdict = await sessions.get_resume(req.session_id)
        resume_id = resume_id or rid
        resume_dict = resume_dict or rdict

    if not resume_id and not resume_dict:
        raise HTTPException(
            status_code=400,
            detail="No resume provided. Upload a resume first or provide resume_id/resume_json."
        )

    sid = await sessions.create(req.session_id)

    # Dispatch to Celery
    celery_result = task_execute_rag.delay(
        task_type=task_type,
        resume_id=resume_id,
        resume_dict=resume_dict,
        target_role=req.target_role,
        generate_roadmap=req.generate_roadmap,
    )

    job_id = await jobs.create_job(
        session_id=sid,
        job_type=task_type,
        celery_task_id=celery_result.id,
    )

    return TaskResponse(
        success=True,
        task_type=task_type,
        job_id=job_id,
        response="⏳ Đang xử lý...",
    )


@app.get("/api/health", response_model=HealthResponse)
async def health_endpoint():
    """Check system health: LLM and Qdrant connectivity."""
    try:
        health = await check_health()
        return HealthResponse(
            status="ok" if health.get("llm_available") else "degraded",
            llm_available=health.get("llm_available", False),
            llm_url=health.get("llm_url", ""),
            llm_model=health.get("llm_model", ""),
            qdrant_available=health.get("qdrant_available", False),
            qdrant_resume_count=health.get("qdrant_resume_count", 0),
        )
    except Exception as e:
        return HealthResponse(
            status="error",
            error=str(e),
        )


@app.get("/")
async def root():
    """Root endpoint — API info."""
    return {
        "name": "CareerIntel Chatbot API",
        "version": "2.0.0",
        "endpoints": [
            "POST /api/chat",
            "POST /api/upload",
            "POST /api/task/{task_type}",
            "GET /api/job/{job_id}",
            "GET /api/health",
        ],
    }
