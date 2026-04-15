"""Analytics Service — metrics, trends, performance dashboards."""

import os
import uuid as uuid_lib
import json
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "analytics-service"}


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

    return {"class_id": class_id, "sessions": stats}


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

    return {
        "class_id": class_id,
        "score_distribution": buckets,
        "assignment_trends": trend_data,
        "total_evaluated": len(rows),
    }


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
    return {
        "class_id": class_id,
        "total": len(rows),
        "on_time": on_time,
        "late": late,
    }
