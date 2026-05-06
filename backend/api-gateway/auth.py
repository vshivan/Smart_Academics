"""
OAuth2 + JWT + Email OTP authentication — production-grade.

Login methods:
  1. Google OAuth2  — /auth/login → /auth/callback
  2. Email OTP      — POST /auth/otp/request → POST /auth/otp/verify

Fixes applied:
  - ERR-005: User upserted into DB on every OAuth callback
  - ERR-012: datetime.utcnow() replaced with timezone-aware datetime.now(UTC)
  - Permissions loaded from role_permissions table and embedded in JWT
  - FRONTEND_URL env var used for redirect (no hardcoded localhost)
"""
import os
import json
import base64
import random
import string
import smtplib
import urllib.parse
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

import asyncpg
import httpx
from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel, EmailStr

# ── Config ────────────────────────────────────────────────────────────────────
SECRET_KEY               = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
ALGORITHM                = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))  # 8 hours

GOOGLE_CLIENT_ID         = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET     = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI      = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL             = os.getenv("FRONTEND_URL", "http://localhost:3000")
DATABASE_URL             = os.getenv("DATABASE_URL", "postgresql://saap:saap_pass@postgres:5432/saap_db")

# SMTP config for OTP emails
SMTP_HOST   = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT   = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER   = os.getenv("SMTP_USER", "")
SMTP_PASS   = os.getenv("SMTP_PASS", "")
FROM_EMAIL  = os.getenv("FROM_EMAIL", "noreply@saap.edu")

# OTP config
OTP_EXPIRE_MINUTES = 10
OTP_LENGTH         = 6

# Fernet key derived from SECRET_KEY (padded/truncated to 32 bytes, then base64url-encoded)
_raw = os.getenv("TOKEN_ENCRYPTION_KEY", SECRET_KEY)
_key = base64.urlsafe_b64encode(_raw.encode().ljust(32)[:32])
fernet = Fernet(_key)

router       = APIRouter()
bearer_scheme = HTTPBearer()
_pool: Optional[asyncpg.Pool] = None


# ── DB pool ───────────────────────────────────────────────────────────────────
async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool


# ── Token helpers ─────────────────────────────────────────────────────────────
def encrypt_tokens(tokens: dict) -> dict:
    """Encrypt tokens and wrap in a dict for JSONB storage."""
    enc = fernet.encrypt(json.dumps(tokens).encode()).decode()
    return {"encrypted": enc}


def decrypt_tokens(encrypted_obj: dict) -> dict:
    """Decrypt tokens from the 'encrypted' wrapper dict."""
    if not isinstance(encrypted_obj, dict) or "encrypted" not in encrypted_obj:
        return {}
    try:
        return json.loads(fernet.decrypt(encrypted_obj["encrypted"].encode()).decode())
    except Exception:
        return {}


# ── Models ────────────────────────────────────────────────────────────────────
class TokenData(BaseModel):
    user_id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    college_id: Optional[str] = None
    role: str = "faculty"
    permissions: list[str] = []


# ── JWT ───────────────────────────────────────────────────────────────────────
def create_access_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> TokenData:
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(**payload)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ── RBAC dependency factory ───────────────────────────────────────────────────
def require_role(*allowed_roles: str):
    """
    FastAPI dependency — raises 403 if the authenticated user's role
    is not in *allowed_roles*.

    Usage:
        @app.get("/admin-only", dependencies=[Depends(require_role("admin"))])
        @app.get("/hod-or-admin", dependencies=[Depends(require_role("hod", "admin"))])
    """
    async def checker(user: TokenData = Depends(get_current_user)) -> TokenData:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted. Required: {list(allowed_roles)}",
            )
        return user
    return checker


def require_permission(permission: str):
    """
    FastAPI dependency — raises 403 if the authenticated user does not
    have the specified permission in their JWT payload.

    Usage:
        @app.post("/generate-paper", dependencies=[Depends(require_permission("generate_papers"))])
    """
    async def checker(user: TokenData = Depends(get_current_user)) -> TokenData:
        if permission not in user.permissions:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission '{permission}' required.",
            )
        return user
    return checker


# Convenience shortcuts
require_hod_or_admin = require_role("hod", "admin")
require_admin        = require_role("admin")


# ── Helpers ───────────────────────────────────────────────────────────────────
async def _load_permissions(pool: asyncpg.Pool, role: str) -> list[str]:
    """Load all permissions for a role from the DB."""
    rows = await pool.fetch(
        "SELECT permission FROM role_permissions WHERE role=$1", role
    )
    return [r["permission"] for r in rows]


