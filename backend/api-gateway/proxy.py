"""
Reverse proxy helper — forwards authenticated requests to downstream services.

Injects user context as trusted internal headers so downstream services
don't need to re-validate the JWT.
"""
import json
import httpx
from typing import Optional
from fastapi import Request, HTTPException
from fastapi.responses import Response


_client: Optional[httpx.AsyncClient] = None

async def get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=30.0,
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20)
        )
    return _client


async def proxy_request(request: Request, service_url: str, path: str, user) -> Response:
    """
    Forward the incoming request to a downstream microservice.
    """
    url = f"{service_url}{path}"
    client = await get_client()

    headers = {
        "X-User-Id":     str(user.user_id),
        "X-User-Email":  user.email,
        "X-User-Role":   user.role,
        "X-College-Id":  str(user.college_id) if user.college_id else "",
        "X-Permissions": json.dumps(getattr(user, "permissions", [])),
    }

    content_type = request.headers.get("content-type")
    if content_type:
        headers["Content-Type"] = content_type

    body   = await request.body()
    params = dict(request.query_params)

    try:
        resp = await client.request(
            method=request.method,
            url=url,
            headers=headers,
            content=body,
            params=params,
        )
        return Response(
            content=resp.content,
            status_code=resp.status_code,
            media_type=resp.headers.get("content-type", "application/json"),
        )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail=f"Service unavailable: {service_url}")
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Service timeout")
