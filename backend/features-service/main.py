"""
Features Service — Features 6, 7, 8, 9, 11, 12
Question Bank, Syllabus Versions, Rubric Builder,
Notifications, Difficulty Calibration, Plagiarism Detection
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
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)
try:
    from monitoring import init_sentry; init_sentry("features-service")
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

app = FastAPI(title="Features Service", version="1.0.0", lifespan=lifespan)

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
    return ok({"status": "ok", "service": "features-service"})

# ══════════════════════════════════════════════════════════════
# FEATURE 6: QUESTION BANK
# ══════════════════════════════════════════════════════════════

class QuestionBankAdd(BaseModel):
    subject_id: str
    question_text: str
    question_type: str = "short"
    marks: int = 5
    blooms_level: str = "understand"
    topic: str = ""
    unit_name: str = ""
    answer_key: str = ""
    keywords: list[str] = []
    difficulty: str = "medium"
    tags: list[str] = []
    language: str = "en"
    source_paper_id: Optional[str] = None


@app.post("/question-bank")
async def add_to_bank(body: QuestionBankAdd, x_user_id: str = Header(...), x_college_id: str = Header(...)):
    pool = await get_pool()
    qid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO question_bank
           (id, college_id, subject_id, question_text, question_type, marks,
            blooms_level, topic, unit_name, answer_key, keywords, difficulty,
            tags, language, source_paper_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)""",
        qid, x_college_id, body.subject_id, body.question_text, body.question_type,
        body.marks, body.blooms_level, body.topic, body.unit_name, body.answer_key,
        body.keywords, body.difficulty, body.tags, body.language,
        body.source_paper_id, x_user_id
    )
    return ok({"id": qid, "status": "added"})


@app.get("/question-bank")
async def search_bank(
    subject_id: Optional[str] = None,
    blooms_level: Optional[str] = None,
    difficulty: Optional[str] = None,
    topic: Optional[str] = None,
    language: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 50,
    x_college_id: str = Header(...),
):
    pool = await get_pool()
    filters = ["college_id=$1"]
    params: list = [x_college_id]
    i = 2
    if subject_id:
        filters.append(f"subject_id=${i}"); params.append(subject_id); i += 1
    if blooms_level:
        filters.append(f"blooms_level=${i}"); params.append(blooms_level); i += 1
    if difficulty:
        filters.append(f"difficulty=${i}"); params.append(difficulty); i += 1
    if topic:
        filters.append(f"topic ILIKE ${i}"); params.append(f"%{topic}%"); i += 1
    if language:
        filters.append(f"language=${i}"); params.append(language); i += 1
    if q:
        filters.append(f"question_text ILIKE ${i}"); params.append(f"%{q}%"); i += 1

    where = " AND ".join(filters)
    rows = await pool.fetch(
        f"SELECT * FROM question_bank WHERE {where} ORDER BY usage_count DESC LIMIT {limit}",
        *params
    )
    return ok({"questions": [dict(r) for r in rows], "total": len(rows)})


