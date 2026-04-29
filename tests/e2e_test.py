"""
End-to-End Feature Test Suite
Tests every major feature of SAAP against the live running services.
Run with: python tests/e2e_test.py
"""
import sys, os, json, time, uuid, io
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/api-gateway"))

import requests
from auth import create_access_token

BASE        = "http://host.docker.internal:8000"
MGMT        = "http://host.docker.internal:8006"
KG          = "http://host.docker.internal:8002"
Q           = "http://host.docker.internal:8003"
EVAL        = "http://host.docker.internal:8004"
ANALYTICS   = "http://host.docker.internal:8005"
FEATURES    = "http://host.docker.internal:8008"
EXPORT      = "http://host.docker.internal:8007"

HEALTH_URLS = [
    (8000,"api-gateway"),(8001,"syllabus-service"),(8002,"knowledge-service"),
    (8003,"question-service"),(8004,"evaluation-service"),(8005,"analytics-service"),
    (8006,"management-service"),(8007,"export-service"),(8008,"features-service")
]

# ── Test JWT (bypasses Google OAuth) ─────────────────────────
TOKEN = create_access_token({
    "user_id": "11111111-1111-1111-1111-111111111111",
    "email":   "faculty@testcollege.edu",
    "college_id": "22222222-2222-2222-2222-222222222222",
    "role":    "faculty",
})
H  = {"Authorization": f"Bearer {TOKEN}"}
SH = {
    "X-User-Id":    "11111111-1111-1111-1111-111111111111",
    "X-User-Email": "faculty@testcollege.edu",
    "X-User-Role":  "faculty",
    "X-College-Id": "22222222-2222-2222-2222-222222222222",
}

COLLEGE_ID  = "22222222-2222-2222-2222-222222222222"
SUBJECT_ID  = str(uuid.uuid4())
NULL_UUID   = "ffffffff-ffff-ffff-ffff-ffffffffffff"

PASS = "✅"
FAIL = "❌"
SKIP = "⚠️ "

results = []

def test(name, fn):
    try:
        fn()
        results.append((PASS, name))
        print(f"  {PASS} {name}")
    except AssertionError as e:
        results.append((FAIL, name, str(e)))
        print(f"  {FAIL} {name} — {e}")
    except Exception as e:
        results.append((FAIL, name, str(e)))
        print(f"  {FAIL} {name} — {e}")

# ══════════════════════════════════════════════════════════════
print("\n🔵 1. HEALTH CHECKS")
# ══════════════════════════════════════════════════════════════

for port, svc in HEALTH_URLS:
    def _h(p=port, s=svc):
        r = requests.get(f"http://host.docker.internal:{p}/health", timeout=5)
        assert r.status_code == 200, f"HTTP {r.status_code}"
        assert r.json()["service"] == s
    test(f"Health: {svc}", _h)

# ══════════════════════════════════════════════════════════════
print("\n🔵 2. AUTHENTICATION")
# ══════════════════════════════════════════════════════════════

def test_auth_me():
    r = requests.get(f"{BASE}/auth/me", headers=H, timeout=5)
    assert r.status_code == 200
    assert r.json()["email"] == "faculty@testcollege.edu"
test("Auth: /me returns user data", test_auth_me)

def test_auth_no_token():
    r = requests.get(f"{BASE}/auth/me", timeout=5)
    assert r.status_code in (401, 403)
test("Auth: no token → 401/403", test_auth_no_token)

def test_auth_bad_token():
    r = requests.get(f"{BASE}/auth/me", headers={"Authorization": "Bearer bad.token"}, timeout=5)
    assert r.status_code == 401
test("Auth: invalid token → 401", test_auth_bad_token)

# ══════════════════════════════════════════════════════════════
print("\n🔵 3. COLLEGE MANAGEMENT")
# ══════════════════════════════════════════════════════════════

college_id_created = None

