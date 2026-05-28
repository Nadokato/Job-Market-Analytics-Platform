"""
Celery Application — Async task queue for the chatbot backend.

Connects to Redis broker (shared with scraper service).
Defines 3 priority queues: heavy, medium, light.
"""

import os
from celery import Celery
from dotenv import load_dotenv

load_dotenv()

broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
result_backend = os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")

app = Celery(
    "chatbot",
    broker=broker_url,
    backend=result_backend,
    include=["worker_tasks"],
)

app.conf.update(
    # Results expire after 1 hour
    result_expires=3600,
    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    # Timezone
    timezone="Asia/Ho_Chi_Minh",
    enable_utc=True,
    # Queue routing
    task_routes={
        "worker_tasks.task_process_resume": {"queue": "heavy"},
        "worker_tasks.task_extract_kie": {"queue": "heavy"},
        "worker_tasks.task_execute_rag": {"queue": "medium"},
        "worker_tasks.task_general_chat": {"queue": "light"},
    },
    # Default queue for unrouted tasks
    task_default_queue="light",
    # Acknowledge after task completes (safer for heavy tasks)
    task_acks_late=True,
    # Only prefetch 1 task at a time per worker (prevents greedy workers)
    worker_prefetch_multiplier=1,
    # Soft time limit (seconds) — task gets SoftTimeLimitExceeded
    task_soft_time_limit=120,
    # Hard time limit — task gets killed
    task_time_limit=180,
)

if __name__ == "__main__":
    app.start()
