"""
Pipeline Bridge — Adapter between FastAPI server and the chatbot pipeline phases.

Handles the sys.path switching, module imports, and provides clean async-safe
wrappers around Phase 2→5 pipeline runners. Runs pipeline work in a thread pool
to avoid blocking the FastAPI event loop.
"""

from __future__ import annotations


import io
import json
import logging
import os
import sys
import tempfile
import time

from dataclasses import dataclass, field, asdict
from typing import Optional

logger = logging.getLogger(__name__)

# ── Path Setup ───────────────────────────────────────────
# Resolve paths relative to this file → backend/chatbot/
# The chatbot phases live at: <project_root>/chatbot/phase X-*/
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_THIS_DIR, "..", ".."))
_CHATBOT_ROOT = os.path.join(_PROJECT_ROOT, "chatbot")

PHASE2_DIR = os.path.join(_CHATBOT_ROOT, "phase 2-parsing and layout")
PHASE3_DIR = os.path.join(_CHATBOT_ROOT, "phase 3-semantic chunking")
PHASE4_DIR = os.path.join(_CHATBOT_ROOT, "phase 4-validation and storage")
PHASE5_DIR = os.path.join(_CHATBOT_ROOT, "phase 5-rag and tasks")

ALL_PHASE_DIRS = [PHASE2_DIR, PHASE3_DIR, PHASE4_DIR, PHASE5_DIR]

# Default paths
DEFAULT_DB_PATH = os.path.join(_CHATBOT_ROOT, "data", "qdrant_db")
DEFAULT_LLM_URL = "http://localhost:11434/v1"
DEFAULT_MODEL = "qwen2.5:7b"

# NOTE: ThreadPoolExecutor removed. All heavy work now dispatched
# to Celery workers via worker_tasks.py. Sync runners below are
# called directly by Celery tasks.

# Force UTF-8 stdout on Windows
if sys.platform == "win32":
    if hasattr(sys.stdout, "buffer"):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    if hasattr(sys.stderr, "buffer"):
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


# ── Result Types ─────────────────────────────────────────

@dataclass
class ResumeProcessResult:
    """Result of processing a resume through Phase 2→4."""
    success: bool = False
    resume_id: Optional[str] = None
    resume_name: str = ""
    quality_score: float = 0.0
    is_valid: bool = False
    error: str = ""
    resume_dict: dict = field(default_factory=dict)
    processing_time_s: float = 0.0


@dataclass
class TaskResult:
    """Result of executing a Phase 5 task."""
    success: bool = False
    task_type: str = ""
    result: dict = field(default_factory=dict)
    error: str = ""
    metadata: dict = field(default_factory=dict)


@dataclass
class ChatResult:
    """Result of a full chat interaction."""
    success: bool = False
    response: str = ""
    task_type: str = "general"
    raw_result: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)


# ── Phase Switching (borrowed from run_pipeline.py) ──────

def _switch_phase(phase_dir: str):
    """Set sys.path so only the given phase dir is active (remove others)."""
    for d in ALL_PHASE_DIRS:
        if d in sys.path:
            sys.path.remove(d)
    sys.path.insert(0, phase_dir)
    # Phase 5 needs Phase 4 for vector_store and embedder
    if phase_dir == PHASE5_DIR:
        if PHASE4_DIR not in sys.path:
            sys.path.append(PHASE4_DIR)
    # Invalidate cached modules from other phases
    for mod_name in list(sys.modules.keys()):
        mod = sys.modules[mod_name]
        if hasattr(mod, "__file__") and mod.__file__:
            for d in ALL_PHASE_DIRS:
                if d == PHASE4_DIR and phase_dir == PHASE5_DIR:
                    if "vector_store" in mod_name or "embedder" in mod_name:
                        continue
                if d != phase_dir and mod.__file__.startswith(d):
                    del sys.modules[mod_name]
                    break


# ── Synchronous Pipeline Runners ─────────────────────────

def _run_phase2(file_path: str) -> dict:
    """Phase 2: Parse document + layout analysis."""
    _switch_phase(PHASE2_DIR)
    from docrag.pipeline import DocumentIngestionPipeline

    pipeline = DocumentIngestionPipeline(
        use_gpu=False,
        layout_method="rule_based",
    )
    result = pipeline.process(file_path, analyze_layout=True)
    return {"parsed": result["parsed"], "layout": result["layout"]}

