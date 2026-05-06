"""Analytics Service — metrics, trends, performance dashboards."""

import os
import io
import csv
import uuid as uuid_lib
import json
import logging
import sys, os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "shared"))
from response import ok, fail
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
import asyncpg

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

try:
    from monitoring import init_sentry; init_sentry("analytics-service")
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
    logger.info("DB pool initialized")
    yield
    await _pool.close()


app = FastAPI(title="Analytics Service", version="1.0.0", lifespan=lifespan)

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
    return ok({"status": "ok", "service": "analytics-service"})


@app.get("/analytics/{class_id}")
async def class_analytics(class_id: str):
    """Overall class analytics snapshot."""
    try:
        uuid_lib.UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="class_id must be a valid UUID")
    pool = await get_pool()

    # Submission stats across all evaluation sessions for this class
    sessions = await pool.fetch(
        "SELECT id, assignment_title, total_submissions, processed_count, status, created_at "
        "FROM evaluation_sessions WHERE class_id=$1 ORDER BY created_at DESC",
        class_id,
    )

    stats = []
    for session in sessions:
        results = await pool.fetch(
            "SELECT marks_awarded, total_marks, percentage, needs_review, submission_time, evaluated_at "
            "FROM evaluation_results WHERE session_id=$1",
            session["id"],
        )
        if results:
            percentages = [r["percentage"] for r in results if r["percentage"] is not None]
            stats.append({
                "session_id": str(session["id"]),
                "assignment_title": session["assignment_title"],
                "total_submissions": session["total_submissions"],
                "average_score": round(sum(percentages) / len(percentages), 2) if percentages else 0,
                "highest_score": max(percentages) if percentages else 0,
                "lowest_score": min(percentages) if percentages else 0,
                "flagged_count": sum(1 for r in results if r["needs_review"]),
                "status": session["status"],
            })

    return ok({"class_id": class_id, "sessions": stats})


@app.get("/analytics/{class_id}/performance")
async def performance_trends(class_id: str):
    """Score distribution and performance trends over time."""
    try:
        uuid_lib.UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="class_id must be a valid UUID")
    pool = await get_pool()

    rows = await pool.fetch(
        """SELECT er.percentage, er.evaluated_at, es.assignment_title
           FROM evaluation_results er
           JOIN evaluation_sessions es ON er.session_id = es.id
           WHERE es.class_id=$1
           ORDER BY er.evaluated_at""",
        class_id,
    )

    # Score distribution buckets
    buckets = {"0-40": 0, "40-60": 0, "60-75": 0, "75-90": 0, "90-100": 0}
    for row in rows:
        pct = row["percentage"] or 0
        if pct < 40:
            buckets["0-40"] += 1
        elif pct < 60:
            buckets["40-60"] += 1
        elif pct < 75:
            buckets["60-75"] += 1
        elif pct < 90:
            buckets["75-90"] += 1
        else:
            buckets["90-100"] += 1

    # Trend: average per assignment
    trends = {}
    for row in rows:
        title = row["assignment_title"]
        if title not in trends:
            trends[title] = []
        trends[title].append(row["percentage"] or 0)

    trend_data = [
        {"assignment": title, "average": round(sum(scores) / len(scores), 2)}
        for title, scores in trends.items()
    ]

    return ok({
        "class_id": class_id,
        "score_distribution": buckets,
        "assignment_trends": trend_data,
        "total_evaluated": len(rows),
    })


