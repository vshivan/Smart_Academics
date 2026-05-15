"""
Integration tests — hit live running services via HTTP.
Requires: docker-compose up (all services running on localhost).
"""
import os
import pytest
import requests

BASE = os.getenv("API_BASE",       "http://localhost:8000")
KG_BASE = os.getenv("KG_BASE",    "http://localhost:8002")
Q_BASE  = os.getenv("Q_BASE",     "http://localhost:8003")
EVAL_BASE = os.getenv("EVAL_BASE","http://localhost:8004")
ANALYTICS_BASE = os.getenv("ANALYTICS_BASE", "http://localhost:8005")

# Generate a test JWT directly (bypasses Google OAuth)
os.environ["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/api-gateway"))
from auth import create_access_token

TEST_TOKEN = create_access_token({
    "user_id": "test_user_001",
    "email": "faculty@testcollege.edu",
    "college_id": "22222222-2222-2222-2222-222222222222",
    "role": "faculty",
})
HEADERS = {"Authorization": f"Bearer {TEST_TOKEN}"}
SERVICE_HEADERS = {
    "X-User-Id": "11111111-1111-1111-1111-111111111111",
    "X-User-Email": "faculty@testcollege.edu",
    "X-User-Role": "faculty",
    "X-College-Id": "22222222-2222-2222-2222-222222222222",
}

SUBJECT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"


# ── Health Checks ─────────────────────────────────────────────

class TestHealthChecks:
    @pytest.mark.parametrize("url,service", [
        ("http://localhost:8000", "api-gateway"),
        ("http://localhost:8001", "syllabus-service"),
        ("http://localhost:8002", "knowledge-service"),
        ("http://localhost:8003", "question-service"),
        ("http://localhost:8004", "evaluation-service"),
        ("http://localhost:8005", "analytics-service"),
    ])
    def test_service_health(self, url, service):
        r = requests.get(f"{url}/health", timeout=5)
        assert r.status_code == 200
        data = r.json()
        # Handle both raw and enveloped responses
        status = data.get("data", {}).get("status") if data.get("data") else data.get("status")
        assert status == "ok"


# ── Auth ──────────────────────────────────────────────────────

