"""Question Generation Service."""
import os
import json
import uuid
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import asyncpg

from generator import QuestionGenerator

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

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


app = FastAPI(title="Question Generation Service", version="1.0.0", lifespan=lifespan)
generator = QuestionGenerator()


class GenerateRequest(BaseModel):
    subject_id: str
    exam_type: str = "midterm"
    total_marks: int = 50
    duration_minutes: int = 180
    selected_units: list[str] = []
    blooms_distribution: dict[str, float] = {}
    generate_sets: int = 2
    title: Optional[str] = None


class QuestionEditRequest(BaseModel):
    question_text: Optional[str] = None
    marks: Optional[int] = None
    answer_key: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "question-service"}


@app.post("/generate")
async def generate_paper(
    body: GenerateRequest,
    x_user_id: str = Header(...),
    x_college_id: str = Header(...),
):
    """Generate question papers (async-ready, returns immediately with paper IDs)."""
    try:
        papers = await generator.generate(body.dict())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    pool = await get_pool()
    paper_ids = []

    for paper in papers:
        paper_id = paper["paper_id"]
        await pool.execute(
            """INSERT INTO question_papers
               (id, subject_id, college_id, created_by, title, exam_type,
                total_marks, duration_minutes, paper_set, generation_config)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)""",
            paper_id, body.subject_id, x_college_id, x_user_id,
            body.title or f"{body.exam_type.title()} Paper - Set {paper['paper_set']}",
            body.exam_type, paper["total_marks"], body.duration_minutes,
            paper["paper_set"], json.dumps(body.dict()),
        )

        for q in paper["questions"]:
            await pool.execute(
                """INSERT INTO questions
                   (id, paper_id, subject_id, question_text, question_type, marks,
                    blooms_level, topic, unit_name, answer_key, keywords, order_index)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
                q["question_id"], paper_id, body.subject_id,
                q["question_text"], q["question_type"], q["marks"],
                q["blooms_level"], q["topic"], q["unit_name"],
                q["answer_key"], q.get("keywords", []), q["order_index"],
            )

        paper_ids.append({"paper_id": paper_id, "set": paper["paper_set"]})

    return {"status": "generated", "papers": paper_ids}


@app.get("/papers/{paper_id}")
async def get_paper(paper_id: str):
    pool = await get_pool()
    paper = await pool.fetchrow("SELECT * FROM question_papers WHERE id=$1", paper_id)
    if not paper:
        raise HTTPException(status_code=404, detail="Paper not found")

    questions = await pool.fetch(
        "SELECT * FROM questions WHERE paper_id=$1 ORDER BY order_index", paper_id
    )
    return {**dict(paper), "questions": [dict(q) for q in questions]}


ALLOWED_FIELDS = {"question_text", "marks", "answer_key"}

@app.patch("/papers/{paper_id}/questions/{question_id}")
async def edit_question(paper_id: str, question_id: str, body: QuestionEditRequest):
    """Faculty can edit questions before finalizing."""
    pool = await get_pool()
    updates = {k: v for k, v in body.dict().items() if v is not None and k in ALLOWED_FIELDS}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_clause = ", ".join(f"{k}=${i+2}" for i, k in enumerate(updates))
    values = list(updates.values())
    await pool.execute(
        f"UPDATE questions SET {set_clause}, is_edited=TRUE WHERE id=$1 AND paper_id=${len(values)+2}",
        question_id, *values, paper_id,
    )
    return {"status": "updated"}


@app.post("/papers/{paper_id}/finalize")
async def finalize_paper(paper_id: str, x_user_id: str = Header(...)):
    pool = await get_pool()
    await pool.execute(
        "UPDATE question_papers SET status='finalized', finalized_at=NOW() WHERE id=$1",
        paper_id,
    )
    return {"status": "finalized", "paper_id": paper_id}