@app.get("/analytics/{class_id}/submission-stats")
async def submission_stats(class_id: str):
    """On-time vs late submission stats."""
    try:
        uuid_lib.UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="class_id must be a valid UUID")
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT er.submission_time, er.evaluated_at, es.created_at as deadline
           FROM evaluation_results er
           JOIN evaluation_sessions es ON er.session_id = es.id
           WHERE es.class_id=$1""",
        class_id,
    )
    on_time = sum(
        1 for r in rows
        if r["submission_time"] and r["deadline"] and r["submission_time"] <= r["deadline"]
    )
    late = len(rows) - on_time
    return ok({
        "class_id": class_id,
        "total": len(rows),
        "on_time": on_time,
        "late": late,
    })


@app.get("/analytics/{class_id}/export/csv")
async def export_results_csv(class_id: str, session_id: str = Query(None)):
    """Export evaluation results as CSV — works for one session or all."""
    try:
        uuid_lib.UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="class_id must be a valid UUID")
    pool = await get_pool()

    if session_id:
        rows = await pool.fetch(
            """SELECT er.student_name, er.student_email, er.student_google_id,
                      er.marks_awarded, er.total_marks, er.percentage,
                      er.keyword_score, er.semantic_score, er.confidence_score,
                      er.needs_review, er.faculty_override, er.override_marks,
                      er.feedback, er.evaluated_at, es.assignment_title
               FROM evaluation_results er
               JOIN evaluation_sessions es ON er.session_id=es.id
               WHERE es.class_id=$1 AND er.session_id=$2
               ORDER BY er.percentage DESC""",
            class_id, session_id
        )
    else:
        rows = await pool.fetch(
            """SELECT er.student_name, er.student_email, er.student_google_id,
                      er.marks_awarded, er.total_marks, er.percentage,
                      er.keyword_score, er.semantic_score, er.confidence_score,
                      er.needs_review, er.faculty_override, er.override_marks,
                      er.feedback, er.evaluated_at, es.assignment_title
               FROM evaluation_results er
               JOIN evaluation_sessions es ON er.session_id=es.id
               WHERE es.class_id=$1
               ORDER BY es.created_at DESC, er.percentage DESC""",
            class_id
        )

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=[
        "assignment_title", "student_name", "student_email", "student_google_id",
        "marks_awarded", "total_marks", "percentage",
        "keyword_score", "semantic_score", "confidence_score",
        "needs_review", "faculty_override", "override_marks",
        "feedback", "evaluated_at"
    ])
    writer.writeheader()
    for r in rows:
        writer.writerow({
            "assignment_title": r["assignment_title"],
            "student_name": r["student_name"] or "",
            "student_email": r["student_email"] or "",
            "student_google_id": r["student_google_id"],
            "marks_awarded": r["marks_awarded"],
            "total_marks": r["total_marks"],
            "percentage": r["percentage"],
            "keyword_score": round(float(r["keyword_score"] or 0) * 100, 1),
            "semantic_score": round(float(r["semantic_score"] or 0) * 100, 1),
            "confidence_score": round(float(r["confidence_score"] or 0) * 100, 1),
            "needs_review": r["needs_review"],
            "faculty_override": r["faculty_override"],
            "override_marks": r["override_marks"] or "",
            "feedback": r["feedback"] or "",
            "evaluated_at": str(r["evaluated_at"] or ""),
        })

    buf.seek(0)
    filename = f"results_{class_id[:8]}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.get("/analytics/{class_id}/bloom-coverage")
async def bloom_coverage(class_id: str):
    """Bloom's taxonomy coverage report — which levels are being tested."""
    try:
        uuid_lib.UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="class_id must be a valid UUID")
    pool = await get_pool()

    # Get all papers for subjects in this class
    rows = await pool.fetch(
        """SELECT q.blooms_level, COUNT(*) as count, AVG(q.marks) as avg_marks
           FROM questions q
           JOIN question_papers qp ON q.paper_id=qp.id
           JOIN classes c ON qp.subject_id=c.subject_id
           WHERE c.id=$1
           GROUP BY q.blooms_level""",
        class_id
    )

    levels = ["remember", "understand", "apply", "analyze", "evaluate", "create"]
    coverage = {level: {"count": 0, "avg_marks": 0, "percentage": 0} for level in levels}
    total = 0

    for r in rows:
        if r["blooms_level"] in coverage:
            coverage[r["blooms_level"]]["count"] = r["count"]
            coverage[r["blooms_level"]]["avg_marks"] = round(float(r["avg_marks"] or 0), 2)
            total += r["count"]

    # Calculate percentages
    for level in levels:
        if total > 0:
            coverage[level]["percentage"] = round(coverage[level]["count"] / total * 100, 1)

    missing = [l for l in levels if coverage[l]["count"] == 0]
    return ok({
        "class_id": class_id,
        "coverage": coverage,
        "total_questions": total,
        "missing_levels": missing,
        "coverage_score": round((len(levels) - len(missing)) / len(levels) * 100, 1),
    })


@app.get("/analytics/{class_id}/student-risk")
async def student_risk(class_id: str, threshold: float = Query(default=40.0)):
    """Identify at-risk students (avg score below threshold)."""
    try:
        uuid_lib.UUID(class_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="class_id must be a valid UUID")
    pool = await get_pool()

    rows = await pool.fetch(
        """SELECT er.student_google_id, er.student_name, er.student_email,
                  AVG(er.percentage) as avg_score,
                  COUNT(er.id) as submission_count,
                  MIN(er.percentage) as lowest_score
           FROM evaluation_results er
           JOIN evaluation_sessions es ON er.session_id=es.id
           WHERE es.class_id=$1
           GROUP BY er.student_google_id, er.student_name, er.student_email
           HAVING AVG(er.percentage) < $2
           ORDER BY avg_score ASC""",
        class_id, threshold
    )

    return ok({
        "class_id": class_id,
        "threshold": threshold,
        "at_risk_count": len(rows),
        "students": [dict(r) for r in rows],
    })
