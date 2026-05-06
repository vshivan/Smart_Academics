"""Knowledge Graph Service — store and query subject knowledge with Redis caching."""
import os
import json
import sys, os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "shared"))
from response import ok, fail
from cache import cache
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel
from typing import Optional
import asyncpg
import logging

# Cache TTLs
KG_TTL     = 3600   # knowledge graph: 1 hour
TOPICS_TTL = 3600   # topics list: 1 hour

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

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://saap:saap_pass@postgres:5432/saap_db")


class KGUpsertRequest(BaseModel):
    graph_data: dict
    college_id: str
    file_id: Optional[str] = None


@app.get("/health")
async def health():
    redis_ok = await cache.ping()
    return ok({"status": "ok", "service": "knowledge-service", "redis": redis_ok})


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
    # Invalidate cache so next read gets fresh data
    await cache.delete(f"kg:{subject_id}")
    await cache.delete(f"topics:{subject_id}")
    return ok({"status": "stored", "unit_count": unit_count, "topic_count": topic_count})


@app.get("/subjects/{subject_id}/knowledge")
async def get_knowledge_graph(subject_id: str):
    """Retrieve full knowledge graph for a subject — Redis cached for 1 hour."""
    # Try cache first
    cached = await cache.get(f"kg:{subject_id}")
    if cached:
        return ok(cached)

    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT graph_data, unit_count, topic_count, version, last_updated FROM knowledge_graphs WHERE subject_id=$1",
        subject_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Knowledge graph not found. Upload syllabus first.")

    data = {
        "subject_id": subject_id,
        "graph": row["graph_data"],
        "unit_count": row["unit_count"],
        "topic_count": row["topic_count"],
        "version": row["version"],
        "last_updated": str(row["last_updated"]),
    }
    await cache.set(f"kg:{subject_id}", data, ttl=KG_TTL)
    return ok(data)


@app.get("/subjects/{subject_id}/topics")
async def get_topics(subject_id: str, unit_name: Optional[str] = None):
    """Get flattened topics list — Redis cached for 1 hour."""
    cache_key = f"topics:{subject_id}:{unit_name or 'all'}"
    cached = await cache.get(cache_key)
    if cached:
        return ok(cached)

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
    data = {"topics": [dict(r) for r in rows]}
    await cache.set(cache_key, data, ttl=TOPICS_TTL)
    return ok(data)


@app.get("/subjects/{subject_id}/units")
async def get_units(subject_id: str):
    """Get distinct units for a subject."""
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT DISTINCT unit_name, unit_order FROM kg_topics WHERE subject_id=$1 ORDER BY unit_order",
        subject_id,
    )
    return ok({"units": [dict(r) for r in rows]})
