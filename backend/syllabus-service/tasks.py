"""Celery tasks for async syllabus processing."""
import os
import json
import logging
import httpx
from celery import Celery

from pdf_extractor import PDFExtractor
from nlp_pipeline import NLPPipeline

logger = logging.getLogger(__name__)

celery_app = Celery(
    "syllabus_tasks",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
)

extractor = PDFExtractor()
pipeline = NLPPipeline()

KNOWLEDGE_SERVICE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://knowledge-service:8002")


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def process_syllabus_task(self, file_id: str, file_path: str, subject_id: str, college_id: str):
    """
    Async pipeline:
    1. Extract text (with OCR fallback)
    2. Build knowledge graph via NLP
    3. Store in knowledge service
    4. Update file status
    """
    try:
        logger.info(f"Processing file {file_id} for subject {subject_id}")

        # Step 1: Extract text
        raw_text = extractor.extract(file_path)
        logger.info(f"Extracted {len(raw_text)} chars from {file_id}")

        # Step 2: Build knowledge graph
        kg = pipeline.build_knowledge_graph(raw_text, subject_id)

        # Step 3: Store knowledge graph
        resp = httpx.post(
            f"{KNOWLEDGE_SERVICE_URL}/subjects/{subject_id}/knowledge",
            json={"graph_data": kg, "college_id": college_id, "file_id": file_id},
            timeout=30,
        )
        resp.raise_for_status()

        # Step 4: Update file status to done
        _update_file_status(file_id, "done")
        logger.info(f"Successfully processed file {file_id}")

    except Exception as exc:
        logger.error(f"Processing failed for {file_id}: {exc}")
        _update_file_status(file_id, "failed", str(exc))
        raise self.retry(exc=exc)


def _update_file_status(file_id: str, status: str, error: str = None):
    """Update processing status in DB."""
    import psycopg2
    from urllib.parse import urlparse
    db_url = os.getenv("DATABASE_URL", "postgresql://saap:saap_pass@postgres:5432/saap_db")
    try:
        # Parse URL explicitly so psycopg2 gets the right dbname
        parsed = urlparse(db_url)
        conn = psycopg2.connect(
            host=parsed.hostname,
            port=parsed.port or 5432,
            user=parsed.username,
            password=parsed.password,
            dbname=parsed.path.lstrip("/"),
        )
        cur = conn.cursor()
        if error:
            cur.execute(
                "UPDATE uploaded_files SET processing_status=%s, processing_error=%s, processed_at=NOW() WHERE id=%s",
                (status, error, file_id),
            )
        else:
            cur.execute(
                "UPDATE uploaded_files SET processing_status=%s, processed_at=NOW() WHERE id=%s",
                (status, file_id),
            )
        conn.commit()
        cur.close()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to update file status: {e}")
