"""Knowledge Graph Service — store and query subject knowledge."""
import os
import json
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import asyncpg
import logging

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

try:
    from monitoring import init_sentry; init_sentry("knowledge-service")
except ImportError:
    pass
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


app = FastAPI(title="Knowledge Graph Service", version="1.0.0", lifespan=lifespan)


class KGUpsertRequest(BaseModel):
    graph_data: dict
    college_id: str
    file_id: Optional[str] = None


@app.get("/health")
async def health():
    return {"status": "ok", "service": "knowledge-service"}


@app.post("/subjects/{subject_id}/knowledge")
async def upsert_knowledge_graph(subject_id: str, body: KGUpsertRequest):
    """Store or update knowledge graph for a subject."""
    pool = await get_pool()
    graph = body.graph_data
    unit_count = len(graph.get("units", []))
    topic_count = sum(len(u.get("topics", [])) for u in graph.get("units", []))

    # Upsert knowledge graph
    await pool.execute(
        """INSERT INTO knowledge_graphs (subject_id, college_id, graph_data, unit_count, topic_count, last_updated)
           VALUES ($1, $2, $3::jsonb, $4, $5, NOW())
           ON CONFLICT (subject_id) DO UPDATE SET
               graph_data = EXCLUDED.graph_data,
               unit_count = EXCLUDED.unit_count,
               topic_count = EXCLUDED.topic_count,
               version = knowledge_graphs.version + 1,
               last_updated = NOW()""",
        subject_id, body.college_id, json.dumps(graph), unit_count, topic_count,
    )

    # Sync flattened topics table for fast querying
    kg_row = await pool.fetchrow("SELECT id FROM knowledge_graphs WHERE subject_id=$1", subject_id)
    kg_id = str(kg_row["id"])

    await pool.execute("DELETE FROM kg_topics WHERE subject_id=$1", subject_id)
    for unit in graph.get("units", []):
        for topic in unit.get("topics", []):
            await pool.execute(
                """INSERT INTO kg_topics
                   (knowledge_graph_id, subject_id, unit_name, unit_order, topic_name,
                    topic_keywords, blooms_levels)
                   VALUES ($1,$2,$3,$4,$5,$6,$7)""",
                kg_id, subject_id, unit["name"], unit.get("order", 0),
                topic["topic_name"],
                topic.get("topic_keywords", []),
                topic.get("blooms_levels", []),
            )

    logger.info(f"Knowledge graph stored: subject={subject_id}, units={unit_count}, topics={topic_count}")
    return {"status": "stored", "unit_count": unit_count, "topic_count": topic_count}


@app.get("/subjects/{subject_id}/knowledge")
async def get_knowledge_graph(subject_id: str):
    """Retrieve full knowledge graph for a subject."""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT graph_data, unit_count, topic_count, version, last_updated FROM knowledge_graphs WHERE subject_id=$1",
        subject_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Knowledge graph not found. Upload syllabus first.")
    return {
        "subject_id": subject_id,
        "graph": row["graph_data"],
        "unit_count": row["unit_count"],
        "topic_count": row["topic_count"],
        "version": row["version"],
        "last_updated": str(row["last_updated"]),
    }


@app.get("/subjects/{subject_id}/topics")
async def get_topics(subject_id: str, unit_name: Optional[str] = None):
    """Get flattened topics list, optionally filtered by unit."""
    pool = await get_pool()
    if unit_name:
        rows = await pool.fetch(
            "SELECT * FROM kg_topics WHERE subject_id=$1 AND unit_name=$2 ORDER BY unit_order",
            subject_id, unit_name,
        )
    else:
        rows = await pool.fetch(
            "SELECT * FROM kg_topics WHERE subject_id=$1 ORDER BY unit_order, topic_name",
            subject_id,
        )
    return {"topics": [dict(r) for r in rows]}


@app.get("/subjects/{subject_id}/units")
async def get_units(subject_id: str):
    """Get distinct units for a subject."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT DISTINCT unit_name, unit_order FROM kg_topics WHERE subject_id=$1 ORDER BY unit_order",
        subject_id,
    )
    return {"units": [dict(r) for r in rows]}
