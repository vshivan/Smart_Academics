"""Reverse proxy helper for API gateway."""
import httpx
from fastapi import Request, HTTPException
from fastapi.responses import Response


async def proxy_request(request: Request, service_url: str, path: str, user) -> Response:
    """Forward request to downstream service with user context headers."""
    url = f"{service_url}{path}"
    headers = {
        "X-User-Id": str(user.user_id),
        "X-User-Email": user.email,
        "X-User-Role": user.role,
        "X-College-Id": str(user.college_id) if user.college_id else "",
        "Content-Type": request.headers.get("content-type", "application/json"),
    }

    body = await request.body()
    params = dict(request.query_params)

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
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
