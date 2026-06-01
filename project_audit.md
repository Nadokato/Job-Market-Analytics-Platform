# 🔍 Job-Market-Analytics-Platform — Full System Audit

> **Scope**: Entire project excluding `chatbot/` folder  
> **Date**: 2026-05-31  
> **Files analyzed**: ~60 source files across 7 subsystems  

---

## Executive Summary

The project is a **Next.js 16 + Supabase + Elasticsearch + Python ML** platform that scrapes Vietnamese job postings, normalizes them via a Gemini-powered pipeline, and serves them through a search UI with market insights. The architecture is ambitious and covers many real-world concerns (rate limiting, JWT blacklisting, deduplication, fallback pipelines). However, the audit uncovered **critical security issues**, **architectural dead code**, **data consistency gaps**, and several **system design weaknesses** that would cause problems in production.

### Severity Legend

| Icon | Meaning |
|------|---------|
| 🔴 | **CRITICAL** — Must fix before production/demo |
| 🟠 | **HIGH** — Significant risk, fix soon |
| 🟡 | **MEDIUM** — Weakness, plan to address |
| 🔵 | **LOW** — Code quality / DX improvement |

---

## 1. 🔴 Security — Leaked Secrets & Authentication Gaps

### 1.1 🔴 Secrets committed to Git

