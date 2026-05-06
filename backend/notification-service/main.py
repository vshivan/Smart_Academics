"""
Notification Service — Email + SMS + In-app
- Email via SMTP (Gmail/SendGrid)
- SMS via Twilio (optional)
- In-app notifications (already in features-service, extended here)
"""
import os, json, uuid, logging, smtplib
import sys, os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "shared"))
from response import ok, fail
from contextlib import asynccontextmanager
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, EmailStr
import asyncpg

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)
try:
    from monitoring import init_sentry; init_sentry("notification-service")
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://saap:saap_pass@postgres:5432/saap_db")
SMTP_HOST    = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT    = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER    = os.getenv("SMTP_USER", "")
SMTP_PASS    = os.getenv("SMTP_PASS", "")
FROM_EMAIL   = os.getenv("FROM_EMAIL", "noreply@saap.edu")
TWILIO_SID   = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM  = os.getenv("TWILIO_FROM_NUMBER", "")

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

app = FastAPI(title="Notification Service", version="1.0.0", lifespan=lifespan)

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
    return ok({"status": "ok", "service": "notification-service"})


# ── Email ─────────────────────────────────────────────────────

class EmailRequest(BaseModel):
    to_email: str
    subject: str
    body_html: str
    body_text: Optional[str] = None
    user_id: Optional[str] = None
    college_id: Optional[str] = None
    notification_type: Optional[str] = None


def _send_smtp(to_email: str, subject: str, body_html: str, body_text: str = None):
    """Send email via SMTP. Returns True on success."""
    if not SMTP_USER or not SMTP_PASS:
        logger.warning("SMTP not configured — email skipped")
        return False
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = FROM_EMAIL
        msg["To"]      = to_email
        if body_text:
            msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"SMTP error: {e}")
        return False


@app.post("/email/send")
async def send_email(body: EmailRequest, background_tasks: BackgroundTasks):
    pool = await get_pool()

    # Create in-app notification record
    nid = str(uuid.uuid4())
    if body.user_id and body.college_id:
        await pool.execute(
            """INSERT INTO notifications
               (id, user_id, college_id, type, title, message, email_template)
               VALUES ($1,$2,$3,$4,$5,$6,$7)""",
            nid, body.user_id, body.college_id,
            body.notification_type or "email",
            body.subject, body.body_text or body.subject,
            body.notification_type
        )

    # Send email in background
    background_tasks.add_task(_send_and_log, pool, nid, body)
    return ok({"status": "queued", "notification_id": nid})


async def _send_and_log(pool, notification_id: str, body: EmailRequest):
    success = _send_smtp(body.to_email, body.subject, body.body_html, body.body_text)
    if notification_id:
        await pool.execute(
            "UPDATE notifications SET email_sent=$1, email_sent_at=NOW() WHERE id=$2",
            success, notification_id
        )


# ── Bulk email (e.g. notify all faculty when evaluation done) ─

class BulkEmailRequest(BaseModel):
    college_id: str
    role_filter: Optional[str] = None  # faculty | hod | admin | None = all
    subject: str
    body_html: str
    notification_type: str = "bulk"


@app.post("/email/bulk")
async def send_bulk_email(body: BulkEmailRequest, background_tasks: BackgroundTasks):
    pool = await get_pool()
    if body.role_filter:
        users = await pool.fetch(
            "SELECT id, email, name FROM users WHERE college_id=$1 AND role=$2 AND is_active=TRUE",
            body.college_id, body.role_filter
        )
    else:
        users = await pool.fetch(
            "SELECT id, email, name FROM users WHERE college_id=$1 AND is_active=TRUE",
            body.college_id
        )

    sent = 0
    for user in users:
        personalized = body.body_html.replace("{{name}}", user["name"] or "Faculty")
        background_tasks.add_task(
            _send_smtp, user["email"], body.subject, personalized
        )
        sent += 1

    return ok({"status": "queued", "recipients": sent})


# ── SMS ───────────────────────────────────────────────────────

class SMSRequest(BaseModel):
    to_phone: str
    message: str
    college_id: Optional[str] = None


@app.post("/sms/send")
async def send_sms(body: SMSRequest, background_tasks: BackgroundTasks):
    pool = await get_pool()
    log_id = str(uuid.uuid4())

    await pool.execute(
        """INSERT INTO sms_logs (id, college_id, recipient_phone, message, status)
           VALUES ($1,$2,$3,$4,'pending')""",
        log_id, body.college_id, body.to_phone, body.message
    )

    background_tasks.add_task(_send_sms_twilio, pool, log_id, body.to_phone, body.message)
    return ok({"status": "queued", "log_id": log_id})