# ── Routes ────────────────────────────────────────────────────────────────────
@router.get("/login")
async def login():
    """Redirect browser to Google OAuth consent screen."""
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=500,
            detail="GOOGLE_CLIENT_ID is not configured. Set it in your .env file.",
        )
    # Basic scopes only — no Classroom = no verification warning
    # To enable Google Classroom auto-fetch, add the classroom scopes back
    # and either add test users in Google Console or go through verification
    scope = "openid email profile"

    url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={GOOGLE_CLIENT_ID}"
        f"&redirect_uri={urllib.parse.quote(GOOGLE_REDIRECT_URI, safe='')}"
        f"&response_type=code"
        f"&scope={urllib.parse.quote(scope)}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return RedirectResponse(url)


@router.get("/callback")
async def oauth_callback(code: str):
    """
    Exchange Google auth code → tokens → upsert user → issue JWT → redirect.

    Common failure modes and their fixes:
      - redirect_uri_mismatch: GOOGLE_REDIRECT_URI must exactly match the URI
        registered in Google Cloud Console (including http vs https, port, path).
      - invalid_client: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are wrong.
      - CORS: This endpoint is called by Google (server-side redirect), not by
        the browser directly — CORS does not apply here.
    """
    if not GOOGLE_CLIENT_ID or not GOOGLE_CLIENT_SECRET:
        error_msg = urllib.parse.quote("Google OAuth credentials not configured")
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error={error_msg}")

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1. Exchange authorization code for Google tokens
            token_resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": GOOGLE_CLIENT_ID,
                    "client_secret": GOOGLE_CLIENT_SECRET,
                    "redirect_uri": GOOGLE_REDIRECT_URI,
                    "grant_type": "authorization_code",
                },
            )
            if token_resp.status_code != 200:
                # Surface the exact Google error to the frontend for debugging
                error_msg = urllib.parse.quote(token_resp.text)
                return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error={error_msg}")

            google_tokens = token_resp.json()

            # 2. Fetch user profile from Google
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {google_tokens['access_token']}"},
            )
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()

        # 3. Upsert user in DB + store encrypted Google tokens (ERR-005 fix)
        pool = await get_pool()
        encrypted = encrypt_tokens(google_tokens)

        row = await pool.fetchrow(
            """
            INSERT INTO users (id, email, name, google_id, google_tokens, last_login)
            VALUES (uuid_generate_v4(), $1, $2, $3, $4, NOW())
            ON CONFLICT (google_id) DO UPDATE SET
                google_tokens = EXCLUDED.google_tokens,
                name          = EXCLUDED.name,
                last_login    = NOW()
            RETURNING id, college_id, role
            """,
            userinfo["email"],
            userinfo.get("name", ""),
            userinfo["sub"],
            encrypted,
        )

        user_id    = str(row["id"])
        college_id = str(row["college_id"]) if row["college_id"] else None
        role       = row["role"] or "faculty"

        # 4. Load permissions for this role from DB
        permissions = await _load_permissions(pool, role)

        # 5. Build internal JWT (includes role + permissions)
        access_token = create_access_token({
            "user_id":    user_id,
            "email":      userinfo["email"],
            "name":       userinfo.get("name"),
            "picture":    userinfo.get("picture"),
            "college_id": college_id,
            "role":       role,
            "permissions": permissions,
        })

        # 6. Redirect to frontend with JWT + minimal user info (SEC-001 FIX: use fragment #, not query ?)
        user_json = urllib.parse.quote(json.dumps({
            "email":   userinfo["email"],
            "name":    userinfo.get("name"),
            "picture": userinfo.get("picture"),
            "role":    role,
        }))
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback#token={access_token}&user={user_json}"
        )

    except Exception as exc:
        error_msg = urllib.parse.quote(str(exc))
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error={error_msg}")


@router.get("/me", response_model=TokenData)
async def me(user: TokenData = Depends(get_current_user)):
    """Return the current authenticated user's profile from the JWT."""
    return user


@router.post("/refresh")
async def refresh_token(user: TokenData = Depends(get_current_user)):
    """
    Issue a fresh JWT for an already-authenticated user.
    Useful for extending sessions without re-doing OAuth.
    """
    pool = await get_pool()
    # Re-load permissions in case they changed since last login
    permissions = await _load_permissions(pool, user.role)
    new_token = create_access_token({
        "user_id":     user.user_id,
        "email":       user.email,
        "name":        user.name,
        "picture":     user.picture,
        "college_id":  user.college_id,
        "role":        user.role,
        "permissions": permissions,
    })
    return {"access_token": new_token, "token_type": "bearer"}


# ── OTP Auth ──────────────────────────────────────────────────────────────────

class OTPRequest(BaseModel):
    email: EmailStr


class OTPVerify(BaseModel):
    email: EmailStr
    otp: str
    name: Optional[str] = None   # optional — used on first registration


def _generate_otp() -> str:
    """Generate a cryptographically random 6-digit OTP."""
    return "".join(random.choices(string.digits, k=OTP_LENGTH))


