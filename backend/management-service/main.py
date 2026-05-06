"""
Management Service — Features 1, 2, 10
College setup, faculty management, subjects, classes, departments, RBAC
"""
import os, json, uuid, logging
import sys, os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "shared"))
from response import ok, fail
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Header
from pydantic import BaseModel, EmailStr
import asyncpg

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)
try:
    from monitoring import init_sentry; init_sentry("management-service")
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
    yield
    await _pool.close()

app = FastAPI(title="Management Service", version="1.0.0", lifespan=lifespan)

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

# ── Models ────────────────────────────────────────────────────

class CollegeCreate(BaseModel):
    name: str
    domain: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    established_year: Optional[int] = None

class SubjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    department: Optional[str] = None
    department_id: Optional[str] = None
    semester: Optional[int] = None
    description: Optional[str] = None
    credits: int = 3
    language: str = "en"
    academic_year_id: Optional[str] = None

class ClassCreate(BaseModel):
    subject_id: str
    name: str
    google_classroom_id: Optional[str] = None
    description: Optional[str] = None
    academic_year_id: Optional[str] = None

class DepartmentCreate(BaseModel):
    name: str
    code: Optional[str] = None
    hod_id: Optional[str] = None

class AcademicYearCreate(BaseModel):
    label: str
    is_current: bool = False

# ── Health ────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return ok({"status": "ok", "service": "management-service"})

# ── College ───────────────────────────────────────────────────

@app.post("/colleges")
async def create_college(body: CollegeCreate):
    pool = await get_pool()
    cid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO colleges (id, name, domain, address, phone, established_year)
           VALUES ($1,$2,$3,$4,$5,$6)""",
        cid, body.name, body.domain, body.address, body.phone, body.established_year
    )
    return ok({"id": cid, "name": body.name})

@app.get("/colleges")
async def list_colleges():
    pool = await get_pool()
    rows = await pool.fetch("SELECT id, name, domain, is_active, created_at FROM colleges ORDER BY name")
    return ok({"colleges": [dict(r) for r in rows]})

@app.get("/colleges/{college_id}")
async def get_college(college_id: str):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM colleges WHERE id=$1", college_id)
    if not row:
        raise HTTPException(404, "College not found")
    return ok(dict(row))

# ── Academic Years ────────────────────────────────────────────

@app.post("/colleges/{college_id}/academic-years")
async def create_academic_year(college_id: str, body: AcademicYearCreate):
    pool = await get_pool()
    if body.is_current:
        await pool.execute("UPDATE academic_years SET is_current=FALSE WHERE college_id=$1", college_id)
    yid = str(uuid.uuid4())
    await pool.execute(
        "INSERT INTO academic_years (id, college_id, label, is_current) VALUES ($1,$2,$3,$4)",
        yid, college_id, body.label, body.is_current
    )
    return ok({"id": yid, "label": body.label})

@app.get("/colleges/{college_id}/academic-years")
async def list_academic_years(college_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, label, is_current, created_at FROM academic_years WHERE college_id=$1 ORDER BY created_at DESC",
        college_id
    )
    return ok({"academic_years": [dict(r) for r in rows]})

# ── Departments ───────────────────────────────────────────────

@app.post("/colleges/{college_id}/departments")
async def create_department(college_id: str, body: DepartmentCreate, x_user_id: str = Header(...)):
    pool = await get_pool()
    did = str(uuid.uuid4())
    await pool.execute(
        "INSERT INTO departments (id, college_id, name, code, hod_id) VALUES ($1,$2,$3,$4,$5)",
        did, college_id, body.name, body.code, body.hod_id
    )
    return ok({"id": did, "name": body.name})

@app.get("/colleges/{college_id}/departments")
async def list_departments(college_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT d.id, d.name, d.code, u.name as hod_name
           FROM departments d LEFT JOIN users u ON d.hod_id=u.id
           WHERE d.college_id=$1 ORDER BY d.name""",
        college_id
    )
    return ok({"departments": [dict(r) for r in rows]})

# ── Subjects ──────────────────────────────────────────────────