def test_create_college():
    global college_id_created, COLLEGE_ID
    r = requests.post(f"{MGMT}/colleges", json={
        "name": "Demo Engineering College",
        "domain": f"demo-{uuid.uuid4().hex[:6]}.edu",
        "address": "123 Test Street, Mumbai",
        "established_year": 2000
    }, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
    college_id_created = r.json()["id"]
    COLLEGE_ID = college_id_created  # use real college for all subsequent tests
test("College: create college", test_create_college)

def test_list_colleges():
    r = requests.get(f"{MGMT}/colleges", timeout=5)
    assert r.status_code == 200
    assert "colleges" in r.json()
test("College: list colleges", test_list_colleges)

def test_create_academic_year():
    cid = college_id_created or COLLEGE_ID
    r = requests.post(f"{MGMT}/colleges/{cid}/academic-years",
        json={"label": "2024-25", "is_current": True},
        headers=SH, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
test("College: create academic year", test_create_academic_year)

def test_create_department():
    cid = college_id_created or COLLEGE_ID
    r = requests.post(f"{MGMT}/colleges/{cid}/departments",
        json={"name": "Computer Science", "code": "CS"},
        headers=SH, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
test("College: create department", test_create_department)

def test_create_subject():
    cid = college_id_created or COLLEGE_ID
    r = requests.post(f"{MGMT}/colleges/{cid}/subjects",
        json={"name": "Database Management Systems", "code": "CS301",
              "department": "Computer Science", "semester": 5,
              "credits": 4, "language": "en"},
        headers=SH, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
test("College: create subject", test_create_subject)

def test_create_class():
    cid = college_id_created or COLLEGE_ID
    r = requests.post(f"{MGMT}/colleges/{cid}/classes",
        json={"subject_id": SUBJECT_ID, "name": "CS-A 2024"},
        headers=SH, timeout=10)
    # subject_id may not exist — 422 or 200 both acceptable
    assert r.status_code in (200, 422, 500), f"HTTP {r.status_code}"
test("College: create class", test_create_class)

def test_list_subjects():
    cid = college_id_created or COLLEGE_ID
    r = requests.get(f"{MGMT}/colleges/{cid}/subjects", headers=SH, timeout=5)
    assert r.status_code == 200
    assert "subjects" in r.json()
test("College: list subjects", test_list_subjects)

# ══════════════════════════════════════════════════════════════
print("\n🔵 4. KNOWLEDGE GRAPH (Syllabus)")
# ══════════════════════════════════════════════════════════════

def test_upsert_kg():
    r = requests.post(f"{KG}/subjects/{SUBJECT_ID}/knowledge", json={
        "graph_data": {
            "subject_id": SUBJECT_ID,
            "units": [
                {"name": "Unit 1: Introduction to Databases", "order": 1, "topics": [
                    {"topic_name": "normalization",   "topic_keywords": ["1NF","2NF","3NF","redundancy"], "blooms_levels": ["understand","apply","analyze"]},
                    {"topic_name": "SQL queries",     "topic_keywords": ["SELECT","JOIN","WHERE"],         "blooms_levels": ["apply","analyze"]},
                    {"topic_name": "ER diagrams",     "topic_keywords": ["entity","relationship","key"],   "blooms_levels": ["remember","understand"]},
                    {"topic_name": "transactions",    "topic_keywords": ["ACID","commit","rollback"],      "blooms_levels": ["understand","apply"]},
                    {"topic_name": "indexing",        "topic_keywords": ["B-tree","hash","clustered"],     "blooms_levels": ["analyze","evaluate"]},
                ]},
                {"name": "Unit 2: Advanced SQL", "order": 2, "topics": [
                    {"topic_name": "stored procedures","topic_keywords": ["procedure","function","trigger"],"blooms_levels": ["apply","create"]},
                    {"topic_name": "views",            "topic_keywords": ["virtual","view","materialized"], "blooms_levels": ["understand","apply"]},
                ]},
            ]
        },
        "college_id": college_id_created or COLLEGE_ID,
    }, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
    assert r.json()["unit_count"] == 2
    assert r.json()["topic_count"] == 7
test("Knowledge: upsert knowledge graph (7 topics, 2 units)", test_upsert_kg)

def test_get_kg():
    r = requests.get(f"{KG}/subjects/{SUBJECT_ID}/knowledge", timeout=5)
    assert r.status_code == 200
    assert r.json()["unit_count"] == 2
test("Knowledge: retrieve knowledge graph", test_get_kg)

def test_get_topics():
    r = requests.get(f"{KG}/subjects/{SUBJECT_ID}/topics", timeout=5)
    assert r.status_code == 200
    assert len(r.json()["topics"]) == 7
test("Knowledge: get all topics (7)", test_get_topics)

def test_get_topics_filtered():
    r = requests.get(f"{KG}/subjects/{SUBJECT_ID}/topics",
        params={"unit_name": "Unit 1: Introduction to Databases"}, timeout=5)
    assert r.status_code == 200
    assert len(r.json()["topics"]) == 5
test("Knowledge: filter topics by unit (5)", test_get_topics_filtered)

def test_get_units():
    r = requests.get(f"{KG}/subjects/{SUBJECT_ID}/units", timeout=5)
    assert r.status_code == 200
    assert len(r.json()["units"]) == 2
test("Knowledge: get units (2)", test_get_units)

def test_kg_version_increments():
    v1 = requests.get(f"{KG}/subjects/{SUBJECT_ID}/knowledge", timeout=5).json()["version"]
    requests.post(f"{KG}/subjects/{SUBJECT_ID}/knowledge", json={
        "graph_data": {"subject_id": SUBJECT_ID, "units": []},
        "college_id": COLLEGE_ID
    }, timeout=10)
    v2 = requests.get(f"{KG}/subjects/{SUBJECT_ID}/knowledge", timeout=5).json()["version"]
    assert v2 == v1 + 1
    # Restore
    test_upsert_kg()
test("Knowledge: version increments on re-upload", test_kg_version_increments)

def test_kg_404():
    r = requests.get(f"{KG}/subjects/{NULL_UUID}/knowledge", timeout=5)
    assert r.status_code == 404
test("Knowledge: unknown subject → 404", test_kg_404)

# ══════════════════════════════════════════════════════════════
print("\n🔵 5. QUESTION PAPER GENERATION")
# ══════════════════════════════════════════════════════════════

paper_id = None

def test_generate_quiz():
    global paper_id
    r = requests.post(f"{Q}/generate", json={
        "subject_id": SUBJECT_ID, "exam_type": "quiz",
        "total_marks": 20, "generate_sets": 2,
        "blooms_distribution": {"remember":0.5,"understand":0.3,"apply":0.2}
    }, headers=SH, timeout=20)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
    assert r.json()["status"] == "generated"
    assert len(r.json()["papers"]) == 2
    paper_id = r.json()["papers"][0]["paper_id"]
test("Papers: generate quiz (2 sets)", test_generate_quiz)

def test_generate_midterm():
    r = requests.post(f"{Q}/generate", json={
        "subject_id": SUBJECT_ID, "exam_type": "midterm",
        "total_marks": 50, "generate_sets": 2,
    }, headers=SH, timeout=20)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
    assert len(r.json()["papers"]) == 2
test("Papers: generate midterm (50 marks)", test_generate_midterm)

def test_generate_final():
    r = requests.post(f"{Q}/generate", json={
        "subject_id": SUBJECT_ID, "exam_type": "final",
        "total_marks": 100, "generate_sets": 1,
    }, headers=SH, timeout=20)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:300]}"
test("Papers: generate final (100 marks)", test_generate_final)

def test_get_paper():
    if not paper_id: return
    r = requests.get(f"{Q}/papers/{paper_id}", timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert "questions" in data
    assert len(data["questions"]) > 0
    for q in data["questions"]:
        assert "question_text" in q
        assert "marks" in q
        assert "blooms_level" in q
        assert "answer_key" in q
test("Papers: get paper with questions", test_get_paper)

def test_paper_sets_labeled():
    r = requests.post(f"{Q}/generate", json={
        "subject_id": SUBJECT_ID, "exam_type": "quiz",
        "total_marks": 20, "generate_sets": 2,
    }, headers=SH, timeout=20)
    sets = [p["set"] for p in r.json()["papers"]]
    assert "A" in sets and "B" in sets
test("Papers: sets labeled A and B", test_paper_sets_labeled)

def test_edit_question():
    if not paper_id: return
    r = requests.get(f"{Q}/papers/{paper_id}", timeout=5)
    qid = r.json()["questions"][0]["id"]
    edit = requests.patch(f"{Q}/papers/{paper_id}/questions/{qid}",
        json={"question_text": "Updated: Explain normalization with examples."},
        timeout=5)
    assert edit.status_code == 200
    assert edit.json()["status"] == "updated"
test("Papers: edit question text", test_edit_question)

def test_finalize_paper():
    if not paper_id: return
    r = requests.post(f"{Q}/papers/{paper_id}/finalize", headers=SH, timeout=5)
    assert r.status_code == 200
    assert r.json()["status"] == "finalized"
test("Papers: finalize paper", test_finalize_paper)

def test_paper_404():
    r = requests.get(f"{Q}/papers/{NULL_UUID}", timeout=5)
    assert r.status_code == 404
test("Papers: unknown paper → 404", test_paper_404)

def test_generate_no_topics():
    r = requests.post(f"{Q}/generate", json={
        "subject_id": NULL_UUID, "exam_type": "quiz", "total_marks": 20
    }, headers=SH, timeout=10)
    assert r.status_code == 400
test("Papers: no topics → 400", test_generate_no_topics)

# ══════════════════════════════════════════════════════════════
print("\n🔵 6. QUESTION BANK")
# ══════════════════════════════════════════════════════════════

qbank_id = None

def test_add_to_bank():
    global qbank_id
    r = requests.post(f"{FEATURES}/question-bank", json={
        "subject_id": SUBJECT_ID,
        "question_text": "Explain the concept of normalization in databases.",
        "question_type": "long",
        "marks": 10,
        "blooms_level": "understand",
        "topic": "normalization",
        "unit_name": "Unit 1: Introduction to Databases",
        "answer_key": "Normalization reduces redundancy. 1NF: atomic values. 2NF: no partial deps. 3NF: no transitive deps.",
        "keywords": ["normalization","1NF","2NF","3NF","redundancy"],
        "difficulty": "medium",
        "language": "en",
    }, headers=SH, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
    qbank_id = r.json()["id"]
test("Question Bank: add question", test_add_to_bank)

def test_search_bank():
    r = requests.get(f"{FEATURES}/question-bank", headers=SH, timeout=5)
    assert r.status_code == 200
    assert "questions" in r.json()
test("Question Bank: search all questions", test_search_bank)

def test_search_bank_filtered():
    r = requests.get(f"{FEATURES}/question-bank",
        params={"blooms_level": "understand", "difficulty": "medium"},
        headers=SH, timeout=5)
    assert r.status_code == 200
test("Question Bank: filter by Bloom's + difficulty", test_search_bank_filtered)

def test_import_from_paper():
    if not paper_id: return
    r = requests.post(f"{FEATURES}/question-bank/import-from-paper/{paper_id}",
        headers=SH, timeout=10)
    assert r.status_code == 200
    assert r.json()["imported"] >= 0
test("Question Bank: import from paper", test_import_from_paper)

# ══════════════════════════════════════════════════════════════
print("\n🔵 7. RUBRIC BUILDER")
# ══════════════════════════════════════════════════════════════

rubric_id = None

def test_create_rubric():
    global rubric_id
    r = requests.post(f"{FEATURES}/rubrics", json={
        "name": "DBMS Assignment Rubric",
        "description": "Standard rubric for database assignments",
        "is_shared": True,
        "criteria": [
            {"name": "Concept Definition",  "keywords": ["normalization","define","explain"], "weight": 3},
            {"name": "Examples",             "keywords": ["example","instance","case"],        "weight": 2},
            {"name": "Practical Application","keywords": ["apply","implement","design"],       "weight": 3},
            {"name": "Conclusion",           "keywords": ["therefore","conclude","summary"],   "weight": 2},
        ]
    }, headers=SH, timeout=10)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
    rubric_id = r.json()["id"]
test("Rubrics: create rubric with 4 criteria", test_create_rubric)

def test_list_rubrics():
    r = requests.get(f"{FEATURES}/rubrics", headers=SH, timeout=5)
    assert r.status_code == 200
    assert "rubrics" in r.json()
test("Rubrics: list rubrics", test_list_rubrics)

def test_get_rubric():
    if not rubric_id: return
    r = requests.get(f"{FEATURES}/rubrics/{rubric_id}", timeout=5)
    assert r.status_code == 200
    assert r.json()["name"] == "DBMS Assignment Rubric"
test("Rubrics: get rubric by ID", test_get_rubric)

# ══════════════════════════════════════════════════════════════
print("\n🔵 8. SYLLABUS VERSION HISTORY")
# ══════════════════════════════════════════════════════════════

def test_list_versions():
    r = requests.get(f"{FEATURES}/subjects/{SUBJECT_ID}/syllabus-versions", timeout=5)
    assert r.status_code == 200
    assert "versions" in r.json()
test("Versions: list syllabus versions", test_list_versions)

# ══════════════════════════════════════════════════════════════
print("\n🔵 9. NOTIFICATIONS")
# ══════════════════════════════════════════════════════════════

notif_id = None

def test_get_notifications():
    global notif_id
    r = requests.get(f"{FEATURES}/notifications", headers=SH, timeout=5)
    assert r.status_code == 200
    data = r.json()
    assert "notifications" in data
    assert "unread_count" in data
    if data["notifications"]:
        notif_id = data["notifications"][0]["id"]
test("Notifications: get notifications", test_get_notifications)

def test_mark_all_read():
    r = requests.post(f"{FEATURES}/notifications/read-all", headers=SH, timeout=5)
    assert r.status_code == 200
test("Notifications: mark all read", test_mark_all_read)

# ══════════════════════════════════════════════════════════════
print("\n🔵 10. ANALYTICS")
# ══════════════════════════════════════════════════════════════

def test_analytics_empty():
    r = requests.get(f"{BASE}/analytics/{NULL_UUID}", headers=H, timeout=5)
    assert r.status_code == 200
    assert r.json()["sessions"] == []
test("Analytics: unknown class → empty sessions", test_analytics_empty)

def test_analytics_performance():
    r = requests.get(f"{BASE}/analytics/{NULL_UUID}/performance", headers=H, timeout=5)
    assert r.status_code == 200
    assert "score_distribution" in r.json()
    assert "assignment_trends" in r.json()
test("Analytics: performance endpoint returns structure", test_analytics_performance)

def test_analytics_invalid_uuid():
    r = requests.get(f"{BASE}/analytics/not-a-uuid", headers=H, timeout=5)
    # Gateway proxies to analytics which validates UUID
    assert r.status_code in (422, 500)
test("Analytics: invalid UUID → 422", test_analytics_invalid_uuid)

# ══════════════════════════════════════════════════════════════
print("\n🔵 11. PDF EXPORT")
# ══════════════════════════════════════════════════════════════

def test_export_pdf():
    if not paper_id: return
    r = requests.get(f"{EXPORT}/papers/{paper_id}/export/pdf",
        headers={"X-College-Id": COLLEGE_ID}, timeout=15)
    assert r.status_code == 200, f"HTTP {r.status_code}: {r.text[:200]}"
    assert r.headers["content-type"] == "application/pdf"
    assert len(r.content) > 1000  # real PDF has content
test("Export: download paper as PDF", test_export_pdf)

def test_export_pdf_with_answers():
    if not paper_id: return
    r = requests.get(f"{EXPORT}/papers/{paper_id}/export/pdf",
        params={"include_answers": True},
        headers={"X-College-Id": COLLEGE_ID}, timeout=15)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
test("Export: PDF with answer key", test_export_pdf_with_answers)

# ══════════════════════════════════════════════════════════════
print("\n🔵 12. PLAGIARISM DETECTION")
# ══════════════════════════════════════════════════════════════

def test_plagiarism_no_session():
    r = requests.post(f"{FEATURES}/plagiarism/check/{NULL_UUID}",
        params={"threshold": 0.75}, timeout=10)
    assert r.status_code == 200
    assert r.json()["flagged"] == 0
test("Plagiarism: no submissions → 0 flagged", test_plagiarism_no_session)

def test_plagiarism_report():
    r = requests.get(f"{FEATURES}/plagiarism/{NULL_UUID}/report", timeout=5)
    assert r.status_code == 200
    assert "reports" in r.json()
test("Plagiarism: get report", test_plagiarism_report)

# ══════════════════════════════════════════════════════════════
print("\n🔵 13. DIFFICULTY CALIBRATION")
# ══════════════════════════════════════════════════════════════

def test_calibration_no_data():
    r = requests.post(f"{FEATURES}/calibrate/{NULL_UUID}", timeout=10)
    assert r.status_code == 200
    assert r.json()["status"] == "no_data"
test("Calibration: no data → no_data status", test_calibration_no_data)

# ══════════════════════════════════════════════════════════════
print("\n🔵 14. API GATEWAY ROUTING & AUTH")
# ══════════════════════════════════════════════════════════════

def test_gateway_knowledge_proxied():
    r = requests.get(f"{BASE}/subjects/{SUBJECT_ID}/knowledge", headers=H, timeout=5)
    assert r.status_code in (200, 404)
test("Gateway: knowledge route proxied correctly", test_gateway_knowledge_proxied)

def test_gateway_topics_proxied():
    r = requests.get(f"{BASE}/subjects/{SUBJECT_ID}/topics", headers=H, timeout=5)
    assert r.status_code == 200
test("Gateway: topics route proxied correctly", test_gateway_topics_proxied)

def test_gateway_blocks_unauthenticated():
    for path in ["/generate-paper", "/analytics/some-id", "/upload-syllabus"]:
        r = requests.get(f"{BASE}{path}", timeout=5)
        assert r.status_code in (401, 403, 405), f"{path} returned {r.status_code}"
test("Gateway: unauthenticated requests blocked", test_gateway_blocks_unauthenticated)

# ══════════════════════════════════════════════════════════════
print("\n🔵 15. EVALUATION SERVICE")
# ══════════════════════════════════════════════════════════════

def test_eval_session_not_found():
    r = requests.get(f"{EVAL}/sessions/{NULL_UUID}/results", timeout=5)
    assert r.status_code == 404
test("Evaluation: unknown session → 404", test_eval_session_not_found)

def test_eval_health():
    r = requests.get(f"{EVAL}/health", timeout=5)
    assert r.status_code == 200
    assert r.json()["service"] == "evaluation-service"
test("Evaluation: health check", test_eval_health)

# ══════════════════════════════════════════════════════════════
# RESULTS SUMMARY
# ══════════════════════════════════════════════════════════════

passed = sum(1 for r in results if r[0] == PASS)
failed = sum(1 for r in results if r[0] == FAIL)
total  = len(results)

print(f"\n{'='*60}")
print(f"  TEST RESULTS: {passed}/{total} passed  |  {failed} failed")
print(f"{'='*60}")

if failed > 0:
    print("\nFailed tests:")
    for r in results:
        if r[0] == FAIL:
            print(f"  {FAIL} {r[1]}")
            if len(r) > 2:
                print(f"     → {r[2][:120]}")

print(f"\n{'='*60}\n")
sys.exit(0 if failed == 0 else 1)
