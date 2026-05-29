Please address the comments from this code review:

## Overall Comments
- The `backend/chatbot/Dockerfile` installs only `backend/chatbot/requirements.txt` but the Celery workers call into the Python pipeline under `/chatbot` (e.g. `docrag`, phase 2–5 modules), so you should also install that pipeline’s dependencies (e.g. by copying its requirements file and running `pip install -r`) or those imports will fail at runtime inside the worker containers.
- The new Next.js route `app/api/chatbot/status/[jobId]/route.ts` types `params` as `Promise<{ jobId: string }>` and then awaits it, but in the App Router `params` is passed as a plain object, so this should be changed to `{ params }: { params: { jobId: string } }` without `await` to avoid type/runtime issues.
- The file `apikey-scandocflow.txt` appears to contain a raw secret; please remove it from the repository (and rotate the key if valid) and load it via environment variables or a secret manager instead.

## Individual Comments

### Comment 1
<location path="backend/chatbot/server.py" line_range="291-283" />
<code_context>
+@app.post("/api/kie", response_model=UploadResponse)
</code_context>
<issue_to_address>
**🚨 issue (security):** KIE upload endpoint doesn’t validate file type/size, which is inconsistent with /api/upload and could allow unexpected inputs.

Since `/api/kie` writes the upload straight to disk and triggers heavy OCR/parse work, please apply the same (or stricter, e.g. PDF-only) extension and size checks as `/api/upload`, and reject empty, oversized, or unsupported files before queuing the task.
</issue_to_address>

### Comment 2
<location path="backend/chatbot/server.py" line_range="352" />
<code_context>
+        from celery.result import AsyncResult
+        from celery_app import app as celery_app
+
+        celery_task_id = (await jobs._redis.hget(f"job:{job_id}", "celery_task_id")) or ""
+        if celery_task_id:
+            async_result = AsyncResult(celery_task_id, app=celery_app)
</code_context>
<issue_to_address>
**suggestion:** Job status endpoint reaches into JobTracker’s private _redis field instead of using a public API.

`job_status_endpoint` currently reads `celery_task_id` via `jobs._redis.hget(...)`, which couples the endpoint to Redis internals and the key schema. To keep the FastAPI layer independent of storage details and make refactors safer, consider adding a `JobTracker` method (e.g., `get_celery_task_id(job_id)` or similar) and use that here instead of accessing `_redis` directly.

Suggested implementation:

```python
        from celery.result import AsyncResult
        from celery_app import app as celery_app

        celery_task_id = await jobs.get_celery_task_id(job_id)
        if celery_task_id:
            async_result = AsyncResult(celery_task_id, app=celery_app)

```

To fully implement this refactor, you should also:

1. Add a public method to the `JobTracker` class (wherever it is defined, e.g. `backend/chatbot/job_tracker.py`):

```python
class JobTracker:
    ...
    async def get_celery_task_id(self, job_id: str) -> str:
        """Return the Celery task ID for a given job, or an empty string if not set."""
        task_id = await self._redis.hget(f"job:{job_id}", "celery_task_id")
        return task_id or ""
```

2. Ensure `jobs` in `server.py` is an instance of this `JobTracker` class so that `jobs.get_celery_task_id(job_id)` is available.

These changes keep the FastAPI layer independent of Redis details and key schema, centralizing that knowledge inside `JobTracker`.
</issue_to_address>

### Comment 3
<location path="backend/chatbot/worker_tasks.py" line_range="31-40" />
<code_context>
+@app.task(bind=True, name="worker_tasks.task_process_resume", max_retries=1)
</code_context>
<issue_to_address>
**issue (bug_risk):** Temporary resume file is deleted even when the Celery task is retried, causing subsequent attempts to fail.

In `task_process_resume`, the `finally` block deletes `file_path` even when `self.retry` is raised. On retry, the same `file_path` is reused but the file is gone, so `_run_full_pipeline` will fail. Consider only deleting the file when you know there won’t be a retry (e.g., via a flag), or create and clean up the temp file entirely inside the Celery task so each retry uses a new copy.
</issue_to_address>

