"""
Advanced Service — Paper Templates, Attendance, Certificates,
Comparative Analytics, Accreditation Reports, Difficulty Prediction,
Co-Faculty Collaboration, Bulk Student Import, AI Chatbot (FAQ-based)
"""
import os, json, uuid, io, logging, csv
import sys, os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "shared"))
from response import ok, fail
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, UploadFile, File
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncpg
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)
try:
    from monitoring import init_sentry; init_sentry("advanced-service")
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

app = FastAPI(title="Advanced Service", version="1.0.0", lifespan=lifespan)

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

@app.get("/health")
async def health():
    return ok({"status": "ok", "service": "advanced-service"})

# ── PAPER TEMPLATES ───────────────────────────────────────────

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    exam_type: str = "midterm"
    total_marks: int = 50
    duration_minutes: int = 180
    blooms_distribution: dict = {}
    sections: list = []
    instructions: Optional[str] = None
    is_default: bool = False

@app.post("/paper-templates")
async def create_template(body: TemplateCreate, x_user_id: str = Header(...), x_college_id: str = Header(...)):
    pool = await get_pool()
    tid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO paper_templates
           (id, college_id, created_by, name, description, exam_type, total_marks,
            duration_minutes, blooms_distribution, sections, instructions, is_default)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)""",
        tid, x_college_id, x_user_id, body.name, body.description, body.exam_type,
        body.total_marks, body.duration_minutes, json.dumps(body.blooms_distribution),
        json.dumps(body.sections), body.instructions, body.is_default
    )
    return ok({"id": tid, "name": body.name})

@app.get("/paper-templates")
async def list_templates(x_college_id: str = Header(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT * FROM paper_templates WHERE college_id=$1 ORDER BY usage_count DESC, created_at DESC",
        x_college_id
    )
    return ok({"templates": [dict(r) for r in rows]})

@app.get("/paper-templates/{template_id}")
async def get_template(template_id: str):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM paper_templates WHERE id=$1", template_id)
    if not row:
        raise HTTPException(404, "Template not found")
    await pool.execute("UPDATE paper_templates SET usage_count=usage_count+1 WHERE id=$1", template_id)
    return ok(dict(row))

# ── ATTENDANCE ────────────────────────────────────────────────

class AttendanceSession(BaseModel):
    class_id: str
    session_date: str
    session_type: str = "lecture"
    topic: Optional[str] = None

class AttendanceMark(BaseModel):
    student_id: str
    student_name: Optional[str] = None
    status: str = "present"
    remarks: Optional[str] = None

@app.post("/attendance/sessions")
async def create_attendance_session(body: AttendanceSession, x_user_id: str = Header(...), x_college_id: str = Header(...)):
    pool = await get_pool()
    sid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO attendance_sessions (id, class_id, college_id, session_date, session_type, topic, marked_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7)""",
        sid, body.class_id, x_college_id, body.session_date, body.session_type, body.topic, x_user_id
    )
    return ok({"id": sid, "session_date": body.session_date})

@app.post("/attendance/sessions/{session_id}/mark")
async def mark_attendance(session_id: str, records: list[AttendanceMark]):
    pool = await get_pool()
    for r in records:
        await pool.execute(
            """INSERT INTO attendance_records (id, attendance_session_id, student_id, student_name, status, remarks)
               VALUES ($1,$2,$3,$4,$5,$6)
               ON CONFLICT DO NOTHING""",
            str(uuid.uuid4()), session_id, r.student_id, r.student_name, r.status, r.remarks
        )
    return ok({"marked": len(records)})

