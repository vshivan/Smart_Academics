"""
Student Portal Service
- Student login via Google (separate from faculty)
- View own grades and feedback
- View class performance relative to peers
- Download certificates
"""
import os, json, uuid, logging
import sys, os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "shared"))
from response import ok, fail
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
import asyncpg

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)
try:
    from monitoring import init_sentry; init_sentry("student-service")
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://saap:saap_pass@postgres:5432/saap_db")
_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pool
    _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    yield
    await _pool.close()

app = FastAPI(title="Student Service", version="1.0.0", lifespan=lifespan)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback as _tb

@app.exception_handler(Exception)
async def _global_exc(request: Request, exc: Exception):
    import logging as _log
    _log.getLogger(__name__).error(_tb.format_exc())
    return JSONResponse(status_code=500, content={"success": False, "data": None, "error": {"code": "INTERNAL_SERVER_ERROR", "message": "An unexpected error occurred."}, "meta": None})

@app.exception_handler(HTTPException)
async def _http_exc(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"success": False, "data": None, "error": {"code": "ERROR", "message": exc.detail}, "meta": None})

@app.get("/health")
async def health():
    return ok({"status": "ok", "service": "student-service"})


# ── Student Profile ───────────────────────────────────────────

@app.get("/students/{student_google_id}/profile")
async def get_student_profile(student_google_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM student_portals WHERE student_google_id=$1", student_google_id
    )
    if not row:
        raise HTTPException(404, "Student not found")
    return ok(dict(row))


@app.post("/students/register")
async def register_student(
    student_google_id: str,
    student_email: str,
    student_name: str,
    college_id: str,
):
    pool = await get_pool()
    sid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO student_portals (id, student_google_id, student_email, student_name, college_id)
           VALUES ($1,$2,$3,$4,$5)
           ON CONFLICT (student_google_id) DO UPDATE SET
               student_name=EXCLUDED.student_name,
               last_login=NOW()""",
        sid, student_google_id, student_email, student_name, college_id
    )
    return ok({"id": sid, "student_google_id": student_google_id})


# ── Student Results ───────────────────────────────────────────

@app.get("/students/{student_google_id}/results")
async def get_student_results(student_google_id: str, college_id: Optional[str] = None):
    """Get all evaluation results for a student."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT er.id, er.marks_awarded, er.total_marks, er.percentage,
                  er.feedback, er.needs_review, er.faculty_override,
                  er.override_marks, er.evaluated_at,
                  es.assignment_title, es.class_id, es.status as session_status,
                  c.name as class_name, s.name as subject_name
           FROM evaluation_results er
           JOIN evaluation_sessions es ON er.session_id = es.id
           JOIN classes c ON es.class_id = c.id
           JOIN subjects s ON c.subject_id = s.id
           WHERE er.student_google_id=$1
           ORDER BY er.evaluated_at DESC""",
        student_google_id
    )
    results = [dict(r) for r in rows]

    # Compute summary stats
    if results:
        percentages = [r["percentage"] for r in results if r["percentage"]]
        summary = {
            "total_assignments": len(results),
            "average_score": round(sum(percentages) / len(percentages), 2) if percentages else 0,
            "highest_score": max(percentages) if percentages else 0,
            "lowest_score": min(percentages) if percentages else 0,
        }
    else:
        summary = {"total_assignments": 0, "average_score": 0, "highest_score": 0, "lowest_score": 0}

    return ok({"results": results, "summary": summary})


@app.get("/students/{student_google_id}/results/{session_id}")
async def get_student_result_detail(student_google_id: str, session_id: str):
    """Get detailed result for a specific assignment."""
    pool = await get_pool()
    row = await pool.fetchrow(
        """SELECT er.*, es.assignment_title, es.total_marks as session_total,
                  c.name as class_name, s.name as subject_name
           FROM evaluation_results er
           JOIN evaluation_sessions es ON er.session_id = es.id
           JOIN classes c ON es.class_id = c.id
           JOIN subjects s ON c.subject_id = s.id
           WHERE er.student_google_id=$1 AND er.session_id=$2""",
        student_google_id, session_id
    )
    if not row:
        raise HTTPException(404, "Result not found")

    # Get class rank
    rank_row = await pool.fetchrow(
        """SELECT COUNT(*) + 1 as rank FROM evaluation_results
           WHERE session_id=$1 AND percentage > (
               SELECT percentage FROM evaluation_results
               WHERE student_google_id=$2 AND session_id=$1
           )""",
        session_id, student_google_id
    )

    result = dict(row)
    result["rank"] = rank_row["rank"] if rank_row else None
    return ok(result)


@app.get("/students/{student_google_id}/classes")
async def get_student_classes(student_google_id: str):
    """Get all classes a student has submitted in."""
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT DISTINCT c.id, c.name, s.name as subject_name, s.code,
                  COUNT(er.id) as submission_count,
                  AVG(er.percentage) as avg_score
           FROM evaluation_results er
           JOIN evaluation_sessions es ON er.session_id = es.id
           JOIN classes c ON es.class_id = c.id
           JOIN subjects s ON c.subject_id = s.id
           WHERE er.student_google_id=$1
           GROUP BY c.id, c.name, s.name, s.code
           ORDER BY c.name""",
        student_google_id
    )
    return ok({"classes": [dict(r) for r in rows]})


@app.get("/students/{student_google_id}/certificates")
async def get_student_certificates(student_google_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM certificates WHERE student_google_id=$1 ORDER BY issued_date DESC",
        student_google_id
    )
    return ok({"certificates": [dict(r) for r in rows]})