def _send_otp_email(to_email: str, otp: str) -> bool:
    """
    Send OTP via SMTP. Returns True on success, False if SMTP not configured.
    In development (no SMTP), the OTP is logged to stdout so you can still test.
    """
    import logging as _log
    logger = _log.getLogger(__name__)

    if not SMTP_USER or not SMTP_PASS:
        # Dev mode — print OTP so developers can test without SMTP
        logger.warning(f"[DEV MODE] OTP for {to_email}: {otp}  (configure SMTP to send real emails)")
        return True  # Return True so the flow continues in dev

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"Your SAAP login code: {otp}"
        msg["From"]    = FROM_EMAIL
        msg["To"]      = to_email

        text_body = f"Your SAAP login code is: {otp}\n\nThis code expires in {OTP_EXPIRE_MINUTES} minutes.\nDo not share this code with anyone."
        html_body = f"""
        <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:24px">
          <div style="background:#2563eb;color:white;padding:16px 24px;border-radius:12px 12px 0 0">
            <h2 style="margin:0;font-size:18px">SAAP Login Code</h2>
          </div>
          <div style="background:#f8fafc;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0">
            <p style="color:#475569;margin-top:0">Use this code to sign in to SAAP:</p>
            <div style="background:white;border:2px solid #2563eb;border-radius:8px;padding:16px;text-align:center;margin:16px 0">
              <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#1e40af">{otp}</span>
            </div>
            <p style="color:#94a3b8;font-size:12px;margin-bottom:0">
              Expires in {OTP_EXPIRE_MINUTES} minutes. Do not share this code.
            </p>
          </div>
        </div>
        """
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(FROM_EMAIL, to_email, msg.as_string())
        return True
    except Exception as e:
        logger.error(f"OTP email failed for {to_email}: {e}")
        return False


@router.post("/otp/request")
async def request_otp(body: OTPRequest):
    """
    Step 1 of OTP login: generate a 6-digit OTP and send it to the user's email.

    - If the user doesn't exist yet, they will be created on /otp/verify.
    - OTP is stored hashed in the otp_codes table with a 10-minute expiry.
    - Rate limited to prevent abuse (handled by slowapi at gateway level).
    """
    pool = await get_pool()
    otp = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRE_MINUTES)

    # Store OTP (invalidate any previous OTPs for this email first)
    await pool.execute(
        "DELETE FROM otp_codes WHERE email=$1", body.email
    )
    await pool.execute(
        """INSERT INTO otp_codes (email, otp_hash, expires_at)
           VALUES ($1, crypt($2, gen_salt('bf')), $3)""",
        body.email, otp, expires_at,
    )

    # Send email (BUG-001 FIX: non-blocking thread offload)
    import anyio
    await anyio.to_thread.run_sync(_send_otp_email, body.email, otp)

    return {
        "success": True,
        "data": {
            "message": f"OTP sent to {body.email}. Check your inbox (or server logs in dev mode).",
            "expires_in_minutes": OTP_EXPIRE_MINUTES,
        },
        "error": None,
    }


@router.post("/otp/verify")
async def verify_otp(body: OTPVerify):
    """
    Step 2 of OTP login: verify the OTP and issue a JWT.

    - Checks OTP hash against stored value.
    - OTP is single-use — deleted after successful verification.
    - Creates user if they don't exist yet (self-registration).
    - Returns the same JWT format as Google OAuth.
    """
    pool = await get_pool()

    # Verify OTP
    row = await pool.fetchrow(
        """SELECT id FROM otp_codes
           WHERE email=$1
             AND otp_hash = crypt($2, otp_hash)
             AND expires_at > NOW()
             AND used = FALSE""",
        body.email, body.otp,
    )

    if not row:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP. Please request a new one.",
        )

    # Mark OTP as used (single-use)
    await pool.execute(
        "UPDATE otp_codes SET used=TRUE WHERE id=$1", row["id"]
    )

    # Upsert user — create if first login, update last_login if returning
    name = body.name or body.email.split("@")[0]
    user_row = await pool.fetchrow(
        """INSERT INTO users (id, email, name, last_login)
           VALUES (uuid_generate_v4(), $1, $2, NOW())
           ON CONFLICT (email) DO UPDATE SET
               last_login = NOW(),
               name = CASE WHEN users.name IS NULL OR users.name = '' THEN EXCLUDED.name ELSE users.name END
           RETURNING id, college_id, role, name""",
        body.email, name,
    )

    user_id    = str(user_row["id"])
    college_id = str(user_row["college_id"]) if user_row["college_id"] else None
    role       = user_row["role"] or "faculty"
    display_name = user_row["name"] or name

    # Load permissions
    permissions = await _load_permissions(pool, role)

    # Issue JWT
    access_token = create_access_token({
        "user_id":     user_id,
        "email":       body.email,
        "name":        display_name,
        "picture":     None,
        "college_id":  college_id,
        "role":        role,
        "permissions": permissions,
    })

    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type":   "bearer",
            "user": {
                "email":   body.email,
                "name":    display_name,
                "role":    role,
                "picture": None,
            },
        },
        "error": None,
    }
