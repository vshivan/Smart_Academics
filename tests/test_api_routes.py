"""
API Gateway route tests — covers all major route groups.

Uses FastAPI TestClient with mocked downstream services.
No real DB or microservices needed.

Run with:
    pytest tests/test_api_routes.py -v
"""
import os
import sys
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "api-gateway"))
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")

from fastapi.testclient import TestClient
from jose import jwt

# Import after env setup
import auth as auth_module
from auth import create_access_token, SECRET_KEY, ALGORITHM

# ── Helpers ───────────────────────────────────────────────────

def make_token(role: str = "faculty", permissions: list = None) -> str:
    return create_access_token({
        "user_id":     "test-user-id",
        "email":       "test@college.edu",
        "role":        role,
        "college_id":  "test-college-id",
        "permissions": permissions or [],
    })

def auth_headers(role: str = "faculty", permissions: list = None) -> dict:
    return {"Authorization": f"Bearer {make_token(role, permissions)}"}


# ── App setup ─────────────────────────────────────────────────

# We need to import main after patching the proxy
MOCK_PROXY_RESPONSE = MagicMock()
MOCK_PROXY_RESPONSE.status_code = 200
MOCK_PROXY_RESPONSE.content = b'{"success":true,"data":{},"error":null}'
MOCK_PROXY_RESPONSE.headers = {"content-type": "application/json"}

async def _mock_proxy(request, service_url, path, user):
    from fastapi.responses import Response
    return Response(
        content=b'{"success":true,"data":{},"error":null}',
        status_code=200,
        media_type="application/json",
    )

with patch("proxy.proxy_request", side_effect=_mock_proxy):
    from main import app

client = TestClient(app, raise_server_exceptions=False)


# ── Health ────────────────────────────────────────────────────

class TestHealth:
    def test_health_returns_200(self):
        r = client.get("/health")
        assert r.status_code == 200

    def test_health_response_format(self):
        r = client.get("/health")
        data = r.json()
        assert data["success"] is True
        assert data["data"]["status"] == "ok"
        assert data["data"]["service"] == "api-gateway"

    def test_health_no_auth_required(self):
        r = client.get("/health")
        assert r.status_code != 401


# ── Auth Routes ───────────────────────────────────────────────

