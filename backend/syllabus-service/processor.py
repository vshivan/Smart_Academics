"""DB operations for syllabus service."""
import os
from typing import Optional
import asyncpg

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://saap:saap_pass@postgres:5432/saap_db")
_pool = None


async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
    return _pool


class SyllabusProcessor:
    async def get_by_hash(self, file_hash: str) -> Optional[dict]:
        pool = await get_pool()
        row = await pool.fetchrow(
            "SELECT id, processing_status FROM uploaded_files WHERE file_hash=$1", file_hash
        )
        return dict(row) if row else None

    async def register_file(self, **kwargs) -> dict:
        pool = await get_pool()
        await pool.execute(
            """INSERT INTO uploaded_files
               (id, subject_id, college_id, uploaded_by, file_name, file_hash,
                file_type, storage_path, file_size_bytes, processing_status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
               ON CONFLICT (file_hash) DO NOTHING""",
            kwargs["file_id"], kwargs["subject_id"], kwargs["college_id"],
            kwargs["uploaded_by"], kwargs["file_name"], kwargs["file_hash"],
            kwargs["file_type"], kwargs["storage_path"], kwargs["file_size"],
        )
        return kwargs

    async def get_file(self, file_id: str) -> Optional[dict]:
        pool = await get_pool()
        row = await pool.fetchrow("SELECT * FROM uploaded_files WHERE id=$1", file_id)
        return dict(row) if row else None

    async def list_files(self, subject_id: str, college_id: str) -> list:
        pool = await get_pool()
        rows = await pool.fetch(
            "SELECT id, file_name, file_type, processing_status, created_at FROM uploaded_files "
            "WHERE subject_id=$1 AND college_id=$2 ORDER BY created_at DESC",
            subject_id, college_id,
        )
        return [dict(r) for r in rows]