@app.post("/question-bank/import-from-paper/{paper_id}")
async def import_from_paper(paper_id: str, x_user_id: str = Header(...), x_college_id: str = Header(...)):
    """Bulk import all questions from a finalized paper into the bank."""
    pool = await get_pool()
    questions = await pool.fetch("SELECT * FROM questions WHERE paper_id=$1", paper_id)
    paper = await pool.fetchrow("SELECT subject_id FROM question_papers WHERE id=$1", paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")

    imported = 0
    for q in questions:
        qid = str(uuid.uuid4())
        await pool.execute(
            """INSERT INTO question_bank
               (id, college_id, subject_id, question_text, question_type, marks,
                blooms_level, topic, unit_name, answer_key, keywords, source_paper_id, created_by)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
               ON CONFLICT DO NOTHING""",
            qid, x_college_id, paper["subject_id"], q["question_text"],
            q["question_type"], q["marks"], q["blooms_level"], q["topic"],
            q["unit_name"], q["answer_key"], q["keywords"] or [], paper_id, x_user_id
        )
        imported += 1
    return ok({"imported": imported})


# ══════════════════════════════════════════════════════════════
# FEATURE 7: SYLLABUS VERSION HISTORY
# ══════════════════════════════════════════════════════════════

@app.get("/subjects/{subject_id}/syllabus-versions")
async def list_versions(subject_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT sv.id, sv.version_number, sv.change_summary, sv.created_at,
                  u.name as created_by_name
           FROM syllabus_versions sv LEFT JOIN users u ON sv.created_by=u.id
           WHERE sv.subject_id=$1 ORDER BY sv.version_number DESC""",
        subject_id
    )
    return ok({"versions": [dict(r) for r in rows]})


@app.get("/subjects/{subject_id}/syllabus-versions/{version_id}")
async def get_version(subject_id: str, version_id: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM syllabus_versions WHERE id=$1 AND subject_id=$2",
        version_id, subject_id
    )
    if not row:
        raise HTTPException(404, "Version not found")
    return ok(dict(row))


@app.post("/subjects/{subject_id}/syllabus-versions/{version_id}/restore")
async def restore_version(subject_id: str, version_id: str, x_college_id: str = Header(...)):
    """Restore a previous knowledge graph version."""
    pool = await get_pool()
    version = await pool.fetchrow(
        "SELECT graph_data FROM syllabus_versions WHERE id=$1", version_id
    )
    if not version:
        raise HTTPException(404, "Version not found")

    graph = version["graph_data"]
    unit_count = len(graph.get("units", []))
    topic_count = sum(len(u.get("topics", [])) for u in graph.get("units", []))

    await pool.execute(
        """UPDATE knowledge_graphs SET graph_data=$1::jsonb, unit_count=$2, topic_count=$3,
           version=version+1, last_updated=NOW() WHERE subject_id=$4""",
        json.dumps(graph), unit_count, topic_count, subject_id
    )
    return ok({"status": "restored", "unit_count": unit_count})


# ══════════════════════════════════════════════════════════════
# FEATURE 8: RUBRIC BUILDER
# ══════════════════════════════════════════════════════════════

class RubricCreate(BaseModel):
    name: str
    description: Optional[str] = None
    criteria: list[dict]
    is_shared: bool = False


@app.post("/rubrics")
async def create_rubric(body: RubricCreate, x_user_id: str = Header(...), x_college_id: str = Header(...)):
    pool = await get_pool()
    rid = str(uuid.uuid4())
    total_weight = sum(c.get("weight", 1) for c in body.criteria)
    await pool.execute(
        """INSERT INTO rubric_templates
           (id, college_id, created_by, name, description, criteria, total_weight, is_shared)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)""",
        rid, x_college_id, x_user_id, body.name, body.description,
        json.dumps(body.criteria), total_weight, body.is_shared
    )
    return ok({"id": rid, "name": body.name})


@app.get("/rubrics")
async def list_rubrics(x_college_id: str = Header(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, name, description, criteria, total_weight, is_shared, usage_count FROM rubric_templates WHERE college_id=$1 ORDER BY usage_count DESC",
        x_college_id
    )
    return ok({"rubrics": [dict(r) for r in rows]})


@app.get("/rubrics/{rubric_id}")
async def get_rubric(rubric_id: str):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM rubric_templates WHERE id=$1", rubric_id)
    if not row:
        raise HTTPException(404, "Rubric not found")
    return ok(dict(row))


# ══════════════════════════════════════════════════════════════
# FEATURE 9: NOTIFICATIONS
# ══════════════════════════════════════════════════════════════

@app.get("/notifications")
async def get_notifications(unread_only: bool = False, x_user_id: str = Header(...)):
    pool = await get_pool()
    if unread_only:
        rows = await pool.fetch(
            "SELECT * FROM notifications WHERE user_id=$1 AND is_read=FALSE ORDER BY created_at DESC LIMIT 50",
            x_user_id
        )
    else:
        rows = await pool.fetch(
            "SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50",
            x_user_id
        )
    unread_count = await pool.fetchval(
        "SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=FALSE", x_user_id
    )
    return ok({"notifications": [dict(r) for r in rows], "unread_count": unread_count})


@app.post("/notifications/{notification_id}/read")
async def mark_read(notification_id: str, x_user_id: str = Header(...)):
    pool = await get_pool()
    await pool.execute(
        "UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2",
        notification_id, x_user_id
    )
    return ok({"status": "read"})


@app.post("/notifications/read-all")
async def mark_all_read(x_user_id: str = Header(...)):
    pool = await get_pool()
    await pool.execute("UPDATE notifications SET is_read=TRUE WHERE user_id=$1", x_user_id)
    return ok({"status": "all_read"})


async def send_notification(user_id: str, college_id: str, notif_type: str,
                             title: str, message: str, resource_type: str = None,
                             resource_id: str = None):
    """Internal helper — call from other services via HTTP or import."""
    pool = await get_pool()
    nid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO notifications
           (id, user_id, college_id, type, title, message, resource_type, resource_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
        nid, user_id, college_id, notif_type, title, message, resource_type, resource_id
    )


# ══════════════════════════════════════════════════════════════
# FEATURE 11: DIFFICULTY CALIBRATION
# ══════════════════════════════════════════════════════════════

@app.post("/calibrate/{session_id}")
async def calibrate_difficulty(session_id: str):
    """After evaluation, recalibrate question difficulty based on actual scores."""
    pool = await get_pool()
    results = await pool.fetch(
        "SELECT marks_awarded, total_marks FROM evaluation_results WHERE session_id=$1",
        session_id
    )
    if not results:
        return ok({"status": "no_data"})

    avg_pct = sum(r["marks_awarded"] / r["total_marks"] for r in results) / len(results)

    # Map avg score to difficulty
    if avg_pct >= 0.75:
        calibrated = "easy"
    elif avg_pct >= 0.45:
        calibrated = "medium"
    else:
        calibrated = "hard"

    session = await pool.fetchrow("SELECT id FROM evaluation_sessions WHERE id=$1", session_id)
    if session:
        await pool.execute(
            """INSERT INTO question_performance
               (id, session_id, avg_score, attempt_count, calibrated_difficulty)
               VALUES ($1,$2,$3,$4,$5)""",
            str(uuid.uuid4()), session_id,
            round(avg_pct * 100, 2), len(results), calibrated
        )

    return ok({"calibrated_difficulty": calibrated, "avg_score_pct": round(avg_pct * 100, 2)})


# ══════════════════════════════════════════════════════════════
# FEATURE 12: PLAGIARISM DETECTION
# ══════════════════════════════════════════════════════════════

@app.post("/plagiarism/check/{session_id}")
async def check_plagiarism(session_id: str, threshold: float = 0.75):
    """Compare all submissions in a session for similarity."""
    pool = await get_pool()
    results = await pool.fetch(
        "SELECT id, student_google_id, feedback FROM evaluation_results WHERE session_id=$1",
        session_id
    )
    if len(results) < 2:
        return ok({"pairs": [], "flagged": 0})

    texts = [r["feedback"] or "" for r in results]
    ids = [r["student_google_id"] for r in results]
    result_ids = [str(r["id"]) for r in results]

    try:
        vec = TfidfVectorizer(stop_words="english")
        matrix = vec.fit_transform(texts)
        sim_matrix = cosine_similarity(matrix)
    except Exception:
        return ok({"pairs": [], "flagged": 0, "error": "insufficient text"})

    flagged_pairs = []
    for i in range(len(results)):
        for j in range(i + 1, len(results)):
            score = float(sim_matrix[i][j])
            if score >= threshold:
                pair_id = str(uuid.uuid4())
                await pool.execute(
                    """INSERT INTO plagiarism_reports
                       (id, session_id, student_a_id, student_b_id, similarity_score)
                       VALUES ($1,$2,$3,$4,$5)
                       ON CONFLICT DO NOTHING""",
                    pair_id, session_id, ids[i], ids[j], round(score * 100, 2)
                )
                flagged_pairs.append({
                    "student_a": ids[i],
                    "student_b": ids[j],
                    "similarity": round(score * 100, 2),
                })

    return ok({"pairs": flagged_pairs, "flagged": len(flagged_pairs), "threshold_pct": threshold * 100})


@app.get("/plagiarism/{session_id}/report")
async def get_plagiarism_report(session_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM plagiarism_reports WHERE session_id=$1 ORDER BY similarity_score DESC",
        session_id
    )
    return ok({"reports": [dict(r) for r in rows]})


# ══════════════════════════════════════════════════════════════
# FEATURE 5: BATCH OVERRIDE & RE-EVALUATION
# ══════════════════════════════════════════════════════════════

class BatchOverride(BaseModel):
    adjustment_type: str  # add_marks | set_marks | add_feedback
    adjustment_value: str
    filter_needs_review: bool = False


@app.post("/evaluation/{session_id}/batch-override")
async def batch_override(session_id: str, body: BatchOverride, x_user_id: str = Header(...)):
    pool = await get_pool()

    if body.filter_needs_review:
        results = await pool.fetch(
            "SELECT id, marks_awarded, total_marks FROM evaluation_results WHERE session_id=$1 AND needs_review=TRUE",
            session_id
        )
    else:
        results = await pool.fetch(
            "SELECT id, marks_awarded, total_marks FROM evaluation_results WHERE session_id=$1",
            session_id
        )

    updated = 0
    for r in results:
        if body.adjustment_type == "add_marks":
            new_marks = min(float(r["marks_awarded"]) + float(body.adjustment_value), r["total_marks"])
            await pool.execute(
                "UPDATE evaluation_results SET override_marks=$1, faculty_override=TRUE WHERE id=$2",
                new_marks, r["id"]
            )
        elif body.adjustment_type == "set_marks":
            await pool.execute(
                "UPDATE evaluation_results SET override_marks=$1, faculty_override=TRUE WHERE id=$2",
                float(body.adjustment_value), r["id"]
            )
        elif body.adjustment_type == "add_feedback":
            await pool.execute(
                "UPDATE evaluation_results SET override_feedback=$1, faculty_override=TRUE WHERE id=$2",
                body.adjustment_value, r["id"]
            )
        updated += 1

    # Log batch override
    await pool.execute(
        """INSERT INTO batch_overrides
           (id, session_id, applied_by, adjustment_type, adjustment_value, affected_count)
           VALUES ($1,$2,$3,$4,$5,$6)""",
        str(uuid.uuid4()), session_id, x_user_id,
        body.adjustment_type, body.adjustment_value, updated
    )
    return ok({"updated": updated, "adjustment_type": body.adjustment_type})