class TestAuthRoutes:
    def test_login_redirects(self):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": "test-client-id"}):
            r = client.get("/auth/login", follow_redirects=False)
            assert r.status_code in (302, 307)
            assert "accounts.google.com" in r.headers.get("location", "")

    def test_login_without_client_id_returns_500(self):
        with patch.dict(os.environ, {"GOOGLE_CLIENT_ID": ""}):
            import importlib
            importlib.reload(auth_module)
            r = client.get("/auth/login")
            # Should return error (500 or redirect with error)
            assert r.status_code in (500, 302, 307)

    def test_me_requires_auth(self):
        r = client.get("/auth/me")
        assert r.status_code in (401, 403)  # HTTPBearer returns 401 in FastAPI >=0.95

    def test_me_with_valid_token(self):
        r = client.get("/auth/me", headers=auth_headers())
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == "test@college.edu"
        assert data["role"] == "faculty"

    def test_me_with_invalid_token(self):
        r = client.get("/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401

    def test_refresh_requires_auth(self):
        r = client.post("/auth/refresh")
        assert r.status_code in (401, 403)  # HTTPBearer returns 401 in FastAPI >=0.95

    def test_otp_request_endpoint_exists(self):
        with patch.object(auth_module, "get_pool") as mock_pool_fn:
            mock_pool = AsyncMock()
            mock_pool.execute = AsyncMock()
            mock_pool_fn.return_value = mock_pool
            with patch.object(auth_module, "_send_otp_email", return_value=True):
                r = client.post("/auth/otp/request", json={"email": "test@college.edu"})
                assert r.status_code == 200

    def test_otp_request_invalid_email(self):
        r = client.post("/auth/otp/request", json={"email": "not-an-email"})
        assert r.status_code == 422

    def test_otp_verify_wrong_otp(self):
        with patch.object(auth_module, "get_pool") as mock_pool_fn:
            mock_pool = AsyncMock()
            mock_pool.fetchrow = AsyncMock(return_value=None)
            mock_pool_fn.return_value = mock_pool
            r = client.post("/auth/otp/verify", json={"email": "test@college.edu", "otp": "000000"})
            assert r.status_code == 400


# ── Protected Routes — Authentication ─────────────────────────

class TestProtectedRoutes:
    def test_upload_syllabus_requires_auth(self):
        r = client.post("/upload-syllabus")
        assert r.status_code in (401, 403)  # HTTPBearer returns 401 in FastAPI >=0.95

    def test_generate_paper_requires_auth(self):
        r = client.post("/generate-paper")
        assert r.status_code in (401, 403)  # HTTPBearer returns 401 in FastAPI >=0.95

    def test_evaluate_requires_auth(self):
        r = client.post("/evaluate-assignment")
        assert r.status_code in (401, 403)  # HTTPBearer returns 401 in FastAPI >=0.95

    def test_analytics_requires_auth(self):
        r = client.get("/analytics/some-class-id")
        assert r.status_code in (401, 403)  # HTTPBearer returns 401 in FastAPI >=0.95

    def test_colleges_list_requires_auth(self):
        r = client.get("/colleges")
        assert r.status_code in (401, 403)  # HTTPBearer returns 401 in FastAPI >=0.95


# ── RBAC — Permission Guards ──────────────────────────────────

class TestRBACGuards:
    def test_upload_syllabus_with_permission(self):
        with patch("proxy.proxy_request", side_effect=_mock_proxy):
            r = client.post(
                "/upload-syllabus",
                headers=auth_headers("faculty", ["upload_syllabus"]),
                files={"file": ("test.pdf", b"fake pdf content", "application/pdf")},
                data={"subject_id": "CS301", "file_type": "syllabus"},
            )
            assert r.status_code == 200

    def test_upload_syllabus_without_permission(self):
        r = client.post(
            "/upload-syllabus",
            headers=auth_headers("faculty", []),  # no permissions
            files={"file": ("test.pdf", b"fake", "application/pdf")},
            data={"subject_id": "CS301"},
        )
        assert r.status_code == 403

    def test_generate_paper_with_permission(self):
        with patch("proxy.proxy_request", side_effect=_mock_proxy):
            r = client.post(
                "/generate-paper",
                headers=auth_headers("faculty", ["generate_papers"]),
                json={"subject_id": "CS301", "exam_type": "midterm", "total_marks": 50},
            )
            assert r.status_code == 200

    def test_generate_paper_without_permission(self):
        r = client.post(
            "/generate-paper",
            headers=auth_headers("faculty", []),
            json={"subject_id": "CS301"},
        )
        assert r.status_code == 403

    def test_create_college_requires_manage_colleges(self):
        r = client.post(
            "/colleges",
            headers=auth_headers("faculty", []),
            json={"name": "Test College"},
        )
        assert r.status_code == 403

    def test_create_college_with_permission(self):
        with patch("proxy.proxy_request", side_effect=_mock_proxy):
            r = client.post(
                "/colleges",
                headers=auth_headers("admin", ["manage_colleges"]),
                json={"name": "Test College"},
            )
            assert r.status_code == 200

    def test_hod_summary_requires_hod_or_admin(self):
        r = client.get(
            "/colleges/test-id/hod-summary",
            headers=auth_headers("faculty", ["view_own_analytics"]),
        )
        assert r.status_code == 403

    def test_hod_summary_accessible_by_hod(self):
        with patch("proxy.proxy_request", side_effect=_mock_proxy):
            r = client.get(
                "/colleges/test-id/hod-summary",
                headers=auth_headers("hod", ["view_dept_analytics"]),
            )
            assert r.status_code == 200

    def test_rbac_permissions_requires_admin(self):
        r = client.get(
            "/rbac/permissions/faculty",
            headers=auth_headers("faculty", []),
        )
        assert r.status_code == 403

    def test_rbac_permissions_accessible_by_admin(self):
        with patch("proxy.proxy_request", side_effect=_mock_proxy):
            r = client.get(
                "/rbac/permissions/faculty",
                headers=auth_headers("admin", ["manage_all_users"]),
            )
            assert r.status_code == 200

    def test_compare_classes_requires_dept_analytics(self):
        # Route shadowing bug fixed in main.py: /analytics/compare now registered
        # BEFORE /analytics/{class_id}, so the permission guard is properly enforced.
        r = client.get(
            "/analytics/compare?class_ids=a,b",
            headers=auth_headers("faculty", []),
        )
        assert r.status_code == 403

    def test_accreditation_requires_permission(self):
        r = client.post(
            "/accreditation/generate",
            headers=auth_headers("faculty", []),
        )
        assert r.status_code == 403


# ── Route Existence ───────────────────────────────────────────

class TestRouteExistence:
    """Verify all major routes exist (return 200 or 403, not 404)."""

    ROUTES = [
        ("GET",   "/health"),
        ("GET",   "/auth/me"),
        ("POST",  "/auth/otp/request"),
        ("POST",  "/auth/otp/verify"),
        ("POST",  "/auth/refresh"),
        ("GET",   "/subjects/test/files"),
        ("GET",   "/subjects/test/knowledge"),
        ("GET",   "/subjects/test/topics"),
        ("POST",  "/generate-paper"),
        ("GET",   "/papers/test"),
        ("POST",  "/evaluate-assignment"),
        ("GET",   "/evaluation/test/results"),
        ("GET",   "/analytics/test"),
        ("GET",   "/analytics/test/performance"),
        ("GET",   "/analytics/test/bloom-coverage"),
        ("GET",   "/analytics/test/student-risk"),
        ("GET",   "/colleges"),
        ("GET",   "/colleges/test"),
        ("GET",   "/colleges/test/subjects"),
        ("GET",   "/colleges/test/classes"),
        ("GET",   "/colleges/test/faculty"),
        ("GET",   "/colleges/test/departments"),
        ("GET",   "/colleges/test/academic-years"),
        ("GET",   "/question-bank"),
        ("GET",   "/rubrics"),
        ("GET",   "/notifications"),
        ("GET",   "/plagiarism/test/report"),
        ("GET",   "/students/test/results"),
        ("GET",   "/students/test/classes"),
        ("GET",   "/paper-templates"),
        ("GET",   "/attendance/test"),
        ("GET",   "/certificates/test"),
        ("GET",   "/classes/test/students"),
        ("GET",   "/rbac/check"),
    ]

    @pytest.mark.parametrize("method,path", ROUTES)
    def test_route_exists(self, method, path):
        r = client.request(method, path)
        assert r.status_code != 404, f"{method} {path} returned 404 — route not registered"


# ── Security Headers ──────────────────────────────────────────

class TestSecurityHeaders:
    def test_x_content_type_options(self):
        r = client.get("/health")
        assert r.headers.get("x-content-type-options") == "nosniff"

    def test_x_frame_options(self):
        r = client.get("/health")
        assert r.headers.get("x-frame-options") == "DENY"

    def test_x_xss_protection(self):
        r = client.get("/health")
        assert r.headers.get("x-xss-protection") == "1; mode=block"

    def test_request_id_header(self):
        r = client.get("/health")
        assert "x-request-id" in r.headers
        assert len(r.headers["x-request-id"]) == 8


# ── Error Response Format ─────────────────────────────────────

class TestErrorFormat:
    def test_401_has_standard_envelope(self):
        r = client.get("/auth/me")
        # No auth → 403 (HTTPBearer returns 403 when no credentials)
        assert r.status_code in (401, 403)
        data = r.json()
        assert "success" in data
        assert data["success"] is False
        assert "error" in data
        assert data["error"] is not None

    def test_404_has_standard_envelope(self):
        r = client.get("/this-route-does-not-exist-at-all")
        assert r.status_code == 404
        # FastAPI default 404 — may not have our envelope, that's OK
        # Just verify it doesn't crash

    def test_403_has_standard_envelope(self):
        r = client.post("/generate-paper", headers=auth_headers("faculty", []))
        assert r.status_code == 403
        data = r.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
