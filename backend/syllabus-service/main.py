"""Syllabus Processing Service — PDF → Knowledge Graph."""
import os
import hashlib
import uuid
import sys, os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "shared"))
from response import ok, fail
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import JSONResponse
import logging

from processor import SyllabusProcessor
from tasks import process_syllabus_task

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

try:
    from monitoring import init_sentry; init_sentry("syllabus-service")
except ImportError:
    pass

app = FastAPI(title="Syllabus Service", version="1.0.0")
processor = SyllabusProcessor()

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

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/health")
async def health():
    return ok({"status": "ok", "service": "syllabus-service"})


@app.post("/upload")
async def upload_syllabus(
    file: UploadFile = File(...),
    subject_id: str = Form(...),
    file_type: str = Form("syllabus"),  # syllabus | reference
    x_user_id: str = Header(...),
    x_college_id: str = Header(...),
):
    """Upload PDF once — deduplicated by SHA-256 hash."""
    content = await file.read()
    file_hash = hashlib.sha256(content).hexdigest()

    # Check if already processed (content memory)
    existing = await processor.get_by_hash(file_hash)
    if existing and existing["processing_status"] == "done":
        logger.info(f"File already processed: {file_hash}")
        return ok({
            "file_id": existing["id"],
            "status": "already_processed",
            "message": "File was previously uploaded and processed. Knowledge graph is ready.",
            "knowledge_graph_id": existing.get("knowledge_graph_id"),
        })

    # Validate file type (SEC-004)
    if not file.filename.lower().endswith(".pdf") and file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Only PDF files are allowed")

    # Save file (SEC-003 FIX: Use secure path, no client filename in path)
    file_id = str(uuid.uuid4())
    safe_filename = "".join([c for c in file.filename if c.isalnum() or c in "._-"]).strip()
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}_{safe_filename}")
    with open(save_path, "wb") as f:
        f.write(content)

    # Register in DB
    record = await processor.register_file(
        file_id=file_id,
        subject_id=subject_id,
        college_id=x_college_id,
        uploaded_by=x_user_id,
        file_name=file.filename,
        file_hash=file_hash,
        file_type=file_type,
        storage_path=save_path,
        file_size=len(content),
    )

    # Dispatch async processing task
    process_syllabus_task.delay(file_id, save_path, subject_id, x_college_id)

    return ok({
        "file_id": file_id,
        "status": "queued",
        "message": "File uploaded. Processing started in background.",
    })


@app.get("/subjects/{subject_id}/files")
async def list_files(subject_id: str, x_college_id: str = Header(...)):
    files = await processor.list_files(subject_id, x_college_id)
    return ok({"files": files})


@app.get("/files/{file_id}/status")
async def file_status(file_id: str, x_college_id: str = Header(...)):
    record = await processor.get_file(file_id)
    if not record or record["college_id"] != x_college_id:
        raise HTTPException(status_code=404, detail="File not found or unauthorized")
    return ok(record)
