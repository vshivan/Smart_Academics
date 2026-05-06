"""
Standardised API response envelope.

All endpoints should return:
  {
    "success": true | false,
    "data":    <payload> | null,
    "error":   null | { "code": "...", "message": "..." },
    "meta":    null | { "page": 1, "total": 100, ... }
  }

Usage:
    from shared.response import ok, fail, paginated

    @app.get("/items")
    async def list_items():
        items = await db.fetch_all()
        return ok({"items": items})

    @app.get("/items/{id}")
    async def get_item(id: str):
        item = await db.fetch(id)
        if not item:
            return fail("NOT_FOUND", "Item not found", status_code=404)
        return ok(item)
"""
from typing import Any, Optional
from fastapi.responses import JSONResponse


def ok(data: Any = None, meta: Optional[dict] = None, status_code: int = 200) -> JSONResponse:
    """Return a successful response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": True,
            "data":    data,
            "error":   None,
            "meta":    meta,
        },
    )


def fail(
    code: str,
    message: str,
    status_code: int = 400,
    details: Optional[Any] = None,
) -> JSONResponse:
    """Return an error response."""
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "data":    None,
            "error": {
                "code":    code,
                "message": message,
                "details": details,
            },
            "meta": None,
        },
    )


def paginated(
    items: list,
    total: int,
    page: int,
    page_size: int,
) -> JSONResponse:
    """Return a paginated list response."""
    return JSONResponse(
        status_code=200,
        content={
            "success": True,
            "data":    items,
            "error":   None,
            "meta": {
                "total":      total,
                "page":       page,
                "page_size":  page_size,
                "total_pages": (total + page_size - 1) // page_size,
            },
        },
    )