@app.post("/colleges/{college_id}/subjects")
async def create_subject(college_id: str, body: SubjectCreate, x_user_id: str = Header(...)):
    pool = await get_pool()
    sid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO subjects
           (id, college_id, name, code, department, department_id, semester,
            description, credits, language, academic_year_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)""",
        sid, college_id, body.name, body.code, body.department,
        body.department_id, body.semester, body.description,
        body.credits, body.language, body.academic_year_id, x_user_id
    )
    return ok({"id": sid, "name": body.name})

@app.get("/colleges/{college_id}/subjects")
async def list_subjects(college_id: str, department: Optional[str] = None):
    pool = await get_pool()
    if department:
        rows = await pool.fetch(
            "SELECT id, name, code, department, semester, credits, is_active FROM subjects WHERE college_id=$1 AND department=$2 ORDER BY name",
            college_id, department
        )
    else:
        rows = await pool.fetch(
            "SELECT id, name, code, department, semester, credits, is_active FROM subjects WHERE college_id=$1 ORDER BY name",
            college_id
        )
    return ok({"subjects": [dict(r) for r in rows]})

# ── Classes ───────────────────────────────────────────────────

@app.post("/colleges/{college_id}/classes")
async def create_class(college_id: str, body: ClassCreate, x_user_id: str = Header(...)):
    pool = await get_pool()
    cid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO classes
           (id, college_id, subject_id, name, google_classroom_id, faculty_id, academic_year_id, description)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)""",
        cid, college_id, body.subject_id, body.name,
        body.google_classroom_id, x_user_id, body.academic_year_id, body.description
    )
    return ok({"id": cid, "name": body.name})

@app.get("/colleges/{college_id}/classes")
async def list_classes(college_id: str, subject_id: Optional[str] = None):
    pool = await get_pool()
    if subject_id:
        rows = await pool.fetch(
            """SELECT c.id, c.name, s.name as subject_name, c.student_count, c.is_active
               FROM classes c JOIN subjects s ON c.subject_id=s.id
               WHERE c.college_id=$1 AND c.subject_id=$2 ORDER BY c.name""",
            college_id, subject_id
        )
    else:
        rows = await pool.fetch(
            """SELECT c.id, c.name, s.name as subject_name, c.student_count, c.is_active
               FROM classes c JOIN subjects s ON c.subject_id=s.id
               WHERE c.college_id=$1 ORDER BY c.name""",
            college_id
        )
    return ok({"classes": [dict(r) for r in rows]})

# ── Faculty ───────────────────────────────────────────────────

@app.get("/colleges/{college_id}/faculty")
async def list_faculty(college_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, name, email, role, department, is_active, last_login FROM users WHERE college_id=$1 ORDER BY name",
        college_id
    )
    return ok({"faculty": [dict(r) for r in rows]})

@app.patch("/colleges/{college_id}/faculty/{user_id}/role")
async def update_role(college_id: str, user_id: str, role: str):
    if role not in ("faculty", "hod", "admin"):
        raise HTTPException(400, "Invalid role")
    pool = await get_pool()
    await pool.execute(
        "UPDATE users SET role=$1 WHERE id=$2 AND college_id=$3",
        role, user_id, college_id
    )
    return ok({"status": "updated"})

# ── HOD Dashboard ─────────────────────────────────────────────

@app.get("/colleges/{college_id}/hod-summary")
async def hod_summary(college_id: str, x_user_id: str = Header(...)):
    """Department-level summary for HOD role."""
    pool = await get_pool()
    user = await pool.fetchrow("SELECT role, department_id FROM users WHERE id=$1", x_user_id)
    if not user or user["role"] not in ("hod", "admin"):
        raise HTTPException(403, "HOD or Admin access required")

    subjects = await pool.fetchval("SELECT COUNT(*) FROM subjects WHERE college_id=$1", college_id)
    classes = await pool.fetchval("SELECT COUNT(*) FROM classes WHERE college_id=$1", college_id)
    faculty = await pool.fetchval("SELECT COUNT(*) FROM users WHERE college_id=$1 AND role='faculty'", college_id)
    papers = await pool.fetchval("SELECT COUNT(*) FROM question_papers WHERE college_id=$1", college_id)
    sessions = await pool.fetchval("SELECT COUNT(*) FROM evaluation_sessions WHERE college_id=$1", college_id)

    return ok({
        "college_id": college_id,
        "subjects": subjects,
        "classes": classes,
        "faculty": faculty,
        "papers_generated": papers,
        "evaluation_sessions": sessions,
    })
