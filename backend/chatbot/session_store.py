"""
Redis Session Store — Persistent session management.

Replaces the in-memory dict with Redis-backed sessions.
Sessions survive server restarts and work across multiple
FastAPI worker processes.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Session TTL: 24 hours
SESSION_TTL = 86400

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")


class SessionStore:
    """Redis-backed session store for chatbot user sessions.

    Keys: session:{session_id} → JSON hash with resume data.
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
            logger.info(f"SessionStore connected to Redis: {self._redis_url}")

    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None

    def _key(self, session_id: str) -> str:
        return f"session:{session_id}"

    async def create(self, session_id: Optional[str] = None) -> str:
        """Create a new session or return existing.

        Args:
            session_id: Optional existing session ID to reuse.

        Returns:
            The session ID (existing or newly created).
        """
        await self.connect()

        if session_id:
            exists = await self._redis.exists(self._key(session_id))
            if exists:
                # Refresh TTL
                await self._redis.expire(self._key(session_id), SESSION_TTL)
                return session_id

        new_id = str(uuid.uuid4())[:8]
        data = {
            "resume_id": "",
            "resume_dict": "{}",
            "resume_name": "",
        }
        await self._redis.hset(self._key(new_id), mapping=data)
        await self._redis.expire(self._key(new_id), SESSION_TTL)
        logger.info(f"Created session: {new_id}")
        return new_id

    async def get(self, session_id: str) -> Optional[dict]:
        """Get session data.

        Returns:
            Session dict with resume_id, resume_dict, resume_name,
            or None if session doesn't exist.
        """
        await self.connect()
        data = await self._redis.hgetall(self._key(session_id))
        if not data:
            return None

        # Parse resume_dict from JSON string
        resume_dict_str = data.get("resume_dict", "{}")
        try:
            resume_dict = json.loads(resume_dict_str) if resume_dict_str else {}
        except json.JSONDecodeError:
            resume_dict = {}

        return {
            "resume_id": data.get("resume_id") or None,
            "resume_dict": resume_dict or None,
            "resume_name": data.get("resume_name") or None,
        }

    async def get_resume(self, session_id: str) -> tuple[Optional[str], Optional[dict]]:
        """Get resume_id and resume_dict from session.

        Returns:
            Tuple of (resume_id, resume_dict). Both may be None.
        """
        session = await self.get(session_id)
        if not session:
            return None, None
        return session.get("resume_id"), session.get("resume_dict")

    async def set_resume(
        self,
        session_id: str,
        resume_id: str,
        resume_dict: dict,
        resume_name: str,
    ):
        """Store resume data in session.

        Args:
            session_id: Session to update.
            resume_id: Qdrant point ID.
            resume_dict: Parsed resume as dict.
            resume_name: Display name for the resume.
        """
        await self.connect()
        data = {
            "resume_id": resume_id or "",
            "resume_dict": json.dumps(resume_dict, ensure_ascii=False) if resume_dict else "{}",
            "resume_name": resume_name or "",
        }
        await self._redis.hset(self._key(session_id), mapping=data)
        await self._redis.expire(self._key(session_id), SESSION_TTL)
        logger.info(f"Session {session_id}: resume stored (id={resume_id})")

    async def delete(self, session_id: str):
        """Delete a session."""
        await self.connect()
        await self._redis.delete(self._key(session_id))
        logger.info(f"Session {session_id}: deleted")
