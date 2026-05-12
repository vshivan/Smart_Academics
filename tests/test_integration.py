"""
Integration tests — hit the live running stack.

Requires: docker compose up (all services running)

Run with:
    pytest tests/test_integration.py -v --timeout=30

These tests make real HTTP calls to localhost:8000.
They are skipped automatically if the gateway is not reachable.
"""
import pytest
import requests

BASE = "http://localhost:8000"
TIMEOUT = 10


def gateway_available() -> bool:
    try:
        r = requests.get(f"{BASE}/health", timeout=3)
        return r.status_code == 200
    except Exception:
        return False


# Skip all tests in this module if gateway is not running
pytestmark = pytest.mark.skipif(
    not gateway_available(),
    reason="API gateway not running — start with: docker compose up"
)


# ── Health checks ─────────────────────────────────────────────

class TestServiceHealth:
    """
    Microservices run on the internal Docker network only.
    They are NOT exposed to the host — the API gateway proxies to them.
    We test them via the gateway's health endpoint and by checking
    that the gateway can reach them (503 would mean service is down).
    """
    SERVICES = [
        ("api-gateway",          "http://localhost:8000/health"),
    ]

    @pytest.mark.parametrize("name,url", SERVICES)
    def test_service_healthy(self, name, url):
        r = requests.get(url, timeout=TIMEOUT)
        assert r.status_code == 200, f"{name} returned {r.status_code}"
        data = r.json()
        status = data.get("data", {}).get("status") or data.get("status")
        assert status == "ok", f"{name} status is '{status}'"

    def test_all_microservices_reachable_via_gateway(self):
        """
        The gateway proxies to all microservices internally.
        A 403 (auth required) means the service is reachable.
        A 503 means the service is down.
        """
        routes = [
            "/upload-syllabus",
            "/generate-paper",
            "/evaluate-assignment",
            "/analytics/test-class",
            "/colleges",
            "/question-bank",
            "/students/test/results",
            "/paper-templates",
            "/attendance/test",
            "/accreditation/reports",
            "/admin/stats",
            "/schedule/test",
            "/subjects/test/copo",
            "/scanner/sessions/test/sheets",
        ]
        for route in routes:
            r = requests.get(f"{BASE}{route}", timeout=TIMEOUT)
            assert r.status_code != 503, f"Service behind {route} is DOWN (503)"
            assert r.status_code != 504, f"Service behind {route} TIMED OUT (504)"
            # 403 = auth required = service is up and reachable


# ── Gateway response format ───────────────────────────────────

class TestGatewayFormat:
    def test_health_envelope(self):
        r = requests.get(f"{BASE}/health", timeout=TIMEOUT)
        data = r.json()
        assert "success" in data
        assert "data" in data
        assert "error" in data

    def test_unauthenticated_returns_envelope(self):
        r = requests.get(f"{BASE}/colleges", timeout=TIMEOUT)
        assert r.status_code in (401, 403)
        data = r.json()
        assert data["success"] is False
        assert data["error"] is not None
        assert "code" in data["error"]
        assert "message" in data["error"]

    def test_security_headers_present(self):
        r = requests.get(f"{BASE}/health", timeout=TIMEOUT)
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"
        assert "x-request-id" in r.headers

    def test_request_id_is_8_chars(self):
        r = requests.get(f"{BASE}/health", timeout=TIMEOUT)
        rid = r.headers.get("x-request-id", "")
        assert len(rid) == 8


# ── OTP Auth flow ─────────────────────────────────────────────

class TestOTPAuthFlow:
    def test_otp_request_endpoint_reachable(self):
        r = requests.post(
            f"{BASE}/auth/otp/request",
            json={"email": "integration.test@gmail.com"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 200
        data = r.json()
        assert data["success"] is True
        assert "message" in data["data"]

    def test_otp_request_invalid_email(self):
        r = requests.post(
            f"{BASE}/auth/otp/request",
            json={"email": "not-an-email"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 422

    def test_otp_verify_wrong_code(self):
        # First request an OTP so the email exists in otp_codes
        requests.post(f"{BASE}/auth/otp/request",
                      json={"email": "verify.test@gmail.com"}, timeout=TIMEOUT)
        # Now verify with wrong code
        r = requests.post(
            f"{BASE}/auth/otp/verify",
            json={"email": "verify.test@gmail.com", "otp": "000000"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 400
        data = r.json()
        assert data["success"] is False

    def test_otp_verify_missing_fields(self):
        r = requests.post(
            f"{BASE}/auth/otp/verify",
            json={"email": "test@example.com"},  # missing otp
            timeout=TIMEOUT,
        )
        assert r.status_code == 422


# ── Auth routes ───────────────────────────────────────────────

class TestAuthRoutes:
    def test_login_redirects_to_google(self):
        r = requests.get(f"{BASE}/auth/login", allow_redirects=False, timeout=TIMEOUT)
        assert r.status_code in (302, 307)
        location = r.headers.get("location", "")
        assert "accounts.google.com" in location or "error" in location

    def test_me_without_token(self):
        r = requests.get(f"{BASE}/auth/me", timeout=TIMEOUT)
        assert r.status_code in (401, 403)

    def test_me_with_invalid_token(self):
        r = requests.get(
            f"{BASE}/auth/me",
            headers={"Authorization": "Bearer invalid.token.here"},
            timeout=TIMEOUT,
        )
        assert r.status_code == 401


# ── CORS ──────────────────────────────────────────────────────

class TestCORS:
    def test_cors_preflight(self):
        r = requests.options(
            f"{BASE}/health",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
            timeout=TIMEOUT,
        )
        assert r.status_code in (200, 204)

    def test_cors_header_on_response(self):
        r = requests.get(
            f"{BASE}/health",
            headers={"Origin": "http://localhost:3000"},
            timeout=TIMEOUT,
        )
        assert "access-control-allow-origin" in r.headers


# ── Docs ──────────────────────────────────────────────────────

class TestDocs:
    def test_swagger_ui_accessible(self):
        r = requests.get(f"{BASE}/docs", timeout=TIMEOUT)
        assert r.status_code == 200
        assert "swagger" in r.text.lower() or "openapi" in r.text.lower()

    def test_openapi_json_accessible(self):
        r = requests.get(f"{BASE}/openapi.json", timeout=TIMEOUT)
        assert r.status_code == 200
        data = r.json()
        assert "paths" in data
        assert "info" in data
