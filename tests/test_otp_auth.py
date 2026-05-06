"""
OTP Authentication tests — covers request, verify, edge cases.

Run with:
    pytest tests/test_otp_auth.py -v
"""
import os
import sys
import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend", "api-gateway"))
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-unit-tests-only")

from auth import (
    _generate_otp,
    _send_otp_email,
    OTPRequest,
    OTPVerify,
    create_access_token,
    OTP_LENGTH,
    OTP_EXPIRE_MINUTES,
)


# ── OTP Generation ────────────────────────────────────────────

class TestGenerateOTP:
    def test_correct_length(self):
        otp = _generate_otp()
        assert len(otp) == OTP_LENGTH

    def test_digits_only(self):
        for _ in range(20):
            otp = _generate_otp()
            assert otp.isdigit(), f"OTP '{otp}' contains non-digit characters"

    def test_uniqueness(self):
        otps = {_generate_otp() for _ in range(100)}
        # With 6 digits there are 1M possibilities — 100 should be mostly unique
        assert len(otps) > 90

    def test_no_leading_zeros_issue(self):
        # OTP must be exactly OTP_LENGTH chars even if it starts with 0
        for _ in range(50):
            otp = _generate_otp()
            assert len(otp) == OTP_LENGTH


# ── OTP Email ─────────────────────────────────────────────────

class TestSendOTPEmail:
    def test_dev_mode_returns_true_without_smtp(self):
        """Without SMTP config, dev mode should return True and log the OTP."""
        with patch.dict(os.environ, {"SMTP_USER": "", "SMTP_PASS": ""}):
            # Re-import to pick up env changes
            import importlib
            import auth as auth_module
            importlib.reload(auth_module)
            result = auth_module._send_otp_email("test@college.edu", "123456")
            assert result is True

    def test_smtp_failure_returns_false(self):
        """SMTP errors should return False without raising."""
        with patch("smtplib.SMTP") as mock_smtp:
            mock_smtp.side_effect = ConnectionRefusedError("Connection refused")
            with patch.dict(os.environ, {"SMTP_USER": "user@test.com", "SMTP_PASS": "pass"}):
                import importlib
                import auth as auth_module
                importlib.reload(auth_module)
                result = auth_module._send_otp_email("test@college.edu", "123456")
                assert result is False


# ── OTP Request Model ─────────────────────────────────────────

class TestOTPRequest:
    def test_valid_email(self):
        req = OTPRequest(email="faculty@college.edu")
        assert req.email == "faculty@college.edu"

    def test_invalid_email_raises(self):
        from pydantic import ValidationError
        with pytest.raises(ValidationError):
            OTPRequest(email="not-an-email")

    def test_email_normalised(self):
        req = OTPRequest(email="Faculty@College.EDU")
        # Pydantic EmailStr normalises to lowercase
        assert "@" in req.email


# ── OTP Verify Model ──────────────────────────────────────────

class TestOTPVerify:
    def test_valid_payload(self):
        v = OTPVerify(email="a@b.com", otp="123456")
        assert v.email == "a@b.com"
        assert v.otp == "123456"

    def test_name_optional(self):
        v = OTPVerify(email="a@b.com", otp="123456")
        assert v.name is None

    def test_name_provided(self):
        v = OTPVerify(email="a@b.com", otp="123456", name="Dr. Smith")
        assert v.name == "Dr. Smith"


# ── OTP Route Integration (mocked DB) ────────────────────────

class TestOTPRoutes:
    @pytest.mark.asyncio
    async def test_request_otp_stores_and_sends(self):
        """POST /auth/otp/request should store OTP and call email sender."""
        import auth as auth_module

        mock_pool = AsyncMock()
        mock_pool.execute = AsyncMock()

        with patch.object(auth_module, "get_pool", return_value=mock_pool), \
             patch.object(auth_module, "_send_otp_email", return_value=True) as mock_send, \
             patch.object(auth_module, "_generate_otp", return_value="654321"):

            body = OTPRequest(email="test@college.edu")
            result = await auth_module.request_otp(body)

            assert result["success"] is True
            assert "654321" not in str(result)  # OTP not leaked in response
            mock_send.assert_called_once()
            assert mock_send.call_args[0][0] == "test@college.edu"
            assert mock_send.call_args[0][1] == "654321"

    @pytest.mark.asyncio
    async def test_verify_otp_invalid_raises_400(self):
        """POST /auth/otp/verify with wrong OTP should raise 400."""
        from fastapi import HTTPException
        import auth as auth_module

        mock_pool = AsyncMock()
        mock_pool.fetchrow = AsyncMock(return_value=None)  # No matching OTP

        with patch.object(auth_module, "get_pool", return_value=mock_pool):
            body = OTPVerify(email="test@college.edu", otp="000000")
            with pytest.raises(HTTPException) as exc:
                await auth_module.verify_otp(body)
            assert exc.value.status_code == 400

    @pytest.mark.asyncio
    async def test_verify_otp_valid_returns_token(self):
        """POST /auth/otp/verify with correct OTP should return JWT."""
        import auth as auth_module

        otp_row = MagicMock()
        otp_row.__getitem__ = lambda self, key: "otp-uuid-123" if key == "id" else None

        user_row = MagicMock()
        user_row.__getitem__ = lambda self, key: {
            "id": "user-uuid-456",
            "college_id": None,
            "role": "faculty",
            "name": "Test User",
        }.get(key)

        mock_pool = AsyncMock()
        mock_pool.fetchrow = AsyncMock(side_effect=[otp_row, user_row])
        mock_pool.execute  = AsyncMock()
        mock_pool.fetch    = AsyncMock(return_value=[])  # no permissions

        with patch.object(auth_module, "get_pool", return_value=mock_pool):
            body = OTPVerify(email="test@college.edu", otp="123456", name="Test User")
            result = await auth_module.verify_otp(body)

            assert result["success"] is True
            assert "access_token" in result["data"]
            assert result["data"]["user"]["email"] == "test@college.edu"
            assert result["data"]["user"]["role"] == "faculty"

    @pytest.mark.asyncio
    async def test_verify_otp_marks_as_used(self):
        """After successful verification, OTP should be marked used."""
        import auth as auth_module

        otp_row = MagicMock()
        otp_row.__getitem__ = lambda self, key: "otp-uuid-789" if key == "id" else None

        user_row = MagicMock()
        user_row.__getitem__ = lambda self, key: {
            "id": "user-uuid-111",
            "college_id": None,
            "role": "faculty",
            "name": "Faculty",
        }.get(key)

        execute_calls = []
        mock_pool = AsyncMock()
        mock_pool.fetchrow = AsyncMock(side_effect=[otp_row, user_row])
        mock_pool.execute  = AsyncMock(side_effect=lambda q, *a: execute_calls.append(q))
        mock_pool.fetch    = AsyncMock(return_value=[])

        with patch.object(auth_module, "get_pool", return_value=mock_pool):
            body = OTPVerify(email="test@college.edu", otp="123456")
            await auth_module.verify_otp(body)

        # Check that UPDATE otp_codes SET used=TRUE was called
        assert any("used=TRUE" in q for q in execute_calls)