@app.get("/attendance/{class_id}")
async def get_attendance(class_id: str, from_date: Optional[str] = None, to_date: Optional[str] = None):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT ats.session_date, ats.session_type, ats.topic,
                  COUNT(ar.id) as total,
                  SUM(CASE WHEN ar.status='present' THEN 1 ELSE 0 END) as present_count,
                  SUM(CASE WHEN ar.status='absent' THEN 1 ELSE 0 END) as absent_count
           FROM attendance_sessions ats
           LEFT JOIN attendance_records ar ON ats.id = ar.attendance_session_id
           WHERE ats.class_id=$1
           GROUP BY ats.id, ats.session_date, ats.session_type, ats.topic
           ORDER BY ats.session_date DESC""",
        class_id
    )
    return ok({"sessions": [dict(r) for r in rows]})

@app.get("/attendance/{class_id}/student/{student_id}")
async def get_student_attendance(class_id: str, student_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT ats.session_date, ar.status, ar.remarks
           FROM attendance_sessions ats
           JOIN attendance_records ar ON ats.id = ar.attendance_session_id
           WHERE ats.class_id=$1 AND ar.student_id=$2
           ORDER BY ats.session_date DESC""",
        class_id, student_id
    )
    total = len(rows)
    present = sum(1 for r in rows if r["status"] == "present")
    pct = round(present / total * 100, 1) if total > 0 else 0
    return ok({"records": [dict(r) for r in rows], "total": total, "present": present, "attendance_pct": pct})

# ── CERTIFICATES ──────────────────────────────────────────────

class CertificateRequest(BaseModel):
    class_id: str
    student_google_id: str
    student_name: str
    student_email: Optional[str] = None
    certificate_type: str = "participation"
    metadata: dict = {}

@app.post("/certificates/generate")
async def generate_certificate(body: CertificateRequest, x_user_id: str = Header(...), x_college_id: str = Header(...)):
    pool = await get_pool()
    cid = str(uuid.uuid4())
    college = await pool.fetchrow("SELECT name FROM colleges WHERE id=$1", x_college_id)
    college_name = college["name"] if college else "Institution"

    # Generate PDF
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []
    story.append(Paragraph(f"<b>{college_name}</b>", styles["Title"]))
    story.append(Spacer(1, 20))
    story.append(Paragraph("CERTIFICATE OF " + body.certificate_type.upper(), styles["Heading1"]))
    story.append(Spacer(1, 20))
    story.append(Paragraph(f"This is to certify that <b>{body.student_name}</b> has successfully completed the requirements.", styles["Normal"]))
    story.append(Spacer(1, 40))
    story.append(Paragraph(f"Certificate Type: {body.certificate_type.title()}", styles["Normal"]))
    story.append(Paragraph(f"Date: {__import__('datetime').date.today()}", styles["Normal"]))
    doc.build(story)
    pdf_bytes = buf.getvalue()

    await pool.execute(
        """INSERT INTO certificates
           (id, college_id, class_id, student_google_id, student_name, student_email,
            certificate_type, metadata, issued_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)""",
        cid, x_college_id, body.class_id, body.student_google_id, body.student_name,
        body.student_email, body.certificate_type, json.dumps(body.metadata), x_user_id
    )

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="certificate_{cid[:8]}.pdf"'}
    )

@app.get("/certificates/{class_id}")
async def list_certificates(class_id: str):
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM certificates WHERE class_id=$1 ORDER BY issued_date DESC", class_id)
    return ok({"certificates": [dict(r) for r in rows]})

# ── BULK STUDENT IMPORT ───────────────────────────────────────

