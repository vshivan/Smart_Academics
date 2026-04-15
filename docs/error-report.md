# SAAP — Error Report
**Generated:** April 15, 2026  
**Status:** 12 issues identified across 5 categories

---

## CRITICAL (Must fix before production)

---

### ERR-001 · Secret Key Not Set
**File:** `.env`  
**Severity:** 🔴 Critical — Security  

```env
SECRET_KEY=change-me-in-production-use-256-bit-random
```

**Problem:** The default `SECRET_KEY` is a hardcoded placeholder. Any JWT signed with this key can be forged by anyone who reads the `.env.example` file.

**Fix:**
```bash
# Generate a secure random key
python -c "import secrets; print(secrets.token_hex(32))"
# Paste the output into .env as SECRET_KEY=<output>
```

---

### ERR-002 · Google OAuth Credentials Not Configured
**File:** `.env`  
**Severity:** 🔴 Critical — App unusable without this  

```env
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**Problem:** Login is completely broken until real credentials are set. The `/auth/login` endpoint builds a Google OAuth URL with `client_id=your-google-client-id`, which Google rejects immediately.

**Fix:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials (Web application)
3. Add `http://localhost:8000/auth/callback` as an authorized redirect URI
4. Enable **Google Classroom API** and **Google Drive API**
5. Paste Client ID and Secret into `.env`

---

### ERR-003 · Celery Worker Cannot Find `evaluation_tasks` Module
**File:** `backend/workers/tasks.py` line 8  
**Severity:** 🔴 Critical — Celery worker crashes on startup  

```python
include=["syllabus_tasks", "evaluation_tasks"],  # evaluation_tasks does not exist
```

**Problem:** The worker tries to import `evaluation_tasks` but no such file exists anywhere in the codebase. The worker will fail to start with `ModuleNotFoundError`.

**Fix:** Remove the non-existent module from the include list:
```python
# backend/workers/tasks.py
celery_app = Celery(
    "saap_workers",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
    include=["syllabus_tasks"],   # remove "evaluation_tasks"
)
```

---

### ERR-004 · `docker-compose.yml` Has Obsolete `version` Attribute
**File:** `docker-compose.yml` line 1  
**Severity:** 🟠 High — Causes warning on every command, will break in future Compose versions  

```yaml
version: "3.9"   # obsolete
```

**Problem:** Docker Compose v2 ignores this field but prints a warning on every `docker-compose` command. Future versions may treat it as an error.

**Fix:** Remove the `version` line entirely:
```yaml
# docker-compose.yml — delete the first line
services:
  postgres:
    ...
```

---

## HIGH (Causes failures in specific flows)

---

### ERR-005 · `_get_user_tokens` Returns Empty Dict — Evaluation Always Fails
**File:** `backend/evaluation-service/main.py` line 120  
**Severity:** 🟠 High — Google Classroom evaluation never works  

```python
async def _get_user_tokens(user_id: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT google_tokens FROM users WHERE id=$1", user_id)
    return row["google_tokens"] if row else {}
```

**Problem:** The `users` table is never populated. The OAuth callback in `auth.py` creates a JWT but never inserts the user into the database. So `google_tokens` is always `{}`, and `ClassroomClient({})` will fail with a credentials error when trying to call the Google API.

**Fix:** In `auth.py` `oauth_callback`, upsert the user and store tokens:
```python
# After getting userinfo and tokens, upsert user in DB
# Requires a DB connection in the api-gateway service
async with asyncpg.create_pool(DATABASE_URL) as pool:
    await pool.execute(
        """INSERT INTO users (id, email, name, google_id, google_tokens)
           VALUES (uuid_generate_v4(), $1, $2, $3, $4::jsonb)
           ON CONFLICT (google_id) DO UPDATE SET
               google_tokens = EXCLUDED.google_tokens,
               last_login = NOW()""",
        userinfo["email"], userinfo.get("name"),
        userinfo["sub"], json.dumps(tokens),
    )
```
Also add `asyncpg` and `DATABASE_URL` to the api-gateway service.

---

