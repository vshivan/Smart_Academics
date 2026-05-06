"""
Security Regression Tests — Verify fixes for CRIT and SEC issues.
"""
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock, MagicMock
import sys, os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "api-gateway"))
from main import app
from auth import create_access_token

client = TestClient(app)

def make_token(role="faculty", college_id="college-A"):
    return create_access_token({
        "user_id": "user-1",
        "email": "test@edu.com",
        "role": role,
        "college_id": college_id,
        "permissions": ["generate_papers", "upload_syllabus"]
    })

def test_oauth_callback_uses_fragment():
    """SEC-001: Ensure token is in fragment (#), not query (?)"""
    with patch("auth.httpx.AsyncClient") as mock_client:
        mock_instance = mock_client.return_value.__aenter__.return_value
        mock_instance.post = AsyncMock(return_value=MagicMock(status_code=200, json=lambda: {"access_token": "abc"}))
        mock_userinfo = MagicMock(status_code=200)
        mock_userinfo.json.return_value = {"email": "t@t.com", "sub": "123"}
        mock_userinfo.raise_for_status = MagicMock()
        mock_instance.get = AsyncMock(return_value=mock_userinfo)
        
        with patch("auth.get_pool") as mock_pool:
            mock_db = AsyncMock()
            mock_db.fetchrow = AsyncMock(return_value={"id": "uuid", "college_id": "c1", "role": "faculty"})
            mock_db.fetch = AsyncMock(return_value=[])
            mock_pool.return_value = mock_db
            
            response = client.get("/auth/callback?code=fake", follow_redirects=False)
            assert response.status_code in (302, 307)
            location = response.headers["location"]
            assert "#token=" in location

@patch("main.proxy_request")
def test_multi_tenant_isolation_mock(mock_proxy):
    mock_proxy.return_value = MagicMock(status_code=200, content=b"{}")
    token_a = make_token(college_id="COLLEGE-A")
    headers = {"Authorization": f"Bearer {token_a}"}
    
    response = client.get("/papers/paper-123", headers=headers)
    assert response.status_code == 200
    
    assert mock_proxy.called
    args, kwargs = mock_proxy.call_args
    user_obj = args[3]
    assert user_obj.college_id == "COLLEGE-A"

def test_security_headers_present():
    response = client.get("/health")
    assert response.headers["X-Frame-Options"] == "DENY"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert "X-Request-Id" in response.headers
