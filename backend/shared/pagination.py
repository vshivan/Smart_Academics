"""Shared pagination utilities for all services."""
from fastapi import Query
from typing import Optional


class PaginationParams:
    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number"),
        limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.limit = limit
        self.offset = (page - 1) * limit


def paginate_response(items: list, total: int, page: int, limit: int) -> dict:
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit,
        "has_next": page * limit < total,
        "has_prev": page > 1,
    }