### ERR-006 · `question-service` SQL Injection Risk in Dynamic UPDATE
**File:** `backend/question-service/main.py` lines 80–87  
**Severity:** 🟠 High — SQL injection via field names  

```python
set_clause = ", ".join(f"{k}=${i+2}" for i, k in enumerate(updates))
# k comes from user-controlled Pydantic field names
await pool.execute(
    f"UPDATE questions SET {set_clause}, is_edited=TRUE WHERE id=$1 ...",
    ...
)
```

**Problem:** While Pydantic limits `k` to known field names (`question_text`, `marks`, `answer_key`), the column names are interpolated directly into the SQL string. If the model ever changes or is bypassed, this is a SQL injection vector.

**Fix:** Use an explicit allowlist:
```python
ALLOWED_FIELDS = {"question_text", "marks", "answer_key"}
updates = {k: v for k, v in body.dict().items() if v is not None and k in ALLOWED_FIELDS}
```

---

### ERR-007 · `analytics-service` Returns 500 for Non-UUID `class_id`
**File:** `backend/analytics-service/main.py` lines 28–29  
**Severity:** 🟠 High — Unhandled DB exception crashes the endpoint  

```python
sessions = await pool.fetch(
    "... WHERE class_id=$1 ...", class_id   # class_id is a raw string, no UUID validation
)
```

**Problem:** PostgreSQL `class_id` column is UUID type. Passing a non-UUID string (e.g., `"some_class"`) causes `asyncpg.exceptions.DataError: invalid input for query argument $1` — an unhandled 500 error instead of a clean 400.

**Fix:** Add UUID validation at the route level:
```python
import uuid as uuid_lib

@app.get("/analytics/{class_id}")
async def class_analytics(class_id: str):
    try:
        uuid_lib.UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="class_id must be a valid UUID")
    ...
```
Apply the same pattern to all routes that accept UUID path parameters.

---

### ERR-008 · `docker-compose.yml` Frontend Uses `localhost` for API URL
**File:** `docker-compose.yml` lines 95–96  
**Severity:** 🟠 High — Frontend cannot reach API in production/staging  

```yaml
frontend:
  environment:
    - NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Problem:** `NEXT_PUBLIC_API_URL=http://localhost:8000` is baked into the Next.js build at compile time. This works on a developer's machine but breaks in any deployed environment where the API is not on `localhost`. The value cannot be changed at runtime without rebuilding the image.

**Fix:** Pass the URL as a build argument and use an env-aware default:
```yaml
frontend:
  build:
    args:
      - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}
  environment:
    - NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8000}
```

---

## MEDIUM (Degraded functionality)

---

### ERR-009 · `syllabus-service` DB Pool Not Initialized on Startup
**File:** `backend/syllabus-service/processor.py`  
**Severity:** 🟡 Medium — First request after cold start may fail  

```python
_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(...)   # lazy init
```

**Problem:** The DB pool is created lazily on the first request. If the first request arrives before PostgreSQL is fully ready (race condition despite healthcheck), the pool creation fails and the request returns a 500. The same pattern exists in `knowledge-service`, `question-service`, `evaluation-service`, and `analytics-service`.

**Fix:** Initialize the pool on application startup using FastAPI's lifespan:
```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pool
    _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    yield
    await _pool.close()

app = FastAPI(lifespan=lifespan)
```

---

### ERR-010 · `evaluation/page.tsx` Keywords Field Not Parsed to Array
**File:** `frontend/src/app/dashboard/evaluation/page.tsx` line 57  
**Severity:** 🟡 Medium — Keywords sent as raw string, not array  

```tsx
<input
  {...register("keywords")}
  placeholder="normalization, 1NF, 2NF, foreign key"
  onChange={(e) => {}}   // empty onChange overrides react-hook-form
/>
```

**Problem 1:** The `onChange={(e) => {}}` override silently prevents `react-hook-form` from tracking changes to this field — the value is always the initial empty string.

**Problem 2:** Even if the value is captured, it's sent as a plain string `"normalization, 1NF"` but the API expects `keywords: list[str]`.

