"""Syllabus Processing Service — PDF → Knowledge Graph."""
import os
import hashlib
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import JSONResponse
import logging

from processor import SyllabusProcessor
from tasks import process_syllabus_task

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

app = FastAPI(title="Syllabus Service", version="1.0.0")
processor = SyllabusProcessor()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/app/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "syllabus-service"}


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
        return {
            "file_id": existing["id"],
            "status": "already_processed",
            "message": "File was previously uploaded and processed. Knowledge graph is ready.",
            "knowledge_graph_id": existing.get("knowledge_graph_id"),
        }

    # Save file
    file_id = str(uuid.uuid4())
    save_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
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

    return {
        "file_id": file_id,
        "status": "queued",
        "message": "File uploaded. Processing started in background.",
    }


@app.get("/subjects/{subject_id}/files")
async def list_files(subject_id: str, x_college_id: str = Header(...)):
    files = await processor.list_files(subject_id, x_college_id)
    return {"files": files}


@app.get("/files/{file_id}/status")
async def file_status(file_id: str):
    record = await processor.get_file(file_id)
    if not record:
        raise HTTPException(status_code=404, detail="File not found")
    return record
