"""
RBAC unit tests — covers JWT creation, permission loading,
role guards, and the require_permission dependency.

Run with:
    pytest tests/test_rbac.py -v
"""
import os
import sys
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

# Make sure the api-gateway module is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "api-gateway"))

from jose import jwt
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

# ── Fixtures ──────────────────────────────────────────────────────────────────

SECRET = "test-secret-key-for-unit-tests-only"
ALGO   = "HS256"

os.environ.setdefault("SECRET_KEY", SECRET)

import auth as auth_module  # noqa: E402 — must come after env setup


def make_token(payload: dict, secret: str = SECRET, expire_minutes: int = 60) -> str:
    data = payload.copy()
    data["exp"] = datetime.now(timezone.utc) + timedelta(minutes=expire_minutes)
    return jwt.encode(data, secret, algorithm=ALGO)


def make_credentials(token: str) -> HTTPAuthorizationCredentials:
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


# ── Token creation ────────────────────────────────────────────────────────────

class TestCreateAccessToken:
    def test_creates_valid_jwt(self):
        token = auth_module.create_access_token({"user_id": "u1", "role": "faculty"})
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        assert payload["user_id"] == "u1"
        assert payload["role"] == "faculty"

    def test_token_has_expiry(self):
        token = auth_module.create_access_token({"user_id": "u1"})
        payload = jwt.decode(token, SECRET, algorithms=[ALGO])
        assert "exp" in payload
        assert payload["exp"] > datetime.now(timezone.utc).timestamp()

    def test_expired_token_raises(self):
        token = make_token({"user_id": "u1"}, expire_minutes=-1)
        with pytest.raises(Exception):
            jwt.decode(token, SECRET, algorithms=[ALGO])


# ── get_current_user ──────────────────────────────────────────────────────────

class TestGetCurrentUser:
    @pytest.mark.asyncio
    async def test_valid_token_returns_token_data(self):
        token = make_token({
            "user_id": "abc123",
            "email": "test@college.edu",
            "role": "faculty",
            "permissions": ["upload_syllabus", "generate_papers"],
        })
        creds = make_credentials(token)
        user = await auth_module.get_current_user(creds)
        assert user.user_id == "abc123"
        assert user.email == "test@college.edu"
        assert user.role == "faculty"
        assert "upload_syllabus" in user.permissions

    @pytest.mark.asyncio
    async def test_invalid_token_raises_401(self):
        creds = make_credentials("not.a.valid.token")
        with pytest.raises(HTTPException) as exc_info:
            await auth_module.get_current_user(creds)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_expired_token_raises_401(self):
        token = make_token({"user_id": "u1", "email": "x@y.com", "role": "faculty"}, expire_minutes=-1)
        creds = make_credentials(token)
        with pytest.raises(HTTPException) as exc_info:
            await auth_module.get_current_user(creds)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_wrong_secret_raises_401(self):
        token = make_token({"user_id": "u1", "email": "x@y.com", "role": "faculty"}, secret="wrong-secret")
        creds = make_credentials(token)
        with pytest.raises(HTTPException) as exc_info:
            await auth_module.get_current_user(creds)
        assert exc_info.value.status_code == 401


# ── require_role ──────────────────────────────────────────────────────────────

class TestRequireRole:
    @pytest.mark.asyncio
    async def test_allowed_role_passes(self):
        token = make_token({"user_id": "u1", "email": "a@b.com", "role": "admin", "permissions": []})
        creds = make_credentials(token)
        checker = auth_module.require_role("admin")
        user = await checker(await auth_module.get_current_user(creds))
        assert user.role == "admin"

    @pytest.mark.asyncio
    async def test_disallowed_role_raises_403(self):
        token = make_token({"user_id": "u1", "email": "a@b.com", "role": "faculty", "permissions": []})
        creds = make_credentials(token)
        checker = auth_module.require_role("admin")
        with pytest.raises(HTTPException) as exc_info:
            await checker(await auth_module.get_current_user(creds))
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_multiple_allowed_roles(self):
        for role in ("hod", "admin"):
            token = make_token({"user_id": "u1", "email": "a@b.com", "role": role, "permissions": []})
            creds = make_credentials(token)
            checker = auth_module.require_role("hod", "admin")
            user = await checker(await auth_module.get_current_user(creds))
            assert user.role == role

    @pytest.mark.asyncio
    async def test_faculty_blocked_from_admin_route(self):
        token = make_token({"user_id": "u1", "email": "a@b.com", "role": "faculty", "permissions": []})
        creds = make_credentials(token)
        checker = auth_module.require_role("hod", "admin")
        with pytest.raises(HTTPException) as exc_info:
            await checker(await auth_module.get_current_user(creds))
        assert exc_info.value.status_code == 403