**Fix:**
```tsx
// In handleSubmit transform:
onSubmit={handleSubmit((d) => {
  const keywords = d.keywords
    ? d.keywords.split(",").map((k: string) => k.trim()).filter(Boolean)
    : [];
  start.mutate({ ...d, total_marks: +d.total_marks, keywords });
})}

// Remove the empty onChange:
<input {...register("keywords")} placeholder="normalization, 1NF, 2NF" />
```

---

### ERR-011 · `docker-compose.yml` Missing `celery-worker` Dependency on `syllabus-service`
**File:** `docker-compose.yml`  
**Severity:** 🟡 Medium — Race condition on startup  

```yaml
celery-worker:
  depends_on:
    postgres:
      condition: service_healthy
    redis:
      condition: service_healthy
  # Missing: syllabus-service dependency
```

**Problem:** The Celery worker imports `syllabus_tasks` which imports `pdf_extractor` and `nlp_pipeline`. If the worker starts before the syllabus-service image is fully built (parallel builds), the import may fail. More importantly, the worker needs the same `uploads` volume to be mounted and accessible.

**Fix:** This is acceptable for the current setup since the worker builds from its own image. However, document that the `uploads` volume must be shared and add a startup check.

---

## LOW (Minor issues / improvements)

---

### ERR-012 · `datetime.utcnow()` Deprecated in Python 3.12+
**File:** `backend/api-gateway/auth.py` line 37  
**Severity:** 🟢 Low — Deprecation warning, not a runtime error yet  

```python
payload["exp"] = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
```

**Problem:** `datetime.utcnow()` is deprecated since Python 3.12. It will be removed in a future version.

**Fix:**
```python
from datetime import datetime, timedelta, timezone

payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
```

---

## Summary Table

| ID | Severity | Component | Issue | Status |
|----|----------|-----------|-------|--------|
| ERR-001 | 🔴 Critical | Config | Hardcoded SECRET_KEY | ✅ Fixed by user |
| ERR-002 | 🔴 Critical | Config | Google OAuth not configured | ✅ Fixed by user |
| ERR-003 | 🔴 Critical | Celery Worker | `evaluation_tasks` module missing | ✅ Auto-fixed |
| ERR-004 | 🟠 High | Docker | Obsolete `version` in compose file | ✅ Auto-fixed |
| ERR-005 | 🟠 High | Evaluation | User tokens never stored in DB | ✅ Auto-fixed |
| ERR-006 | 🟠 High | Question Service | SQL injection risk in dynamic UPDATE | ✅ Auto-fixed |
| ERR-007 | 🟠 High | Analytics | No UUID validation → 500 on bad input | ✅ Auto-fixed |
| ERR-008 | 🟠 High | Docker/Frontend | API URL hardcoded to localhost | ✅ Auto-fixed |
| ERR-009 | 🟡 Medium | All Services | Lazy DB pool init — cold start race | ✅ Auto-fixed |
| ERR-010 | 🟡 Medium | Frontend | Keywords field not parsed to array | ✅ Auto-fixed |
| ERR-011 | 🟡 Medium | Docker | Celery worker startup ordering | ⚠️ Documented |
| ERR-012 | 🟢 Low | Auth | `datetime.utcnow()` deprecated | ✅ Auto-fixed |

---

## Fix Priority Order

```
1. ERR-002  Set Google OAuth credentials (app is unusable without it)
2. ERR-001  Set a real SECRET_KEY (security)
3. ERR-003  Remove missing evaluation_tasks import (worker crashes)
4. ERR-005  Store user tokens in DB (evaluation flow broken)
5. ERR-010  Fix keywords field parsing (evaluation input broken)
6. ERR-004  Remove version from docker-compose.yml (cleanup)
7. ERR-007  Add UUID validation to analytics routes (stability)
8. ERR-006  Harden SQL update allowlist (security)
9. ERR-008  Parameterize NEXT_PUBLIC_API_URL (deployment)
10. ERR-009  Add lifespan DB pool init (reliability)
11. ERR-012  Fix deprecated datetime.utcnow() (future-proofing)
12. ERR-011  Document volume sharing for Celery (documentation)
```