### Comment 4
<location path="app/api/kie/route.ts" line_range="28-37" />
<code_context>
+    const { job_id } = await uploadRes.json();
</code_context>
<issue_to_address>
**suggestion (performance):** KIE proxy hardcodes a long blocking poll in the API route, which can tie up server resources.

This route synchronously polls the job status in a loop (up to ~2 minutes), which is risky in serverless or low-concurrency environments. Prefer returning the `job_id` and having the client poll a lightweight status endpoint (as with the main chatbot), or at least make the poll interval and max attempts shorter and configurable.

Suggested implementation:

```typescript
    // Step 2: Poll for completion (configurable and shorter by default)
    const pollIntervalMs =
      typeof process.env.KIE_POLL_INTERVAL_MS === 'string'
        ? Number(process.env.KIE_POLL_INTERVAL_MS)
        : 1000; // 1s default
    const maxPollAttempts =
      typeof process.env.KIE_MAX_POLL_ATTEMPTS === 'string'
        ? Number(process.env.KIE_MAX_POLL_ATTEMPTS)
        : 15; // ~15s total default

    let attempts = 0;
    while (attempts < maxPollAttempts) {
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));

      const statusRes = await fetch(`${fastApiUrl}/api/job/${job_id}`);

```

To fully align with your comment (“prefer returning the job_id and having the client poll a lightweight status endpoint”), you will likely also:
1. Adjust this route’s response shape so that it directly returns `{ job_id }` (and possibly an initial status) without waiting for completion when the job is still running.
2. Update the client-side code to:
   - Handle the `job_id` returned by this route.
   - Poll a dedicated `/api/job/[job_id]` status endpoint until completion, similar to your main chatbot flow.
3. Optionally add validation/guards around `Number(process.env.KIE_POLL_INTERVAL_MS)` / `Number(process.env.KIE_MAX_POLL_ATTEMPTS)` to fall back to safe defaults if the env vars are misconfigured (e.g., NaN or <= 0).
</issue_to_address>

### Comment 5
<location path="memory-bank/activeContext.md" line_range="11" />
<code_context>
+* Next.js development server running on `http://localhost:3000`.
+* FastAPI chatbot backend running on `http://127.0.0.1:8000`.
+* Codebase successfully re-indexed using GitNexus (`2,503` nodes, `4,105` edges, `60` clusters, `103` flows).
+* Scraper Celery worker and Redis broker setup in `./scraper/` using Docker Compose. Ready for execution.
+- ✅ Replaced synchronous `ThreadPoolExecutor` with **Celery** workers.
+- ✅ Moved sessions to **Redis** (survives restarts).
</code_context>
<issue_to_address>
**suggestion (typo):** Use "set up" (verb) instead of "setup" (noun) in this sentence.

Since this describes how the worker and broker are configured, use the verb phrase "set up", e.g. "Scraper Celery worker and Redis broker set up in `./scraper/` using Docker Compose."

```suggestion
* Scraper Celery worker and Redis broker set up in `./scraper/` using Docker Compose. Ready for execution.
```
</issue_to_address>

### Comment 6
<location path="fix.md" line_range="69" />
<code_context>
++* [x] Launch development server (`npm run dev`)
++* [x] Launch chatbot backend (`uvicorn server:app --port 8000`)
++* [x] Index codebase with GitNexus and sync with Memory Bank
++* [x] Set up async scraper worker (Celery, Redis)
++* [x] Add ML async queue to FastAPI chatbot (Redis sessions, Celery workers, job polling)
++* [x] KIE Route migration to ML Async Queue (Python-based processing)
</code_context>
<issue_to_address>
**suggestion (typo):** Use "Set up" (verb) instead of "Setup" (noun) in this checklist item.

As an action item, this should be written as "Set up async scraper worker (Celery, Redis)".

```suggestion
* [x] Set up async scraper worker (Celery, Redis)
```
</issue_to_address>