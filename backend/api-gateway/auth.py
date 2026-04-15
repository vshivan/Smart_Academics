"""OAuth2 + JWT authentication."""
import os
import json
import urllib.parse
from datetime import datetime, timedelta, timezone
from typing import Optional

import asyncpg
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from pydantic import BaseModel

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-prod")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 8  # 8 hours

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/callback")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://saap:saap_pass@postgres:5432/saap_db")

router = APIRouter()
bearer_scheme = HTTPBearer()

# Shared DB pool for auth service
_pool = None


async def get_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)
    return _pool


class TokenData(BaseModel):
    user_id: str
    email: str
    college_id: Optional[str] = None
    role: str = "faculty"


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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@router.get("/login")
async def login():
    """Redirect browser to Google OAuth consent screen."""
    scope = (
        "openid email profile "
        "https://www.googleapis.com/auth/classroom.courses.readonly "
        "https://www.googleapis.com/auth/classroom.coursework.students "
        "https://www.googleapis.com/auth/drive.readonly"
    )
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
    Exchange Google auth code for tokens.
    Upsert user + store OAuth tokens in DB.
    Redirect browser to frontend with JWT.
    """
    try:
        async with httpx.AsyncClient() as client:
            # 1. Exchange code for Google tokens
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
                error_msg = urllib.parse.quote(token_resp.text)
                return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error={error_msg}")

            google_tokens = token_resp.json()

            # 2. Fetch user profile
            userinfo_resp = await client.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                headers={"Authorization": f"Bearer {google_tokens['access_token']}"},
            )
            userinfo_resp.raise_for_status()
            userinfo = userinfo_resp.json()

        # 3. Upsert user + store tokens in DB (ERR-005 fix)
        pool = await get_pool()
        row = await pool.fetchrow(
            """INSERT INTO users (id, email, name, google_id, google_tokens, last_login)
               VALUES (uuid_generate_v4(), $1, $2, $3, $4::jsonb, NOW())
               ON CONFLICT (google_id) DO UPDATE SET
                   google_tokens = EXCLUDED.google_tokens,
                   name          = EXCLUDED.name,
                   last_login    = NOW()
               RETURNING id, college_id, role""",
            userinfo["email"],
            userinfo.get("name", ""),
            userinfo["sub"],
            json.dumps(google_tokens),
        )

        user_id = str(row["id"])
        college_id = str(row["college_id"]) if row["college_id"] else None
        role = row["role"] or "faculty"

        # 4. Build internal JWT
        access_token = create_access_token({
            "user_id": user_id,
            "email": userinfo["email"],
            "name": userinfo.get("name"),
            "picture": userinfo.get("picture"),
            "college_id": college_id,
            "role": role,
        })

        # 5. Redirect to frontend callback with token
        user_json = urllib.parse.quote(json.dumps({
            "email": userinfo["email"],
            "name": userinfo.get("name"),
            "picture": userinfo.get("picture"),
        }))
        return RedirectResponse(
            f"{FRONTEND_URL}/auth/callback?token={access_token}&user={user_json}"
        )

    except Exception as exc:
        error_msg = urllib.parse.quote(str(exc))
        return RedirectResponse(f"{FRONTEND_URL}/auth/callback?error={error_msg}")


@router.get("/me")
async def me(user: TokenData = Depends(get_current_user)):
    return user
