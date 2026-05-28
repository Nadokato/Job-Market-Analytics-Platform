"""
Celery Worker Tasks — Async wrappers around pipeline phases.

Each task runs in a Celery worker process, offloading heavy
PDF/OCR/ML work from the FastAPI event loop.
"""

from __future__ import annotations

import logging
import os
import tempfile
import time
from typing import Optional

from celery_app import app

logger = logging.getLogger(__name__)

# ── Path setup (same as pipeline_bridge) ─────────────────
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.abspath(os.path.join(_THIS_DIR, "..", ".."))
_CHATBOT_ROOT = os.path.join(_PROJECT_ROOT, "chatbot")

# Ensure pipeline_bridge is importable
import sys
if _THIS_DIR not in sys.path:
    sys.path.insert(0, _THIS_DIR)


@app.task(bind=True, name="worker_tasks.task_process_resume", max_retries=1)
def task_process_resume(
    self,
    file_path: str,
    filename: str,
    db_path: Optional[str] = None,
) -> dict:
    """Process a resume through Phase 2→4 pipeline.

    Runs in the 'heavy' queue. Handles PDF parsing, OCR,
    semantic chunking, validation, and Qdrant storage.

    Args:
        file_path: Path to the temporary uploaded file.
        filename: Original filename for format detection.
        db_path: Qdrant database path.

    Returns:
        Serializable dict with resume_id, quality_score, etc.
    """
    from pipeline_bridge import _run_full_pipeline, DEFAULT_DB_PATH

    db = db_path or DEFAULT_DB_PATH
    logger.info(f"[heavy] Processing resume: {filename}")

    # Update task state to PROCESSING
    self.update_state(state="PROCESSING", meta={"filename": filename, "phase": "starting"})

    t0 = time.time()
    try:
        result = _run_full_pipeline(file_path, db)
        elapsed = round(time.time() - t0, 2)

        if result.success:
            return {
                "success": True,
                "resume_id": result.resume_id,
                "resume_name": result.resume_name,
                "quality_score": result.quality_score,
                "is_valid": result.is_valid,
                "resume_dict": result.resume_dict,
                "processing_time_s": elapsed,
            }
        else:
            return {
                "success": False,
                "error": result.error,
                "processing_time_s": elapsed,
            }
    except Exception as exc:
        logger.exception(f"Resume processing failed: {exc}")
        # Retry once after 10 seconds
        raise self.retry(exc=exc, countdown=10)
    finally:
        # Clean up temp file
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
        except OSError:
            pass


@app.task(bind=True, name="worker_tasks.task_execute_rag", max_retries=1)
def task_execute_rag(
    self,
    task_type: str,
    resume_id: Optional[str] = None,
    resume_dict: Optional[dict] = None,
    db_path: Optional[str] = None,
    target_role: Optional[str] = None,
    generate_roadmap: bool = False,
) -> dict:
    """Execute a Phase 5 RAG task (assess/match/interview).

    Runs in the 'medium' queue. Calls LLM for analysis.

    Args:
        task_type: One of 'assess', 'match', 'interview'.
        resume_id: Qdrant point ID.
        resume_dict: Inline resume dict (alternative to resume_id).
        db_path: Qdrant database path.
        target_role: Target role for interview/roadmap.
        generate_roadmap: Whether to include study roadmap.

    Returns:
        Serializable dict with task result.
    """
    from pipeline_bridge import _run_phase5_task, DEFAULT_DB_PATH

    db = db_path or DEFAULT_DB_PATH
    logger.info(f"[medium] Executing RAG task: {task_type}")

    self.update_state(state="PROCESSING", meta={"task_type": task_type})

    try:
        raw = _run_phase5_task(
            task_type=task_type,
            resume_id=resume_id,
            resume_dict=resume_dict,
            db_path=db,
            target_role=target_role,
            generate_roadmap=generate_roadmap,
        )
        return {
            "success": raw.get("success", False),
            "task_type": raw.get("task_type", task_type),
            "result": raw.get("result", {}),
            "error": raw.get("error", ""),
            "metadata": raw.get("metadata", {}),
        }
    except Exception as exc:
        logger.exception(f"RAG task failed: {exc}")
        raise self.retry(exc=exc, countdown=5)


@app.task(name="worker_tasks.task_general_chat")
def task_general_chat(message: str, history: Optional[list] = None) -> dict:
    """Handle general LLM chat (no RAG).

    Runs in the 'light' queue. Fast turnaround.

    Args:
        message: User's chat message.
        history: Previous chat history.

    Returns:
        Dict with response text.
    """
    from pipeline_bridge import _general_chat

    logger.info("[light] General chat")

    try:
        response = _general_chat(message, history)
        return {"success": True, "response": response}
    except Exception as exc:
        logger.exception(f"General chat failed: {exc}")
        return {"success": False, "response": "", "error": str(exc)}

@app.task(bind=True, name="worker_tasks.task_extract_kie", max_retries=1)
def task_extract_kie(self, file_path: str, filename: str) -> dict:
    """Extract Key Information from a resume (KIE).
    
    Runs in the 'heavy' queue.
    """
    from pipeline_bridge import _extract_kie
    
    logger.info(f"[heavy] Extracting KIE from: {filename}")
    self.update_state(state="PROCESSING", meta={"filename": filename, "phase": "kie_extraction"})
    
    try:
        info = _extract_kie(file_path)
        return {
            "success": "error" not in info,
            "extracted_information": info,
            "pipeline": "PDF → parsing → regex → Python backend → JSON"
        }
    except Exception as exc:
        logger.exception(f"KIE extraction failed: {exc}")
        raise self.retry(exc=exc, countdown=10)
    finally:
        try:
            if os.path.exists(file_path):
                os.unlink(file_path)
        except OSError:
            pass

