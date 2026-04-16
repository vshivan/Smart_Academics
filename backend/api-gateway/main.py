"""API Gateway — single entry point, routes to microservices."""
import os
import httpx
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging

from auth import router as auth_router, get_current_user
from proxy import proxy_request

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

try:
    from monitoring import init_sentry; init_sentry("api-gateway")
except ImportError:
    pass

app = FastAPI(title="SAAP API Gateway", version="1.0.0", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", os.getenv("FRONTEND_URL", "")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Service registry
SERVICES = {
    "syllabus":    os.getenv("SYLLABUS_SERVICE_URL",    "http://syllabus-service:8001"),
    "knowledge":   os.getenv("KNOWLEDGE_SERVICE_URL",   "http://knowledge-service:8002"),
    "questions":   os.getenv("QUESTION_SERVICE_URL",    "http://question-service:8003"),
    "evaluation":  os.getenv("EVALUATION_SERVICE_URL",  "http://evaluation-service:8004"),
    "analytics":   os.getenv("ANALYTICS_SERVICE_URL",   "http://analytics-service:8005"),
    "management":  os.getenv("MANAGEMENT_SERVICE_URL",  "http://management-service:8006"),
    "export":      os.getenv("EXPORT_SERVICE_URL",      "http://export-service:8007"),
    "features":    os.getenv("FEATURES_SERVICE_URL",    "http://features-service:8008"),
}

app.include_router(auth_router, prefix="/auth", tags=["auth"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "api-gateway"}


# ── Syllabus routes ──────────────────────────────────────────
@app.post("/upload-syllabus")
async def upload_syllabus(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["syllabus"], "/upload", user)


@app.get("/subjects/{subject_id}/files")
async def get_subject_files(subject_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["syllabus"], f"/subjects/{subject_id}/files", user)


# ── Knowledge Graph routes ───────────────────────────────────
@app.get("/subjects/{subject_id}/knowledge")
async def get_knowledge(subject_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["knowledge"], f"/subjects/{subject_id}/knowledge", user)


@app.get("/subjects/{subject_id}/topics")
async def get_topics(subject_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["knowledge"], f"/subjects/{subject_id}/topics", user)


# ── Question Paper routes ────────────────────────────────────
@app.post("/generate-paper")
async def generate_paper(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["questions"], "/generate", user)


@app.get("/papers/{paper_id}")
async def get_paper(paper_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["questions"], f"/papers/{paper_id}", user)


@app.patch("/papers/{paper_id}/questions/{question_id}")
async def edit_question(paper_id: str, question_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["questions"], f"/papers/{paper_id}/questions/{question_id}", user)


@app.post("/papers/{paper_id}/finalize")
async def finalize_paper(paper_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["questions"], f"/papers/{paper_id}/finalize", user)


# ── Evaluation routes ────────────────────────────────────────
@app.post("/evaluate-assignment")
async def evaluate_assignment(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["evaluation"], "/evaluate", user)


@app.get("/evaluation/{session_id}/results")
async def get_results(session_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["evaluation"], f"/sessions/{session_id}/results", user)


@app.patch("/evaluation/{session_id}/results/{result_id}/override")
async def override_result(session_id: str, result_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["evaluation"], f"/sessions/{session_id}/results/{result_id}/override", user)


# ── Analytics routes ─────────────────────────────────────────
@app.get("/analytics/{class_id}")
async def get_analytics(class_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["analytics"], f"/analytics/{class_id}", user)


@app.get("/analytics/{class_id}/performance")
async def get_performance(class_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["analytics"], f"/analytics/{class_id}/performance", user)


# ── Management routes ─────────────────────────────────────────
@app.post("/colleges")
async def create_college(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], "/colleges", user)

@app.get("/colleges")
async def list_colleges(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], "/colleges", user)

@app.get("/colleges/{college_id}")
async def get_college(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}", user)

@app.post("/colleges/{college_id}/subjects")
async def create_subject(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/subjects", user)

@app.get("/colleges/{college_id}/subjects")
async def list_subjects(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/subjects", user)

@app.post("/colleges/{college_id}/classes")
async def create_class(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/classes", user)

@app.get("/colleges/{college_id}/classes")
async def list_classes(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/classes", user)

@app.get("/colleges/{college_id}/faculty")
async def list_faculty(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/faculty", user)

@app.get("/colleges/{college_id}/hod-summary")
async def hod_summary(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/hod-summary", user)

@app.post("/colleges/{college_id}/departments")
async def create_department(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/departments", user)

@app.get("/colleges/{college_id}/departments")
async def list_departments(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/departments", user)

@app.post("/colleges/{college_id}/academic-years")
async def create_academic_year(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/academic-years", user)

@app.get("/colleges/{college_id}/academic-years")
async def list_academic_years(college_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["management"], f"/colleges/{college_id}/academic-years", user)


# ── Export routes ─────────────────────────────────────────────
@app.get("/papers/{paper_id}/export/pdf")
async def export_pdf(paper_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["export"], f"/papers/{paper_id}/export/pdf", user)


# ── Features routes ───────────────────────────────────────────
@app.get("/question-bank")
async def get_question_bank(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], "/question-bank", user)

@app.post("/question-bank")
async def add_question_bank(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], "/question-bank", user)

@app.post("/question-bank/import-from-paper/{paper_id}")
async def import_bank(paper_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/question-bank/import-from-paper/{paper_id}", user)

@app.get("/subjects/{subject_id}/syllabus-versions")
async def syllabus_versions(subject_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/subjects/{subject_id}/syllabus-versions", user)

@app.post("/subjects/{subject_id}/syllabus-versions/{version_id}/restore")
async def restore_version(subject_id: str, version_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/subjects/{subject_id}/syllabus-versions/{version_id}/restore", user)

@app.get("/rubrics")
async def list_rubrics(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], "/rubrics", user)

@app.post("/rubrics")
async def create_rubric(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], "/rubrics", user)

@app.get("/rubrics/{rubric_id}")
async def get_rubric(rubric_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/rubrics/{rubric_id}", user)

@app.get("/notifications")
async def get_notifications(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], "/notifications", user)

@app.post("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/notifications/{notification_id}/read", user)

@app.post("/notifications/read-all")
async def mark_all_read(request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], "/notifications/read-all", user)

@app.post("/plagiarism/check/{session_id}")
async def check_plagiarism(session_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/plagiarism/check/{session_id}", user)

@app.get("/plagiarism/{session_id}/report")
async def plagiarism_report(session_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/plagiarism/{session_id}/report", user)

@app.post("/evaluation/{session_id}/batch-override")
async def batch_override(session_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/evaluation/{session_id}/batch-override", user)

@app.post("/calibrate/{session_id}")
async def calibrate(session_id: str, request: Request, user=Depends(get_current_user)):
    return await proxy_request(request, SERVICES["features"], f"/calibrate/{session_id}", user)
