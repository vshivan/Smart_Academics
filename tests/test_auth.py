"""Tests for JWT auth — token creation, validation, expiry."""
import os
import pytest
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from fastapi.testclient import TestClient
from fastapi import FastAPI
from fastapi.security import HTTPAuthorizationCredentials

# Set test secret before importing auth
os.environ["SECRET_KEY"] = "test-secret-key-for-unit-tests-only"

from auth import create_access_token, get_current_user, TokenData, SECRET_KEY, ALGORITHM


# ── Token Creation ────────────────────────────────────────────

class TestCreateAccessToken:
    def test_returns_string(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com", "role": "faculty"})
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_contains_exp(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com", "role": "faculty"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert "exp" in payload

    def test_token_contains_user_data(self):
        token = create_access_token({"user_id": "u1", "email": "test@college.edu", "role": "faculty"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["user_id"] == "u1"
        assert payload["email"] == "test@college.edu"
        assert payload["role"] == "faculty"

    def test_token_expiry_is_future(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com", "role": "faculty"})
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        exp = datetime.fromtimestamp(payload["exp"], tz=timezone.utc)
        assert exp > datetime.now(timezone.utc)

    def test_empty_data_still_creates_token(self):
        token = create_access_token({})
        assert isinstance(token, str)

    def test_college_id_included(self):
        token = create_access_token({
            "user_id": "u1", "email": "a@b.com",
            "role": "faculty", "college_id": "col_001"
        })
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        assert payload["college_id"] == "col_001"


# ── Token Validation ──────────────────────────────────────────

class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_valid_token_returns_token_data(self):
        token = create_access_token({
            "user_id": "u1", "email": "faculty@test.edu",
            "role": "faculty", "college_id": "col_001"
        })
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = await get_current_user(creds)
        assert isinstance(user, TokenData)
        assert user.user_id == "u1"
        assert user.email == "faculty@test.edu"
        assert user.role == "faculty"

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        from fastapi import HTTPException
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.here")
        with pytest.raises(HTTPException) as exc:
            await get_current_user(creds)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_raises_401(self):
        from fastapi import HTTPException
        # Create token that expired 1 hour ago
        payload = {
            "user_id": "u1", "email": "a@b.com", "role": "faculty",
            "exp": datetime.now(timezone.utc) - timedelta(hours=1)
        }
        expired_token = jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=expired_token)
        with pytest.raises(HTTPException) as exc:
            await get_current_user(creds)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_secret_raises_401(self):
        from fastapi import HTTPException
        token = jwt.encode(
            {"user_id": "u1", "email": "a@b.com", "role": "faculty",
             "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            "wrong-secret", algorithm=ALGORITHM
        )
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        with pytest.raises(HTTPException) as exc:
            await get_current_user(creds)
        assert exc.value.status_code == 401

    @pytest.mark.asyncio
    async def test_token_data_defaults(self):
        token = create_access_token({"user_id": "u1", "email": "a@b.com"})
        creds = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
        user = await get_current_user(creds)
        assert user.role == "faculty"
        assert user.college_id is None


# ── TokenData Model ───────────────────────────────────────────

class TestTokenData:
    def test_default_role_is_faculty(self):
        td = TokenData(user_id="u1", email="a@b.com")
        assert td.role == "faculty"

    def test_college_id_optional(self):
        td = TokenData(user_id="u1", email="a@b.com")
        assert td.college_id is None

    def test_all_fields_set(self):
        td = TokenData(user_id="u1", email="a@b.com", college_id="c1", role="admin")
        assert td.user_id == "u1"
        assert td.college_id == "c1"
        assert td.role == "admin"
