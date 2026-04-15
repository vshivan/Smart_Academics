"""Assignment Evaluation Service."""
import os
import json
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
import asyncpg
import pdfplumber
import io

from evaluator import AssignmentEvaluator
from classroom_client import ClassroomClient

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

try:
    from monitoring import init_sentry; init_sentry("evaluation-service")
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


app = FastAPI(title="Evaluation Service", version="1.0.0", lifespan=lifespan)
evaluator = AssignmentEvaluator()


class EvaluateRequest(BaseModel):
    class_id: str
    google_coursework_id: str
    assignment_title: str
    total_marks: int
    answer_key: str
    keywords: list[str] = []
    rubric: Optional[dict] = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "evaluation-service"}


@app.post("/evaluate")
async def start_evaluation(
    body: EvaluateRequest,
    background_tasks: BackgroundTasks,
    x_user_id: str = Header(...),
    x_college_id: str = Header(...),
):
    """Start async evaluation session."""
    pool = await get_pool()
    session_id = str(uuid.uuid4())

    await pool.execute(
        """INSERT INTO evaluation_sessions
           (id, class_id, college_id, created_by, google_coursework_id,
            assignment_title, total_marks, rubric, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'pending')""",
        session_id, body.class_id, x_college_id, x_user_id,
        body.google_coursework_id, body.assignment_title,
        body.total_marks, json.dumps(body.rubric or {}),
    )

    # Fetch user tokens for Classroom API
    user_tokens = await _get_user_tokens(x_user_id)
    background_tasks.add_task(
        run_evaluation, session_id, body, user_tokens, x_college_id
    )

    return {"session_id": session_id, "status": "processing"}


async def run_evaluation(session_id: str, body: EvaluateRequest, user_tokens: dict, college_id: str):
    """Background task: fetch submissions → OCR → evaluate → store."""
    pool = await get_pool()
    try:
        client = ClassroomClient(user_tokens)

        # Get class to find course_id
        class_row = await pool.fetchrow("SELECT google_classroom_id FROM classes WHERE id=$1", body.class_id)
        if not class_row:
            raise ValueError(f"Class {body.class_id} not found")
        course_id = class_row["google_classroom_id"]

        submissions = client.list_submissions(course_id, body.google_coursework_id)
        total = len(submissions)

        await pool.execute(
            "UPDATE evaluation_sessions SET total_submissions=$1, status='processing' WHERE id=$2",
            total, session_id,
        )

        for sub in submissions:
            await _process_submission(pool, session_id, sub, body, client, college_id)

        await pool.execute(
            "UPDATE evaluation_sessions SET status='done', completed_at=NOW() WHERE id=$1",
            session_id,
        )
        logger.info(f"Evaluation session {session_id} completed: {total} submissions")

    except Exception as e:
        logger.error(f"Evaluation session {session_id} failed: {e}")
        await pool.execute(
            "UPDATE evaluation_sessions SET status='failed' WHERE id=$1", session_id
        )


async def _process_submission(pool, session_id: str, submission: dict, body: EvaluateRequest, client, college_id: str):
    """Process a single student submission."""
    student_id = submission.get("userId", "unknown")
    student_profile = submission.get("assignedGrade")
    attachments = submission.get("assignmentSubmission", {}).get("attachments", [])

    student_text = ""
    for att in attachments:
        drive_file = att.get("driveFile", {})
        file_id = drive_file.get("id")
        if file_id:
            pdf_bytes = client.download_submission_pdf(file_id)
            if pdf_bytes:
                student_text += _extract_text_from_bytes(pdf_bytes)

    result = evaluator.evaluate(
        student_text=student_text,
        answer_key=body.answer_key,
        keywords=body.keywords,
        total_marks=body.total_marks,
        rubric=body.rubric,
    )

    result_id = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO evaluation_results
           (id, session_id, college_id, student_google_id, marks_awarded, total_marks,
            percentage, feedback, keyword_score, semantic_score, rubric_scores,
            confidence_score, needs_review)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,$12,$13)""",
        result_id, session_id, college_id, student_id,
        result["marks_awarded"], result["total_marks"], result["percentage"],
        result["feedback"], result["keyword_score"], result["semantic_score"],
        json.dumps(result["rubric_scores"]), result["confidence_score"], result["needs_review"],
    )

    await pool.execute(
        "UPDATE evaluation_sessions SET processed_count = processed_count + 1 WHERE id=$1",
        session_id,
    )


def _extract_text_from_bytes(pdf_bytes: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            return "\n".join(p.extract_text() or "" for p in pdf.pages)
    except Exception:
        return ""


@app.get("/sessions/{session_id}/results")
async def get_results(session_id: str):
    pool = await get_pool()
    session = await pool.fetchrow("SELECT * FROM evaluation_sessions WHERE id=$1", session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    results = await pool.fetch(
        "SELECT * FROM evaluation_results WHERE session_id=$1 ORDER BY marks_awarded DESC",
        session_id,
    )
    return {
        "session": dict(session),
        "results": [dict(r) for r in results],
        "flagged_for_review": sum(1 for r in results if r["needs_review"]),
    }


@app.patch("/sessions/{session_id}/results/{result_id}/override")
async def override_result(session_id: str, result_id: str, marks: float, feedback: str = ""):
    """Faculty override for uncertain evaluations."""
    pool = await get_pool()
    await pool.execute(
        """UPDATE evaluation_results
           SET faculty_override=TRUE, override_marks=$1, override_feedback=$2
           WHERE id=$3 AND session_id=$4""",
        marks, feedback, result_id, session_id,
    )
    return {"status": "overridden"}


async def _get_user_tokens(user_id: str) -> dict:
    pool = await get_pool()
    row = await pool.fetchrow("SELECT google_tokens FROM users WHERE id=$1", user_id)
    return row["google_tokens"] if row else {}