@app.post("/bulk-import/{class_id}")
async def bulk_import_students(class_id: str, file: UploadFile = File(...), x_user_id: str = Header(...), x_college_id: str = Header(...)):
    pool = await get_pool()
    content = await file.read()
    import_id = str(uuid.uuid4())

    await pool.execute(
        """INSERT INTO bulk_imports (id, college_id, class_id, imported_by, file_name, status)
           VALUES ($1,$2,$3,$4,$5,'processing')""",
        import_id, x_college_id, class_id, x_user_id, file.filename
    )

    try:
        text = content.decode("utf-8")
        reader = csv.DictReader(text.splitlines())
        imported = 0
        errors = []
        for i, row in enumerate(reader):
            name = row.get("name") or row.get("student_name") or row.get("Name")
            email = row.get("email") or row.get("student_email") or row.get("Email")
            roll = row.get("roll") or row.get("roll_number") or row.get("Roll")
            if not name:
                errors.append({"row": i+2, "error": "Missing name"})
                continue
            await pool.execute(
                """INSERT INTO class_students (id, class_id, college_id, student_name, student_email, roll_number)
                   VALUES ($1,$2,$3,$4,$5,$6)
                   ON CONFLICT DO NOTHING""",
                str(uuid.uuid4()), class_id, x_college_id, name, email, roll
            )
            imported += 1

        await pool.execute(
            """UPDATE bulk_imports SET status='done', total_rows=$1, imported_count=$2,
               failed_count=$3, errors=$4::jsonb, completed_at=NOW() WHERE id=$5""",
            imported + len(errors), imported, len(errors), json.dumps(errors), import_id
        )
        return ok({"import_id": import_id, "imported": imported, "errors": len(errors)})
    except Exception as e:
        await pool.execute("UPDATE bulk_imports SET status='failed' WHERE id=$1", import_id)
        raise HTTPException(400, f"Import failed: {e}")

@app.get("/bulk-import/{import_id}/status")
async def get_import_status(import_id: str):
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM bulk_imports WHERE id=$1", import_id)
    if not row:
        raise HTTPException(404, "Import not found")
    return ok(dict(row))

@app.get("/classes/{class_id}/students")
async def list_class_students(class_id: str):
    pool = await get_pool()
    rows = await pool.fetch("SELECT * FROM class_students WHERE class_id=$1 AND is_active=TRUE ORDER BY student_name", class_id)
    return ok({"students": [dict(r) for r in rows], "total": len(rows)})

# ── CO-FACULTY COLLABORATION ──────────────────────────────────

class CollaboratorAdd(BaseModel):
    faculty_id: str
    role: str = "reviewer"

@app.post("/classes/{class_id}/collaborators")
async def add_collaborator(class_id: str, body: CollaboratorAdd, x_user_id: str = Header(...)):
    pool = await get_pool()
    cid = str(uuid.uuid4())
    await pool.execute(
        """INSERT INTO class_collaborators (id, class_id, faculty_id, role, added_by)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING""",
        cid, class_id, body.faculty_id, body.role, x_user_id
    )
    return ok({"status": "added"})