**File**: [.env.local](file:///d:/Job-Market-Analytics-Platform/.env.local)

The `.env.local` file contains **live API keys and service role keys** in the repository:

```
NEXT_PUBLIC_SUPABASE_URL=https://mdobkwikcixdompdfide.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
GROQ_API_KEY=gsk_ek2KAaj0pop2Mwk...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...
GEMINI_API_KEY=AIzaSyBpHr...
MONGODB_URI=mongodb://admin:secret_password_123@localhost:27017
```

> [!CAUTION]
> **The `.gitignore` does have `.env*.local` listed**, so these won't be committed to a *fresh* clone. However, the file currently **exists in the working tree** and was likely committed at some point in git history. The `SUPABASE_SERVICE_ROLE_KEY` grants **full admin access** to your database (bypasses RLS). If this was ever pushed to a public repo, **all keys must be rotated immediately**.

**Fix**: 
- Run `git log --all --diff-filter=A -- .env.local` to check if it was ever committed
- Rotate all keys if exposed
- Add `.env.local` to `.gitignore` (already done ✅) and use `git rm --cached .env.local` if still tracked

---

### 1.2 🟠 Fail-Open Security Pattern

**Files**: [redisSecurity.ts](file:///d:/Job-Market-Analytics-Platform/backend/lib/redisSecurity.ts#L63-L67), [redisSecurity.ts](file:///d:/Job-Market-Analytics-Platform/backend/lib/redisSecurity.ts#L110-L113)

Both `checkRateLimit` and `isTokenBlacklisted` use **fail-open** error handling:

```typescript
// Rate limiting — if Redis is down, let everyone through
catch (err) {
  return { success: true, count: 0 }; // Fail-open
}

// Blacklist check — if Redis is down, treat revoked tokens as valid
catch (err) {
  return false; // Fail-open
}
```

This means: **If Redis goes down, rate limiting and token blacklisting both stop working entirely.** An attacker could overwhelm the API or continue using revoked tokens.

**Fix**: For rate limiting, fail-open is acceptable (availability > security for search). But for `isTokenBlacklisted`, consider **fail-closed** (return `true` on Redis error) or at minimum log at `WARN` level and add alerting.

---

### 1.3 🔴 No Next.js Middleware — Routes Are Unprotected

**Finding**: No `middleware.ts` file exists at project root.

The project has [middleware.ts](file:///d:/Job-Market-Analytics-Platform/backend/supabase/middleware.ts) in `backend/supabase/`, but it's **never wired into Next.js**. The route protection code is **commented out** (lines 39-43):

```typescript
// if (!user && request.nextUrl.pathname.startsWith('/protected-route')) {
//   const url = request.nextUrl.clone()
//   url.pathname = '/login'
//   return NextResponse.redirect(url)
// }
```

**Impact**: `/profile`, `/ai`, and all API routes are accessible without authentication at the middleware level. The only guard is the client-side `RequireLogin` component, which can be bypassed.

**Fix**: Create `middleware.ts` at project root, import `updateSession`, and protect sensitive routes like `/profile`, `/ai`, `/api/v1/*`.

---

### 1.4 🟡 Hardcoded JWT Secret in Dead Code

**File**: [server.js](file:///d:/Job-Market-Analytics-Platform/server.js#L18)

```javascript
const token = jwt.sign({ userId: newUser._id }, 'SECRET_KEY');
```

This file appears to be **legacy dead code** (uses Mongoose, bcrypt, Express — none of which are in `package.json`). But it contains a hardcoded JWT secret. If anyone copies this pattern, it's a vulnerability.

**Fix**: Delete `server.js` entirely — it's dead code.

---

## 2. 🟠 Architecture — Dead Code & Dual Systems

### 2.1 🟠 Two Competing Task Queue Systems

The project has **two completely separate** task queue systems doing similar things:

| System | Location | Tech | Purpose |
|--------|----------|------|---------|
| **BullMQ** | [backend/jobs/](file:///d:/Job-Market-Analytics-Platform/backend/jobs) | BullMQ + Redis | Cron scraping, cleanup |
| **Celery** | [scraper/](file:///d:/Job-Market-Analytics-Platform/scraper) | Celery + Redis | Cron scraping (TopCV) |

The Celery-based scraper in `scraper/` is a **dead/stub implementation** — `tasks.py` contains dummy data and commented-out database calls. Yet it has its own `docker-compose.yml` with 4 worker services (including chatbot workers).

**Impact**: Confusion about which system is "real", wasted Docker resources, maintenance burden.

**Fix**: Delete the `scraper/` folder (Celery system) entirely. The BullMQ system in `backend/jobs/` is the active one. Move any useful scraper Docker config to the root `docker-compose.yml`.

---

### 2.2 🟡 Orphaned/Utility Files in Project Root

Several scratch/debug files sit in the project root with no clear purpose:

| File | Size | Purpose |
|------|------|---------|
| [check_html.js](file:///d:/Job-Market-Analytics-Platform/check_html.js) | 1.1 KB | Debug script |
| [check_html2.js](file:///d:/Job-Market-Analytics-Platform/check_html2.js) | 794 B | Debug script |
| [check_list_html.js](file:///d:/Job-Market-Analytics-Platform/check_list_html.js) | 922 B | Debug script |
| [check_page.js](file:///d:/Job-Market-Analytics-Platform/check_page.js) | 648 B | Debug script |
| [find_duplicates.ts](file:///d:/Job-Market-Analytics-Platform/find_duplicates.ts) | 4.3 KB | One-off utility |
| [scratch_test.ts](file:///d:/Job-Market-Analytics-Platform/scratch_test.ts) | 1.5 KB | Test scratch |
| [server.js](file:///d:/Job-Market-Analytics-Platform/server.js) | 704 B | Dead legacy code |
| [scraped_data.json](file:///d:/Job-Market-Analytics-Platform/scraped_data.json) | 680 KB | Test output data |

**Fix**: Move utilities to a `scripts/` directory or delete them. Add `scraped_data.json` to `.gitignore`.

---

### 2.3 🟡 Tightly Coupled Scraper — Single Source Dependency

The entire scraping pipeline is hardcoded to **JobOKO** (`vn.joboko.com`). The `scraper/` Celery system references TopCV but is a dummy. There's no scraper abstraction layer.

**Impact**: If JobOKO changes its HTML structure or blocks the scraper, the entire data pipeline stops. The 7-second delay between requests (line 477 of `scrap.ts`) and 5-page default limit are also arbitrary and not configurable.

**Fix**: Extract a `ScraperInterface` with site-specific implementations. Make `maxPages`, `delay`, and site URL configurable via environment variables.

---

### 2.4 🟠 ES Client Instantiated Multiple Times

**Files**: [backend/lib/elasticsearch.ts](file:///d:/Job-Market-Analytics-Platform/backend/lib/elasticsearch.ts) (singleton), [app/api/v1/jobs/search/route.ts](file:///d:/Job-Market-Analytics-Platform/app/api/v1/jobs/search/route.ts#L5-L7) (new instance), [app/api/v1/jobs/options/route.ts](file:///d:/Job-Market-Analytics-Platform/app/api/v1/jobs/options/route.ts#L4-L6) (new instance)

The API routes create **their own ES client instances** instead of using the shared singleton from `backend/lib/elasticsearch.ts`. This can lead to connection pool exhaustion in production.

**Fix**: Import `elasticClient` from `@/backend/lib/elasticsearch` in all API routes.

---

## 3. 🟠 Data Layer — Schema Drift & Consistency Gaps

### 3.1 🟠 Supabase ↔ Elasticsearch Data Drift

The ES sync script ([sync.ts](file:///d:/Job-Market-Analytics-Platform/backend/elasticsearch/sync.ts)) is a **manual one-shot script** (`npm run es:sync`). It's not part of the GitHub Actions pipeline or any automated process.

**Impact**: After each scrape cycle (every 3 days via GitHub Actions), the Supabase data is updated but **Elasticsearch is never re-synced**. Users searching via the UI see **stale data** until someone manually runs `npm run es:sync`.

**Fix**: Add `npm run es:sync` as a step in [scrape.yml](file:///d:/Job-Market-Analytics-Platform/.github/workflows/scrape.yml) after normalization, or implement real-time sync via Supabase webhooks/triggers.

---

### 3.2 🟡 Dual Upsert Strategy — `url` vs `job_hash_id`

The ML pipeline generates a `job_hash_id` (SHA-256 of company+title+location+month) for deduplication, but:

- [phase4_upsert.py](file:///d:/Job-Market-Analytics-Platform/python-ml-service/pipeline/phase4_upsert.py#L34) upserts on `url` conflict, not `job_hash_id`
- [queue.ts](file:///d:/Job-Market-Analytics-Platform/backend/jobs/queue.ts#L30) upserts on `url` conflict
- [github_action.ts](file:///d:/Job-Market-Analytics-Platform/backend/jobs/github_action.ts#L66) upserts on `url` conflict

The `job_hash_id` is computed and stored but **never used as a conflict key**. The cross-site dedup it was designed for doesn't work.

**Fix**: Decide on one strategy. If cross-site dedup is needed, upsert on `job_hash_id`. If single-source (JobOKO only), `url` is sufficient and `job_hash_id` can be removed.

---

### 3.3 🟡 Profile Data Stored in Auth Metadata (Anti-Pattern)

**File**: [actions.ts](file:///d:/Job-Market-Analytics-Platform/backend/auth/actions.ts#L103-L152)

User profile data (experiences, educations, skills) is stored in Supabase `auth.users.user_metadata`:

```typescript
export async function updateExperiences(experiences: any[]) {
  const { error } = await supabase.auth.updateUser({
    data: { experiences }  // Stored in user_metadata JSONB
  })
}
```

> [!WARNING]
> `user_metadata` is meant for lightweight preferences, not structured domain data. It has **no indexing, no relational queries, no size limits enforcement**, and is returned with **every auth call** (bloating JWT tokens). As profiles grow with dozens of experiences/skills, auth calls become heavy.

**Fix**: Create proper `profiles`, `experiences`, `educations`, `skills` tables in Supabase with foreign keys to `auth.users.id`.

---

### 3.4 🟡 No Input Validation on Server Actions

**File**: [actions.ts](file:///d:/Job-Market-Analytics-Platform/backend/auth/actions.ts)

- `login()` and `signup()` do basic null checks but no email format validation, password strength validation, or input sanitization
- `updateProfile()`, `updateExperiences()`, `updateEducations()`, `updateSkills()` accept **raw `any[]`** data with zero validation
- No Zod, yup, or any schema validation

**Fix**: Add Zod schemas for all server action inputs. Enforce password minimum length, email format, and array item shape validation.

---

## 4. 🟡 Scraping Pipeline — Fragility & Efficiency

### 4.1 🟡 New Browser Per `checkJobExists` Call

**File**: [scrap.ts](file:///d:/Job-Market-Analytics-Platform/backend/scrap/scrap.ts#L493-L521)

```typescript
export async function checkJobExists(url: string): Promise<boolean> {
  const browser = await chromium.launch({ headless: true });
  // ...
  await browser.close();
}
```

This function is called **for every N/A job** during cleanup. If there are 500 N/A jobs, it launches and destroys **500 browser instances**. In GitHub Actions with 2 vCPUs, this is extremely slow and resource-intensive.

**Fix**: Use a shared browser context, or better yet, use lightweight HTTP requests (`fetch` with `HEAD` method) to check if URLs are alive instead of full browser rendering.

---

### 4.2 🟡 No Retry/Backoff on Scrape Failures

**File**: [scrap.ts](file:///d:/Job-Market-Analytics-Platform/backend/scrap/scrap.ts#L468-L472)

Individual job detail scraping failures are caught and logged, but there's **no retry mechanism**. If a job page times out once (common with Vietnamese hosting), that data is permanently lost for that scrape cycle.

**Fix**: Add exponential backoff retry (2-3 attempts) for detail page scraping.

---

### 4.3 🟡 Location Normalization Is Incomplete

**File**: [scrap.ts](file:///d:/Job-Market-Analytics-Platform/backend/scrap/scrap.ts#L74-L84) vs [helpers.ts](file:///d:/Job-Market-Analytics-Platform/backend/elasticsearch/helpers.ts#L10-L24)

The `normalizeLocation` function in `scrap.ts` only matches ~15 cities, while `CITY_PATTERNS` in `helpers.ts` has 63+ patterns. This means:

- Scraper extracts location → loses some city data (returns `null`)
- ES sync correctly splits locations with the full list

**Fix**: Use a single shared city list across both files.

---

## 5. 🟡 ML Pipeline — Design Weaknesses

### 5.1 🟡 FastAPI and GitHub Actions Are Tightly Coupled Yet Disconnected

The system has **three ways** to process jobs:

1. **FastAPI online** ([main.py](file:///d:/Job-Market-Analytics-Platform/python-ml-service/main.py)) — full Gemini-powered pipeline
2. **GitHub Actions fallback** ([github_action.ts](file:///d:/Job-Market-Analytics-Platform/backend/jobs/github_action.ts#L36)) — tries FastAPI, falls back to raw upsert
3. **Offline normalization** ([fix_khac_offline.py](file:///d:/Job-Market-Analytics-Platform/python-ml-service/fix_khac_offline.py)) — batch re-normalizes missed records

In the GitHub Actions workflow, FastAPI is **never started** — step 5 runs the scraper which tries `http://127.0.0.1:8000` and always falls back. This is by design (the fallback saves raw data, then step 6 normalizes offline), but it's confusing and means the FastAPI code path is effectively dead in CI.

**Fix**: Either start FastAPI in GitHub Actions, or remove the FastAPI call attempt from `github_action.ts` and go directly to raw upsert + offline normalization.

---

### 5.2 🟡 No Gemini Rate Limit Throttling

**File**: [phase2_semantic.py](file:///d:/Job-Market-Analytics-Platform/python-ml-service/pipeline/phase2_semantic.py#L166-L191)

When processing jobs in batch (via `fix_khac_offline.py`), the pipeline calls Gemini for **every single job** with no throttling. After ~15 requests/minute on free tier, all subsequent calls fail with 429 and fall back to rule-based.

**Fix**: Add `time.sleep(1)` between Gemini calls or implement proper rate limiting with exponential backoff.

---

### 5.3 🔵 Hash Includes Month — Breaks Cross-Month Dedup

**File**: [phase3_hash.py](file:///d:/Job-Market-Analytics-Platform/python-ml-service/pipeline/phase3_hash.py#L17-L19)

```python
current_month = datetime.now().strftime("%Y-%m")
unique_string += f"|{current_month}"
```

The same job posted across months gets different hashes, defeating cross-month deduplication. If the intent is to allow re-posting, this should be documented.

---

## 6. 🟠 DevOps & Infrastructure

### 6.1 🟠 Docker Compose Has No Health Checks

**File**: [docker-compose.yml](file:///d:/Job-Market-Analytics-Platform/docker-compose.yml)

No `healthcheck` directives on any service. The `next-app` service `depends_on` Redis, MongoDB, and ES, but without health checks, the app can start before databases are ready.

**Fix**: Add health checks:
```yaml
elasticsearch:
  healthcheck:
    test: ["CMD-SHELL", "curl -s http://localhost:9200/_cluster/health || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 5
```

---

### 6.2 🟠 Elasticsearch Sync Not in CI/CD Pipeline

As noted in §3.1, the GitHub Actions workflow scrapes and normalizes data in Supabase but **never syncs to Elasticsearch**. The search UI depends on ES data that can be days/weeks stale.

---

### 6.3 🟡 No Staging/Preview Environment

The system has no staging or preview deployment. Vercel preview deployments aren't configured. All testing happens against production Supabase and ES instances.

---

### 6.4 🟡 Redis Has No Authentication

**File**: [docker-compose.yml](file:///d:/Job-Market-Analytics-Platform/docker-compose.yml#L12)

```yaml
command: redis-server --appendonly yes
```

Redis runs without password protection. The BullMQ connection in [queue.ts](file:///d:/Job-Market-Analytics-Platform/backend/jobs/queue.ts#L7-L10) also hardcodes `localhost:6379` without using the `REDIS_URL` env var.

---

### 6.5 🔵 `version: '3.8'` Is Deprecated in Docker Compose v2

Minor: modern Docker Compose ignores the `version` field. Can be removed.

---

## 7. 🟡 Frontend & Developer Experience

### 7.1 🟡 Placeholder Metadata in Root Layout

**File**: [layout.tsx](file:///d:/Job-Market-Analytics-Platform/app/layout.tsx#L7-L10)

```typescript
export const metadata: Metadata = {
  title: 'Create Next App',
  description: 'Generated by create next app',
}
```

Still using Next.js scaffold defaults. This affects SEO, social sharing, and browser tabs.

---

### 7.2 🟡 Excessive `any` Types — No Type Safety

Found 10+ instances of `any` in backend code:

- `login(prevState: any, ...)` 
- `updateExperiences(experiences: any[])`
- `results: any[]` in scraper
- `toEsDoc(job: any)` in ES sync
- `user?: any` in Navbar props

**Fix**: Define proper TypeScript interfaces for `Job`, `UserProfile`, `Experience`, `Education`, `Skill`.

---

### 7.3 🟡 No Error Boundaries in Frontend

No React Error Boundaries detected. If the Market Insights page (23KB) or Job Search page (34KB) throws during render, the entire app crashes with a white screen.

---

### 7.4 🔵 Navbar Missing Mobile Menu

**File**: [Navbar.tsx](file:///d:/Job-Market-Analytics-Platform/frontend/components/Navbar.tsx)

Navigation links and auth buttons are wrapped in `hidden lg:flex`. On mobile/tablet, there's **no hamburger menu** — users can't navigate.

---

### 7.5 🔵 Typo in RequireLogin

**File**: [RequireLogin.tsx](file:///d:/Job-Market-Analytics-Platform/frontend/components/RequireLogin.tsx#L98)

```tsx
Login In  // Should be "Log In"
```

---

## 8. Summary Prioritized Action Items

| Priority | Issue | Section |
|----------|-------|---------|
| 🔴 P0 | Verify secrets not in git history, rotate if exposed | §1.1 |
| 🔴 P0 | Create Next.js middleware for route protection | §1.3 |
| 🟠 P1 | Add ES sync to GitHub Actions pipeline | §3.1, §6.2 |
| 🟠 P1 | Fix fail-closed for token blacklist | §1.2 |
| 🟠 P1 | Use shared ES client singleton | §2.4 |
| 🟠 P1 | Delete dead `scraper/` folder and `server.js` | §2.1, §1.4 |
| 🟠 P1 | Add Docker health checks | §6.1 |
| 🟡 P2 | Move profile data to proper tables | §3.3 |
| 🟡 P2 | Add Zod validation on server actions | §3.4 |
| 🟡 P2 | Optimize `checkJobExists` (shared browser or HTTP) | §4.1 |
| 🟡 P2 | Resolve `url` vs `job_hash_id` upsert strategy | §3.2 |
| 🟡 P2 | Unify city pattern lists | §4.3 |
| 🟡 P2 | Add scrape retry/backoff | §4.2 |
| 🟡 P2 | Fix metadata in layout.tsx | §7.1 |
| 🟡 P2 | Add error boundaries | §7.3 |
| 🔵 P3 | Add TypeScript interfaces, remove `any` | §7.2 |
| 🔵 P3 | Add mobile navigation | §7.4 |
| 🔵 P3 | Clean up root-level scratch files | §2.2 |
| 🔵 P3 | Add Gemini rate limiting in batch pipeline | §5.2 |
