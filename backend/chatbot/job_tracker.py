"""
Job Tracker — Track async Celery jobs per user session.

Provides status polling for frontend to track long-running
ML tasks (PDF parse, OCR, RAG, etc.).

Status flow: PENDING → PROCESSING → COMPLETED | FAILED
"""

from __future__ import annotations

import json
import logging
import os
import uuid
import time
from typing import Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Job data expires after 1 hour
JOB_TTL = 3600

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


class JobTracker:
    """Redis-backed job tracker for async task status polling.

    Keys:
        job:{job_id} → hash with status, celery_task_id, result, etc.
        session:{session_id}:jobs → sorted set of job_ids by timestamp
    """

    def __init__(self, redis_url: str = REDIS_URL):
        self._redis: Optional[aioredis.Redis] = None
        self._redis_url = redis_url

    async def connect(self):
        """Initialize Redis connection."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url,
                encoding="utf-8",
                decode_responses=True,
            )

    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None

    def _job_key(self, job_id: str) -> str:
        return f"job:{job_id}"

    def _session_jobs_key(self, session_id: str) -> str:
        return f"session:{session_id}:jobs"

    async def create_job(
        self,
        session_id: str,
        job_type: str,
        celery_task_id: str,
    ) -> str:
        """Create a new job entry.

        Args:
            session_id: User session this job belongs to.
            job_type: Type of job (upload, assess, match, interview, chat).
            celery_task_id: The Celery AsyncResult task ID.

        Returns:
            A short job_id for frontend polling.
        """
        await self.connect()

        job_id = str(uuid.uuid4())[:12]
        now = time.time()

        job_data = {
            "job_id": job_id,
            "session_id": session_id,
            "job_type": job_type,
            "celery_task_id": celery_task_id,
            "status": "PENDING",
            "created_at": str(now),
            "result": "{}",
            "error": "",
        }

        await self._redis.hset(self._job_key(job_id), mapping=job_data)
        await self._redis.expire(self._job_key(job_id), JOB_TTL)

        # Add to session's job set
        await self._redis.zadd(self._session_jobs_key(session_id), {job_id: now})
        await self._redis.expire(self._session_jobs_key(session_id), JOB_TTL)

        logger.info(f"Job created: {job_id} (type={job_type}, celery={celery_task_id})")
        return job_id

    async def get_status(self, job_id: str) -> Optional[dict]:
        """Get job status and result.

        Returns:
            Dict with status, job_type, result, error,
            or None if job doesn't exist.
        """
        await self.connect()

        data = await self._redis.hgetall(self._job_key(job_id))
        if not data:
            return None

        # Parse result JSON
        result_str = data.get("result", "{}")
        try:
            result = json.loads(result_str) if result_str else {}
        except json.JSONDecodeError:
            result = {}

        return {
            "job_id": data.get("job_id", job_id),
            "session_id": data.get("session_id", ""),
            "job_type": data.get("job_type", ""),
            "status": data.get("status", "UNKNOWN"),
            "result": result,
            "error": data.get("error", ""),
            "created_at": data.get("created_at", ""),
        }

    async def update_status(
        self,
        job_id: str,
        status: str,
        result: Optional[dict] = None,
        error: str = "",
    ):
        """Update job status and optionally store result.

        Args:
            job_id: Job to update.
            status: New status (PROCESSING, COMPLETED, FAILED).
            result: Task result dict (for COMPLETED).
            error: Error message (for FAILED).
        """
        await self.connect()

        updates = {"status": status}
        if result is not None:
            updates["result"] = json.dumps(result, ensure_ascii=False, default=str)
        if error:
            updates["error"] = error

        await self._redis.hset(self._job_key(job_id), mapping=updates)
        logger.info(f"Job {job_id}: status → {status}")

    async def list_jobs(self, session_id: str, limit: int = 20) -> list[str]:
        """List recent job IDs for a session (newest first).

        Args:
            session_id: Session to list jobs for.
            limit: Max number of jobs to return.

        Returns:
            List of job_id strings.
        """
        await self.connect()
        # Get from sorted set, newest first
        job_ids = await self._redis.zrevrange(
            self._session_jobs_key(session_id), 0, limit - 1
        )
        return job_ids or []
