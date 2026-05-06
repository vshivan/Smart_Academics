"""
Redis caching utility — shared across all services.

Usage:
    from shared.cache import Cache

    cache = Cache()  # reads REDIS_URL from env

    # Cache a knowledge graph for 1 hour
    await cache.set("kg:subject_id", graph_data, ttl=3600)
    cached = await cache.get("kg:subject_id")

    # Invalidate on update
    await cache.delete("kg:subject_id")

    # Cache-aside pattern helper
    data = await cache.get_or_set(
        key="kg:subject_id",
        fetch_fn=lambda: db.fetch_graph(subject_id),
        ttl=3600,
    )
"""
import os
import json
import logging
from typing import Any, Callable, Optional

logger = logging.getLogger(__name__)

try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    _REDIS_AVAILABLE = False
    logger.warning("redis package not installed — caching disabled")


class Cache:
    """Async Redis cache with JSON serialisation and graceful degradation."""

    def __init__(self, url: Optional[str] = None, prefix: str = "saap"):
        self._url    = url or os.getenv("REDIS_URL", "redis://redis:6379/0")
        self._prefix = prefix
        self._client: Optional[Any] = None

    async def _get_client(self):
        if not _REDIS_AVAILABLE:
            return None
        if self._client is None:
            try:
                self._client = aioredis.from_url(
                    self._url,
                    encoding="utf-8",
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
            except Exception as e:
                logger.warning(f"Redis connection failed: {e}")
                return None
        return self._client

    def _key(self, key: str) -> str:
        return f"{self._prefix}:{key}"

    async def get(self, key: str) -> Optional[Any]:
        """Return cached value or None on miss/error."""
        client = await self._get_client()
        if not client:
            return None
        try:
            raw = await client.get(self._key(key))
            return json.loads(raw) if raw is not None else None
        except Exception as e:
            logger.debug(f"Cache GET error [{key}]: {e}")
            return None

    async def set(self, key: str, value: Any, ttl: int = 3600) -> bool:
        """Store value as JSON. Returns True on success."""
        client = await self._get_client()
        if not client:
            return False
        try:
            await client.setex(self._key(key), ttl, json.dumps(value, default=str))
            return True
        except Exception as e:
            logger.debug(f"Cache SET error [{key}]: {e}")
            return False

    async def delete(self, key: str) -> bool:
        """Invalidate a cache key."""
        client = await self._get_client()
        if not client:
            return False
        try:
            await client.delete(self._key(key))
            return True
        except Exception as e:
            logger.debug(f"Cache DELETE error [{key}]: {e}")
            return False

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern (e.g. 'kg:*')."""
        client = await self._get_client()
        if not client:
            return 0
        try:
            keys = await client.keys(self._key(pattern))
            if keys:
                return await client.delete(*keys)
            return 0
        except Exception as e:
            logger.debug(f"Cache DELETE_PATTERN error [{pattern}]: {e}")
            return 0

    async def get_or_set(
        self,
        key: str,
        fetch_fn: Callable,
        ttl: int = 3600,
    ) -> Any:
        """
        Cache-aside pattern:
          1. Try cache
          2. On miss, call fetch_fn()
          3. Store result in cache
          4. Return result

        fetch_fn can be sync or async.
        """
        cached = await self.get(key)
        if cached is not None:
            logger.debug(f"Cache HIT [{key}]")
            return cached

        logger.debug(f"Cache MISS [{key}] — fetching from source")
        import asyncio
        if asyncio.iscoroutinefunction(fetch_fn):
            value = await fetch_fn()
        else:
            value = fetch_fn()

        if value is not None:
            await self.set(key, value, ttl=ttl)

        return value

    async def ping(self) -> bool:
        """Health check — returns True if Redis is reachable."""
        client = await self._get_client()
        if not client:
            return False
        try:
            return await client.ping()
        except Exception:
            return False


# Module-level singleton — import and use directly
cache = Cache()