async def _send_sms_twilio(pool, log_id: str, to_phone: str, message: str):
    if not TWILIO_SID or not TWILIO_TOKEN:
        logger.warning("Twilio not configured — SMS skipped")
        await pool.execute("UPDATE sms_logs SET status='skipped' WHERE id=$1", log_id)
        return
    try:
        from twilio.rest import Client
        client = Client(TWILIO_SID, TWILIO_TOKEN)
        msg = client.messages.create(body=message, from_=TWILIO_FROM, to=to_phone)
        await pool.execute(
            "UPDATE sms_logs SET status='sent', sent_at=NOW(), provider_response=$1::jsonb WHERE id=$2",
            json.dumps({"sid": msg.sid}), log_id
        )
    except Exception as e:
        logger.error(f"SMS error: {e}")
        await pool.execute(
            "UPDATE sms_logs SET status='failed', provider_response=$1::jsonb WHERE id=$2",
            json.dumps({"error": str(e)}), log_id
        )


# ── Parent SMS alerts ─────────────────────────────────────────

@app.post("/sms/notify-parents/{session_id}")
async def notify_parents(session_id: str, background_tasks: BackgroundTasks):
    """Send SMS to parents when evaluation results are published."""
    pool = await get_pool()
    session = await pool.fetchrow("SELECT * FROM evaluation_sessions WHERE id=$1", session_id)
    if not session:
        raise HTTPException(404, "Session not found")

    results = await pool.fetch(
        "SELECT student_email, student_name, marks_awarded, total_marks, percentage FROM evaluation_results WHERE session_id=$1",
        session_id
    )

    sent = 0
    for r in results:
        if not r["student_email"]:
            continue
        # Find parent contact
        parent = await pool.fetchrow(
            "SELECT parent_phone, parent_name FROM parent_contacts WHERE student_email=$1 AND is_active=TRUE",
            r["student_email"]
        )
        if parent and parent["parent_phone"]:
            msg = (
                f"Dear {parent['parent_name']}, "
                f"{r['student_name']} scored {r['marks_awarded']}/{r['total_marks']} "
                f"({r['percentage']:.1f}%) in {session['assignment_title']}. "
                f"- SAAP Academic System"
            )
            background_tasks.add_task(
                _send_sms_twilio, pool, str(uuid.uuid4()), parent["parent_phone"], msg
            )
            sent += 1

    return ok({"status": "queued", "parents_notified": sent})


# ── Notification templates ────────────────────────────────────

NOTIFICATION_TEMPLATES = {
    "syllabus_done": {
        "subject": "Syllabus Processing Complete — {subject_name}",
        "body_html": """<h2>Syllabus Processed Successfully</h2>
<p>Dear {faculty_name},</p>
<p>Your syllabus for <strong>{subject_name}</strong> has been processed.</p>
<ul><li>Units extracted: {unit_count}</li><li>Topics found: {topic_count}</li></ul>
<p>You can now generate question papers. <a href="{app_url}/dashboard/papers">Generate Paper →</a></p>""",
    },
    "evaluation_done": {
        "subject": "Evaluation Complete — {assignment_title}",
        "body_html": """<h2>Evaluation Complete</h2>
<p>Dear {faculty_name},</p>
<p>Evaluation for <strong>{assignment_title}</strong> is complete.</p>
<ul><li>Total submissions: {total}</li><li>Average score: {avg}%</li><li>Flagged for review: {flagged}</li></ul>
<p><a href="{app_url}/dashboard/evaluation">View Results →</a></p>""",
    },
    "paper_finalized": {
        "subject": "Question Paper Finalized — {paper_title}",
        "body_html": """<h2>Paper Finalized</h2>
<p>Dear {faculty_name},</p>
<p><strong>{paper_title}</strong> has been finalized and is ready for distribution.</p>
<p><a href="{app_url}/dashboard/export">Download PDF →</a></p>""",
    },
}


@app.post("/notify/syllabus-done")
async def notify_syllabus_done(
    user_id: str, college_id: str, user_email: str, user_name: str,
    subject_name: str, unit_count: int, topic_count: int,
    background_tasks: BackgroundTasks
):
    tmpl = NOTIFICATION_TEMPLATES["syllabus_done"]
    app_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    subject = tmpl["subject"].format(subject_name=subject_name)
    body = tmpl["body_html"].format(
        faculty_name=user_name, subject_name=subject_name,
        unit_count=unit_count, topic_count=topic_count, app_url=app_url
    )
    req = EmailRequest(
        to_email=user_email, subject=subject, body_html=body,
        user_id=user_id, college_id=college_id, notification_type="syllabus_done"
    )
    return await send_email(req, background_tasks)


@app.post("/notify/evaluation-done")
async def notify_evaluation_done(
    user_id: str, college_id: str, user_email: str, user_name: str,
    assignment_title: str, total: int, avg: float, flagged: int,
    background_tasks: BackgroundTasks
):
    tmpl = NOTIFICATION_TEMPLATES["evaluation_done"]
    app_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
    subject = tmpl["subject"].format(assignment_title=assignment_title)
    body = tmpl["body_html"].format(
        faculty_name=user_name, assignment_title=assignment_title,
        total=total, avg=round(avg, 1), flagged=flagged, app_url=app_url
    )
    req = EmailRequest(
        to_email=user_email, subject=subject, body_html=body,
        user_id=user_id, college_id=college_id, notification_type="evaluation_done"
    )
    return await send_email(req, background_tasks)