import re
def _extract_kie(file_path: str) -> dict:
    """Lightweight Key Information Extraction for KIE route."""
    try:
        p2 = _run_phase2(file_path)
        text = p2.get("parsed", {}).get("text", "")
        if not text:
            # Fallback if text is in a different structure
            text = str(p2.get("parsed", ""))
            
        # Clean text
        text = re.sub(r'\s+', ' ', text).strip()
        
        # Simple extraction logic (similar to previous Next.js route)
        email_match = re.search(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b', text)
        email = email_match.group(0) if email_match else "Not found"
        
        phone_match = re.search(r'(\+?\d{1,3}[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})', text)
        phone = phone_match.group(0) if phone_match else "Not found"
        
        skills_keywords = ['javascript', 'python', 'java', 'react', 'node.js', 'sql', 'html', 'css']
        skills = [s for s in skills_keywords if s.lower() in text.lower()]
        
        exp_match = re.search(r'(\d+)\s+years?\s+of\s+experience', text, re.IGNORECASE)
        experience = exp_match.group(0) if exp_match else "Not found"
        
        edu_keywords = ['bachelor', 'master', 'phd', 'degree']
        education = [w for w in edu_keywords if w.lower() in text.lower()]
        education = ", ".join(education) if education else "Not found"
        
        # Very naive name extraction (first 2-3 words)
        words = text.split()
        name = " ".join(words[:2]) if words else "Not found"

        return {
            "name": name,
            "email": email,
            "phone": phone,
            "skills": skills,
            "experience": experience,
            "education": education
        }
    except Exception as e:
        logger.exception("KIE Extraction failed")
        return {"error": str(e)}



def _run_phase3_from_pdf(parsed_doc, layout_analysis) -> dict:
    """Phase 3: Semantic chunking from Phase 2 output."""
    _switch_phase(PHASE3_DIR)
    from pipeline import SemanticExtractionPipeline

    pipeline = SemanticExtractionPipeline(
        use_ner=False,
        use_llm=False,
    )
    resume = pipeline.process(parsed_doc, layout_analysis)
    return {"resume": resume}


def _run_phase4(canonical_resume, db_path: str) -> dict:
    """Phase 4: Validate + Embed + Store in Qdrant."""
    _switch_phase(PHASE4_DIR)
    from pipeline import ValidationStoragePipeline

    pipeline = ValidationStoragePipeline(
        use_embeddings=True,
        use_storage=True,
        embedding_device="cpu",
        db_path=db_path,
    )
    validated = pipeline.validate_and_store(canonical_resume)
    point_id = validated.embedding_ids[0] if validated.embedding_ids else None
    return {
        "validated": validated,
        "point_id": point_id,
    }


def _run_phase5_task(
    task_type: str,
    resume_id: Optional[str],
    resume_dict: Optional[dict],
    db_path: str,
    target_role: Optional[str] = None,
    generate_roadmap: bool = False,
) -> dict:
    """Phase 5: Execute a single RAG task."""
    _switch_phase(PHASE5_DIR)
    from pipeline import RAGTaskPipeline
    from schema import TaskRequest

    pipeline = RAGTaskPipeline(
        db_path=db_path,
        llm_base_url=DEFAULT_LLM_URL,
        model_name=DEFAULT_MODEL,
        embedding_device="cpu",
    )

    # Build request
    req_kwargs = {"task_type": task_type}
    if resume_id:
        req_kwargs["resume_id"] = resume_id
    elif resume_dict:
        req_kwargs["resume_json"] = resume_dict

    if target_role:
        req_kwargs["target_role"] = target_role
    if generate_roadmap:
        req_kwargs["generate_roadmap"] = True

    request = TaskRequest(**req_kwargs)
    response = pipeline.execute(request)

    return {
        "task_type": response.task_type,
        "success": response.success,
        "result": response.result.to_dict() if hasattr(response.result, "to_dict") else (response.result or {}),
        "error": response.error,
        "metadata": response.metadata,
    }


def _run_full_pipeline(file_path: str, db_path: str) -> ResumeProcessResult:
    """Run Phase 2 → 3 → 4 on a single file."""
    t0 = time.time()
    try:
        # Phase 2
        p2 = _run_phase2(file_path)

        # Phase 3
        p3 = _run_phase3_from_pdf(p2["parsed"], p2["layout"])
        resume = p3["resume"]

        # Phase 4
        p4 = _run_phase4(resume, db_path)
        validated = p4["validated"]

        name = resume.personal_info.name or os.path.basename(file_path)
        return ResumeProcessResult(
            success=True,
            resume_id=p4["point_id"],
            resume_name=name,
            quality_score=validated.quality_score.overall,
            is_valid=validated.validation_report.is_valid,
            resume_dict=resume.to_dict(),
            processing_time_s=round(time.time() - t0, 2),
        )
    except Exception as e:
        logger.exception("Pipeline failed")
        return ResumeProcessResult(
            success=False,
            error=str(e),
            processing_time_s=round(time.time() - t0, 2),
        )


def _check_llm_health() -> dict:
    """Check LLM and Qdrant availability."""
    _switch_phase(PHASE5_DIR)
    from pipeline import RAGTaskPipeline

    pipeline = RAGTaskPipeline(
        db_path=DEFAULT_DB_PATH,
        llm_base_url=DEFAULT_LLM_URL,
        model_name=DEFAULT_MODEL,
        embedding_device="cpu",
    )
    return pipeline.check_health()


def _general_chat(message: str, history: list[dict] = None) -> str:
    """Direct LLM chat for general questions (no RAG)."""
    _switch_phase(PHASE5_DIR)
    from llm_client import LLMClient

    client = LLMClient(
        base_url=DEFAULT_LLM_URL,
        model=DEFAULT_MODEL,
        temperature=0.7,
        max_tokens=2048,
    )

    system = (
        "Bạn là CareerIntel AI — trợ lý thông minh về thị trường việc làm Việt Nam. "
        "Bạn giúp tư vấn nghề nghiệp, phân tích xu hướng tuyển dụng, và hỗ trợ tìm việc. "
        "Trả lời bằng tiếng Việt, thân thiện và chuyên nghiệp. "
        "Sử dụng markdown để định dạng câu trả lời."
    )

    response = client.generate(
        system_prompt=system,
        user_prompt=message,
        json_mode=False,
    )
    return response.get("raw", response.get("content", "Xin lỗi, tôi không thể trả lời lúc này."))


# ── Async Wrapper (health only — lightweight, no Celery needed) ──

async def check_health() -> dict:
    """Check system health asynchronously.

    This is the only remaining async wrapper. All other heavy work
    is now dispatched to Celery workers via worker_tasks.py.
    """
    import asyncio
    loop = asyncio.get_event_loop()
    try:
        return await loop.run_in_executor(None, _check_llm_health)
    except Exception as e:
        return {"llm_available": False, "error": str(e)}
