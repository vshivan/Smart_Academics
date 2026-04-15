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
