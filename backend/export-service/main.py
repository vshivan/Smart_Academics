"""
Export Service — Feature 3: PDF Export of Question Papers
Generates formatted PDFs with header, instructions, answer key sheet.
"""
import os, io, uuid, logging
import sys, os as _os
sys.path.insert(0, _os.path.join(_os.path.dirname(__file__), "..", "shared"))
from response import ok, fail
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException, Header
from fastapi.responses import StreamingResponse
import asyncpg
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)
try:
    from monitoring import init_sentry; init_sentry("export-service")
except ImportError:
    pass

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://saap:saap_pass@postgres:5432/saap_db")
_pool = None

async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=5)
    return _pool

@asynccontextmanager
async def lifespan(app: FastAPI):
    global _pool
    _pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=5)
    yield
    await _pool.close()

app = FastAPI(title="Export Service", version="1.0.0", lifespan=lifespan)

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
    return ok({"status": "ok", "service": "export-service"})


@app.get("/papers/{paper_id}/export/pdf")
async def export_paper_pdf(
    paper_id: str,
    include_answers: bool = False,
    x_college_id: str = Header(...),
):
    """Generate and stream a formatted PDF of the question paper."""
    pool = await get_pool()

    paper = await pool.fetchrow("SELECT * FROM question_papers WHERE id=$1", paper_id)
    if not paper:
        raise HTTPException(404, "Paper not found")

    questions = await pool.fetch(
        "SELECT * FROM questions WHERE paper_id=$1 ORDER BY order_index", paper_id
    )

    # Fetch college info for header
    college = await pool.fetchrow("SELECT name FROM colleges WHERE id=$1", x_college_id)
    college_name = college["name"] if college else "Institution"

    # Fetch subject info
    subject = await pool.fetchrow("SELECT name, code FROM subjects WHERE id=$1", paper["subject_id"])
    subject_name = subject["name"] if subject else "Subject"
    subject_code = subject["code"] if subject else ""

    pdf_bytes = _build_pdf(
        paper=dict(paper),
        questions=[dict(q) for q in questions],
        college_name=college_name,
        subject_name=subject_name,
        subject_code=subject_code,
        include_answers=include_answers,
    )

    filename = f"paper_{paper['paper_set']}_{paper['exam_type']}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


def _build_pdf(paper, questions, college_name, subject_name, subject_code, include_answers):
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )
    styles = getSampleStyleSheet()
    story = []

    # ── Header ────────────────────────────────────────────────
    header_style = ParagraphStyle("header", parent=styles["Normal"],
                                   fontSize=14, fontName="Helvetica-Bold",
                                   alignment=TA_CENTER, spaceAfter=4)
    sub_style = ParagraphStyle("sub", parent=styles["Normal"],
                                fontSize=11, alignment=TA_CENTER, spaceAfter=2)
    meta_style = ParagraphStyle("meta", parent=styles["Normal"],
                                 fontSize=10, alignment=TA_CENTER, spaceAfter=8)

    story.append(Paragraph(college_name.upper(), header_style))
    story.append(Paragraph(f"{subject_name} ({subject_code})", sub_style))
    story.append(Paragraph(
        f"{paper['exam_type'].title()} Examination — Set {paper['paper_set']}",
        sub_style
    ))

    # Meta row
    meta_data = [
        ["Total Marks:", str(paper["total_marks"]),
         "Duration:", f"{paper['duration_minutes']} min",
         "Date:", "___________"],
    ]
    meta_table = Table(meta_data, colWidths=[3*cm, 2.5*cm, 2.5*cm, 2.5*cm, 2*cm, 3*cm])
    meta_table.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTNAME", (2,0), (2,-1), "Helvetica-Bold"),
        ("FONTNAME", (4,0), (4,-1), "Helvetica-Bold"),
    ]))
    story.append(meta_table)
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.black))
    story.append(Spacer(1, 0.3*cm))

    # Instructions
    if paper.get("instructions"):
        inst_style = ParagraphStyle("inst", parent=styles["Normal"], fontSize=9,
                                     fontName="Helvetica-Oblique", spaceAfter=8)
        story.append(Paragraph(f"Instructions: {paper['instructions']}", inst_style))

    # ── Questions ─────────────────────────────────────────────
    q_style = ParagraphStyle("q", parent=styles["Normal"], fontSize=10,
                               spaceAfter=6, leading=14)
    mark_style = ParagraphStyle("mark", parent=styles["Normal"], fontSize=9,
                                  alignment=TA_RIGHT, textColor=colors.grey)

    # Group by type
    sections = {}
    for q in questions:
        t = q.get("question_type", "short")
        sections.setdefault(t, []).append(q)

    section_titles = {"mcq": "Section A — Multiple Choice", "short": "Section B — Short Answer",
                      "long": "Section C — Long Answer", "case_study": "Section D — Case Study"}

    q_num = 1
    for qtype, qs in sections.items():
        sec_style = ParagraphStyle("sec", parent=styles["Normal"], fontSize=11,
                                    fontName="Helvetica-Bold", spaceBefore=10, spaceAfter=4)
        story.append(Paragraph(section_titles.get(qtype, qtype.title()), sec_style))
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Spacer(1, 0.2*cm))

        for q in qs:
            row = Table(
                [[Paragraph(f"Q{q_num}. {q['question_text']}", q_style),
                  Paragraph(f"[{q['marks']} marks]", mark_style)]],
                colWidths=[14*cm, 3*cm]
            )
            row.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP")]))
            story.append(row)
            story.append(Spacer(1, 0.4*cm))
            q_num += 1

    # ── Answer Key (separate page) ────────────────────────────
    if include_answers:
        story.append(PageBreak())
        story.append(Paragraph("ANSWER KEY", header_style))
        story.append(HRFlowable(width="100%", thickness=1.5, color=colors.black))
        story.append(Spacer(1, 0.3*cm))

        ans_style = ParagraphStyle("ans", parent=styles["Normal"], fontSize=9,
                                    spaceAfter=8, leading=13,
                                    backColor=colors.Color(0.95, 0.98, 1.0))
        q_num = 1
        for q in questions:
            story.append(Paragraph(
                f"<b>Q{q_num}.</b> {q['question_text'][:80]}...<br/>"
                f"<i>Answer: {q.get('answer_key', 'N/A')}</i>",
                ans_style
            ))
            q_num += 1

    doc.build(story)
    return buf.getvalue()