# ── require_permission ────────────────────────────────────────────────────────

class TestRequirePermission:
    @pytest.mark.asyncio
    async def test_user_with_permission_passes(self):
        token = make_token({
            "user_id": "u1", "email": "a@b.com", "role": "faculty",
            "permissions": ["generate_papers", "upload_syllabus"],
        })
        creds = make_credentials(token)
        checker = auth_module.require_permission("generate_papers")
        user = await checker(await auth_module.get_current_user(creds))
        assert user.user_id == "u1"

    @pytest.mark.asyncio
    async def test_user_without_permission_raises_403(self):
        token = make_token({
            "user_id": "u1", "email": "a@b.com", "role": "faculty",
            "permissions": ["upload_syllabus"],
        })
        creds = make_credentials(token)
        checker = auth_module.require_permission("manage_colleges")
        with pytest.raises(HTTPException) as exc_info:
            await checker(await auth_module.get_current_user(creds))
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_empty_permissions_raises_403(self):
        token = make_token({"user_id": "u1", "email": "a@b.com", "role": "faculty", "permissions": []})
        creds = make_credentials(token)
        checker = auth_module.require_permission("generate_papers")
        with pytest.raises(HTTPException) as exc_info:
            await checker(await auth_module.get_current_user(creds))
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_admin_with_all_permissions(self):
        all_perms = [
            "upload_syllabus", "generate_papers", "evaluate_assignments",
            "view_own_analytics", "view_class_analytics", "view_dept_analytics",
            "use_question_bank", "build_rubrics", "manage_faculty_roles",
            "manage_co_faculty", "generate_accreditation", "manage_colleges",
            "manage_all_users",
        ]
        token = make_token({
            "user_id": "u1", "email": "admin@college.edu",
            "role": "admin", "permissions": all_perms,
        })
        creds = make_credentials(token)
        for perm in all_perms:
            checker = auth_module.require_permission(perm)
            user = await checker(await auth_module.get_current_user(creds))
            assert user.role == "admin"


# ── Convenience shortcuts ─────────────────────────────────────────────────────

class TestConvenienceShortcuts:
    @pytest.mark.asyncio
    async def test_require_hod_or_admin_allows_hod(self):
        token = make_token({"user_id": "u1", "email": "a@b.com", "role": "hod", "permissions": []})
        creds = make_credentials(token)
        user = await auth_module.require_hod_or_admin(await auth_module.get_current_user(creds))
        assert user.role == "hod"

    @pytest.mark.asyncio
    async def test_require_hod_or_admin_blocks_faculty(self):
        token = make_token({"user_id": "u1", "email": "a@b.com", "role": "faculty", "permissions": []})
        creds = make_credentials(token)
        with pytest.raises(HTTPException) as exc_info:
            await auth_module.require_hod_or_admin(await auth_module.get_current_user(creds))
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_require_admin_blocks_hod(self):
        token = make_token({"user_id": "u1", "email": "a@b.com", "role": "hod", "permissions": []})
        creds = make_credentials(token)
        with pytest.raises(HTTPException) as exc_info:
            await auth_module.require_admin(await auth_module.get_current_user(creds))
        assert exc_info.value.status_code == 403


# ── Token data model ──────────────────────────────────────────────────────────

class TestTokenData:
    def test_default_role_is_faculty(self):
        td = auth_module.TokenData(user_id="u1", email="a@b.com")
        assert td.role == "faculty"

    def test_default_permissions_is_empty_list(self):
        td = auth_module.TokenData(user_id="u1", email="a@b.com")
        assert td.permissions == []

    def test_college_id_optional(self):
        td = auth_module.TokenData(user_id="u1", email="a@b.com")
        assert td.college_id is None

    def test_full_payload(self):
        td = auth_module.TokenData(
            user_id="u1",
            email="a@b.com",
            role="admin",
            permissions=["manage_colleges"],
            college_id="c1",
        )
        assert td.role == "admin"
        assert "manage_colleges" in td.permissions
        assert td.college_id == "c1"