class TestAuth:
    def test_me_endpoint_with_valid_token(self):
        r = requests.get(f"{BASE}/auth/me", headers=HEADERS, timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "faculty@testcollege.edu"
        assert data["role"] == "faculty"

    def test_me_endpoint_without_token_returns_403(self):
        r = requests.get(f"{BASE}/auth/me", timeout=5)
        assert r.status_code in (401, 403)

    def test_me_endpoint_with_invalid_token_returns_401(self):
        r = requests.get(f"{BASE}/auth/me",
                         headers={"Authorization": "Bearer invalid.token.here"}, timeout=5)
        assert r.status_code == 401

    def test_protected_route_without_auth_returns_401(self):
        r = requests.get(f"{BASE}/subjects/any_id/knowledge", timeout=5)
        assert r.status_code in (401, 403)


# ── Knowledge Graph ───────────────────────────────────────────

class TestKnowledgeGraphService:
    def test_upsert_knowledge_graph(self):
        payload = {
            "graph_data": {
                "subject_id": SUBJECT_ID,
                "units": [
                    {
                        "name": "Unit 1: Databases",
                        "order": 1,
                        "topics": [
                            {"topic_name": "normalization", "topic_keywords": ["1NF", "2NF", "3NF"], "blooms_levels": ["understand", "apply"]},
                            {"topic_name": "SQL queries",   "topic_keywords": ["SELECT", "JOIN"],     "blooms_levels": ["apply"]},
                        ],
                    },
                    {
                        "name": "Unit 2: Transactions",
                        "order": 2,
                        "topics": [
                            {"topic_name": "ACID properties", "topic_keywords": ["atomicity", "consistency"], "blooms_levels": ["remember", "understand"]},
                        ],
                    },
                ],
            },
            "college_id": "22222222-2222-2222-2222-222222222222",
        }
        r = requests.post(f"{KG_BASE}/subjects/{SUBJECT_ID}/knowledge", json=payload, timeout=10)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "stored"
        assert data["unit_count"] == 2
        assert data["topic_count"] == 3

    def test_get_knowledge_graph(self):
        r = requests.get(f"{KG_BASE}/subjects/{SUBJECT_ID}/knowledge", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert data["subject_id"] == SUBJECT_ID
        assert "graph" in data
        assert data["unit_count"] == 2

    def test_get_topics(self):
        r = requests.get(f"{KG_BASE}/subjects/{SUBJECT_ID}/topics", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert "topics" in data
        assert len(data["topics"]) == 3

    def test_get_topics_filtered_by_unit(self):
        r = requests.get(f"{KG_BASE}/subjects/{SUBJECT_ID}/topics",
                         params={"unit_name": "Unit 1: Databases"}, timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert len(data["topics"]) == 2

    def test_get_units(self):
        r = requests.get(f"{KG_BASE}/subjects/{SUBJECT_ID}/units", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert len(data["units"]) == 2

    def test_get_nonexistent_subject_returns_404(self):
        r = requests.get(f"{KG_BASE}/subjects/ffffffff-ffff-ffff-ffff-ffffffffffff/knowledge", timeout=5)
        assert r.status_code == 404

    def test_upsert_increments_version(self):
        # Get current version
        r1 = requests.get(f"{KG_BASE}/subjects/{SUBJECT_ID}/knowledge", timeout=5)
        v1 = r1.json()["version"]

        # Upsert again
        payload = {
            "graph_data": {"subject_id": SUBJECT_ID, "units": []},
            "college_id": "22222222-2222-2222-2222-222222222222",
        }
        requests.post(f"{KG_BASE}/subjects/{SUBJECT_ID}/knowledge", json=payload, timeout=10)

        r2 = requests.get(f"{KG_BASE}/subjects/{SUBJECT_ID}/knowledge", timeout=5)
        v2 = r2.json()["version"]
        assert v2 == v1 + 1


# ── Question Generation ───────────────────────────────────────

class TestQuestionService:
    @pytest.fixture(autouse=True)
    def ensure_knowledge_graph(self):
        """Seed knowledge graph before question tests."""
        payload = {
            "graph_data": {
                "subject_id": SUBJECT_ID,
                "units": [
                    {
                        "name": "Unit 1: Databases",
                        "order": 1,
                        "topics": [
                            {"topic_name": "normalization",  "topic_keywords": ["1NF", "2NF"], "blooms_levels": ["apply"]},
                            {"topic_name": "SQL queries",    "topic_keywords": ["SELECT"],     "blooms_levels": ["apply"]},
                            {"topic_name": "transactions",   "topic_keywords": ["ACID"],       "blooms_levels": ["understand"]},
                            {"topic_name": "indexing",       "topic_keywords": ["B-tree"],     "blooms_levels": ["analyze"]},
                            {"topic_name": "data models",    "topic_keywords": ["ER diagram"], "blooms_levels": ["remember"]},
                        ],
                    }
                ],
            },
            "college_id": "22222222-2222-2222-2222-222222222222",
        }
        requests.post(f"{KG_BASE}/subjects/{SUBJECT_ID}/knowledge", json=payload, timeout=10)

    def test_generate_paper_returns_two_sets(self):
        payload = {
            "subject_id": SUBJECT_ID,
            "exam_type": "quiz",
            "total_marks": 20,
            "generate_sets": 2,
        }
        r = requests.post(f"{Q_BASE}/generate", json=payload, headers=SERVICE_HEADERS, timeout=15)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "generated"
        assert len(data["papers"]) == 2

    def test_generated_paper_sets_are_labeled(self):
        payload = {"subject_id": SUBJECT_ID, "exam_type": "quiz", "total_marks": 20, "generate_sets": 2}
        r = requests.post(f"{Q_BASE}/generate", json=payload, headers=SERVICE_HEADERS, timeout=15)
        sets = [p["set"] for p in r.json()["papers"]]
        assert "A" in sets
        assert "B" in sets

    def test_get_paper_returns_questions(self):
        payload = {"subject_id": SUBJECT_ID, "exam_type": "quiz", "total_marks": 20, "generate_sets": 1}
        gen_r = requests.post(f"{Q_BASE}/generate", json=payload, headers=SERVICE_HEADERS, timeout=15)
        paper_id = gen_r.json()["papers"][0]["paper_id"]

        r = requests.get(f"{Q_BASE}/papers/{paper_id}", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert "questions" in data
        assert len(data["questions"]) > 0

    def test_questions_have_required_fields(self):
        payload = {"subject_id": SUBJECT_ID, "exam_type": "quiz", "total_marks": 20, "generate_sets": 1}
        gen_r = requests.post(f"{Q_BASE}/generate", json=payload, headers=SERVICE_HEADERS, timeout=15)
        paper_id = gen_r.json()["papers"][0]["paper_id"]

        r = requests.get(f"{Q_BASE}/papers/{paper_id}", timeout=5)
        for q in r.json()["questions"]:
            assert "question_text" in q
            assert "marks" in q
            assert "blooms_level" in q
            assert "topic" in q
            assert "answer_key" in q

    def test_edit_question(self):
        payload = {"subject_id": SUBJECT_ID, "exam_type": "quiz", "total_marks": 20, "generate_sets": 1}
        gen_r = requests.post(f"{Q_BASE}/generate", json=payload, headers=SERVICE_HEADERS, timeout=15)
        paper_id = gen_r.json()["papers"][0]["paper_id"]

        paper_r = requests.get(f"{Q_BASE}/papers/{paper_id}", timeout=5)
        question_id = paper_r.json()["questions"][0]["id"]

        edit_r = requests.patch(
            f"{Q_BASE}/papers/{paper_id}/questions/{question_id}",
            json={"question_text": "Updated question text for testing."},
            timeout=5,
        )
        assert edit_r.status_code == 200
        assert edit_r.json()["status"] == "updated"

    def test_finalize_paper(self):
        payload = {"subject_id": SUBJECT_ID, "exam_type": "quiz", "total_marks": 20, "generate_sets": 1}
        gen_r = requests.post(f"{Q_BASE}/generate", json=payload, headers=SERVICE_HEADERS, timeout=15)
        paper_id = gen_r.json()["papers"][0]["paper_id"]

        fin_r = requests.post(
            f"{Q_BASE}/papers/{paper_id}/finalize",
            headers=SERVICE_HEADERS, timeout=5
        )
        assert fin_r.status_code == 200
        assert fin_r.json()["status"] == "finalized"

    def test_get_nonexistent_paper_returns_404(self):
        r = requests.get(f"{Q_BASE}/papers/ffffffff-ffff-ffff-ffff-ffffffffffff", timeout=5)
        assert r.status_code == 404

    def test_generate_without_topics_returns_400(self):
        payload = {"subject_id": "ffffffff-ffff-ffff-ffff-ffffffffffff", "exam_type": "quiz", "total_marks": 20}
        r = requests.post(f"{Q_BASE}/generate", json=payload, headers=SERVICE_HEADERS, timeout=15)
        assert r.status_code == 400


# ── Evaluation Service ────────────────────────────────────────

class TestEvaluationService:
    def test_health(self):
        r = requests.get(f"{EVAL_BASE}/health", timeout=5)
        assert r.status_code == 200

    def test_session_not_found_returns_404(self):
        r = requests.get(f"{EVAL_BASE}/sessions/ffffffff-ffff-ffff-ffff-ffffffffffff/results", timeout=5)
        assert r.status_code == 404


# ── Analytics Service ─────────────────────────────────────────

class TestAnalyticsService:
    def test_analytics_for_unknown_class_returns_empty(self):
        r = requests.get(f"{ANALYTICS_BASE}/analytics/ffffffff-ffff-ffff-ffff-ffffffffffff", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert data["sessions"] == []

    def test_performance_for_unknown_class(self):
        r = requests.get(f"{ANALYTICS_BASE}/analytics/ffffffff-ffff-ffff-ffff-ffffffffffff/performance", timeout=5)
        assert r.status_code == 200
        data = r.json()
        assert "score_distribution" in data
        assert "assignment_trends" in data
        assert data["total_evaluated"] == 0


# ── API Gateway Routing ───────────────────────────────────────

class TestAPIGatewayRouting:
    def test_knowledge_route_proxied(self):
        r = requests.get(f"{BASE}/subjects/{SUBJECT_ID}/knowledge", headers=HEADERS, timeout=5)
        assert r.status_code in (200, 404)

    def test_topics_route_proxied(self):
        r = requests.get(f"{BASE}/subjects/{SUBJECT_ID}/topics", headers=HEADERS, timeout=5)
        assert r.status_code in (200, 404)

    def test_unauthenticated_generate_paper_blocked(self):
        r = requests.post(f"{BASE}/generate-paper", json={"subject_id": "x"}, timeout=5)
        assert r.status_code in (401, 403)

    def test_unauthenticated_analytics_blocked(self):
        r = requests.get(f"{BASE}/analytics/some_class", timeout=5)
        assert r.status_code in (401, 403)