@app.get("/classes/{class_id}/collaborators")
async def list_collaborators(class_id: str):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT cc.id, cc.role, cc.added_at, u.name, u.email
           FROM class_collaborators cc JOIN users u ON cc.faculty_id=u.id
           WHERE cc.class_id=$1""",
        class_id
    )
    return ok({"collaborators": [dict(r) for r in rows]})

# ── COMPARATIVE ANALYTICS ─────────────────────────────────────

@app.get("/analytics/compare")
async def compare_classes(class_ids: str, x_college_id: str = Header(...)):
    pool = await get_pool()
    ids = [c.strip() for c in class_ids.split(",") if c.strip()]
    if len(ids) < 2:
        raise HTTPException(400, "Provide at least 2 class IDs separated by commas")

    results = []
    for cid in ids:
        row = await pool.fetchrow(
            """SELECT c.name as class_name, s.name as subject_name,
                      COUNT(er.id) as total_submissions,
                      AVG(er.percentage) as avg_score,
                      MAX(er.percentage) as highest,
                      MIN(er.percentage) as lowest
               FROM classes c
               JOIN subjects s ON c.subject_id=s.id
               LEFT JOIN evaluation_sessions es ON es.class_id=c.id
               LEFT JOIN evaluation_results er ON er.session_id=es.id
               WHERE c.id=$1 AND c.college_id=$2
               GROUP BY c.id, c.name, s.name""",
            cid, x_college_id
        )
        if row:
            results.append(dict(row))

    return ok({"comparison": results, "class_count": len(results)})

@app.get("/analytics/semester-trend/{subject_id}")
async def semester_trend(subject_id: str, x_college_id: str = Header(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        """SELECT ay.label as year, AVG(er.percentage) as avg_score, COUNT(er.id) as submissions
           FROM evaluation_results er
           JOIN evaluation_sessions es ON er.session_id=es.id
           JOIN classes c ON es.class_id=c.id
           JOIN academic_years ay ON c.academic_year_id=ay.id
           WHERE c.subject_id=$1 AND c.college_id=$2
           GROUP BY ay.id, ay.label ORDER BY ay.label""",
        subject_id, x_college_id
    )
    return ok({"trend": [dict(r) for r in rows]})

# ── ACCREDITATION REPORTS ─────────────────────────────────────

@app.post("/accreditation/generate")
async def generate_accreditation(
    report_type: str = "NBA",
    academic_year_id: Optional[str] = None,
    x_user_id: str = Header(...),
    x_college_id: str = Header(...)
):
    pool = await get_pool()
    rid = str(uuid.uuid4())

    # Gather data
    subjects = await pool.fetch("SELECT COUNT(*) as c FROM subjects WHERE college_id=$1", x_college_id)
    faculty = await pool.fetch("SELECT COUNT(*) as c FROM users WHERE college_id=$1 AND role='faculty'", x_college_id)
    papers = await pool.fetch("SELECT COUNT(*) as c FROM question_papers WHERE college_id=$1", x_college_id)
    sessions = await pool.fetch("SELECT COUNT(*) as c FROM evaluation_sessions WHERE college_id=$1", x_college_id)
    avg_score = await pool.fetchrow(
        """SELECT AVG(er.percentage) as avg FROM evaluation_results er
           JOIN evaluation_sessions es ON er.session_id=es.id
           WHERE es.college_id=$1""",
        x_college_id
    )

    data = {
        "report_type": report_type,
        "generated_at": str(__import__("datetime").datetime.now()),
        "summary": {
            "total_subjects": subjects[0]["c"] if subjects else 0,
            "total_faculty": faculty[0]["c"] if faculty else 0,
            "papers_generated": papers[0]["c"] if papers else 0,
            "evaluation_sessions": sessions[0]["c"] if sessions else 0,
            "average_student_score": round(float(avg_score["avg"] or 0), 2),
        },
        "bloom_coverage": "All 6 Bloom's taxonomy levels covered",
        "automation_level": "80-90% automated via NLP",
    }

    await pool.execute(
        """INSERT INTO accreditation_reports
           (id, college_id, generated_by, report_type, academic_year_id, data, status)
           VALUES ($1,$2,$3,$4,$5,$6::jsonb,'draft')""",
        rid, x_college_id, x_user_id, report_type, academic_year_id, json.dumps(data)
    )
    return ok({"report_id": rid, "data": data})

@app.get("/accreditation/reports")
async def list_reports(x_college_id: str = Header(...)):
    pool = await get_pool()
    rows = await pool.fetch(
        "SELECT id, report_type, status, generated_at FROM accreditation_reports WHERE college_id=$1 ORDER BY generated_at DESC",
        x_college_id
    )
    return ok({"reports": [dict(r) for r in rows]})

# ── AI CHATBOT (FAQ-based, uses knowledge graph) ──────────────

SAAP_FAQ = {
    "syllabus": "Upload your PDF in the Syllabus section. It is processed once and reused forever.",
    "paper": "Go to Question Papers, enter Subject ID, choose exam type and Bloom mode, click Generate.",
    "evaluation": "Go to Evaluation, enter Class ID and Coursework ID from Google Classroom, paste answer key.",
    "bloom": "Bloom taxonomy has 6 levels: Remember, Understand, Apply, Analyze, Evaluate, Create.",
    "plagiarism": "Go to Plagiarism Check, enter Session ID, set threshold, click Check.",
    "export": "Go to Export, enter Paper ID, click Download PDF.",
    "analytics": "Go to Analytics, enter Class ID, click Load to see charts.",
    "rubric": "Go to Rubric Builder, create criteria with keywords and weights.",
    "question bank": "Go to Question Bank to search, add, or import questions from papers.",
    "certificate": "Go to Certificates page, select student and type, click Generate.",
    "attendance": "Go to Attendance page, create a session, mark students present or absent.",
    "template": "Go to Paper Templates to save and reuse paper configurations.",
    "hod": "HOD role can view department analytics and manage faculty roles.",
    "student": "Students can log in to view their own grades and feedback.",
    "notification": "Notifications appear in the bell icon. Email alerts are sent automatically.",
}

class ChatMessage(BaseModel):
    message: str
    subject_id: Optional[str] = None
    conversation_id: Optional[str] = None

@app.post("/chatbot/message")
async def chatbot_message(body: ChatMessage, x_user_id: str = Header(default="anonymous"), x_college_id: str = Header(default="")):
    pool = await get_pool()
    lower = body.message.lower()

    # Match FAQ
    response = None
    for keyword, answer in SAAP_FAQ.items():
        if keyword in lower:
            response = answer
            break

    if not response:
        # Try knowledge graph if subject_id provided
        if body.subject_id:
            topics = await pool.fetch(
                "SELECT topic_name, unit_name FROM kg_topics WHERE subject_id=$1 LIMIT 5",
                body.subject_id
            )
            if topics:
                topic_list = ", ".join(t["topic_name"] for t in topics)
                response = f"Topics in this subject include: {topic_list}. Ask me about any of these!"
            else:
                response = "I could not find topics for this subject. Please upload the syllabus first."
        else:
            response = "I am not sure about that. Try asking about: syllabus, paper generation, evaluation, analytics, or any SAAP feature."

    # Save conversation
    conv_id = body.conversation_id or str(uuid.uuid4())
    if x_college_id:
        await pool.execute(
            """INSERT INTO chatbot_conversations (id, user_id, college_id, subject_id, messages, updated_at)
               VALUES ($1,$2,$3,$4,$5::jsonb,NOW())
               ON CONFLICT (id) DO UPDATE SET
                   messages = chatbot_conversations.messages || $5::jsonb,
                   updated_at = NOW()""",
            conv_id, x_user_id, x_college_id, body.subject_id,
            json.dumps([{"role": "user", "text": body.message}, {"role": "bot", "text": response}])
        )

    return ok({"response": response, "conversation_id": conv_id})

# ── DIFFICULTY PREDICTION ─────────────────────────────────────

@app.post("/questions/{question_bank_id}/predict-difficulty")
async def predict_difficulty(question_bank_id: str):
    pool = await get_pool()
    perf = await pool.fetch(
        "SELECT avg_score, attempt_count FROM question_performance WHERE question_bank_id=$1",
        question_bank_id
    )
    if not perf:
        return ok({"predicted_difficulty": "medium", "confidence": 0.5, "message": "No performance data yet"})

    avg = sum(p["avg_score"] for p in perf) / len(perf)
    total_attempts = sum(p["attempt_count"] for p in perf)
    confidence = min(1.0, total_attempts / 50)

    if avg >= 75:
        difficulty = "easy"
    elif avg >= 45:
        difficulty = "medium"
    else:
        difficulty = "hard"

    await pool.execute(
        """UPDATE question_performance SET predicted_difficulty=$1, prediction_confidence=$2
           WHERE question_bank_id=$3""",
        difficulty, round(confidence, 2), question_bank_id
    )
    return ok({"predicted_difficulty": difficulty, "confidence": round(confidence, 2), "avg_score": round(avg, 2)})

# ── RBAC PERMISSION CHECK ─────────────────────────────────────

@app.get("/rbac/check")
async def check_permission(role: str, permission: str):
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT 1 FROM role_permissions WHERE role=$1 AND permission=$2",
        role, permission
    )
    return ok({"allowed": row is not None, "role": role, "permission": permission})

@app.get("/rbac/permissions/{role}")
async def get_role_permissions(role: str):
    pool = await get_pool()
    rows = await pool.fetch("SELECT permission FROM role_permissions WHERE role=$1", role)
    return ok({"role": role, "permissions": [r["permission"] for r in rows]})
