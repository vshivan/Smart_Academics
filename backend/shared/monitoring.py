"""
Sentry error monitoring — drop this file into any service directory.
Set SENTRY_DSN in .env to enable. Safe no-op if DSN is not set.
"""
import os
import logging

logger = logging.getLogger(__name__)


def init_sentry(service_name: str) -> None:
    """Initialize Sentry. Silently skips if SENTRY_DSN is not configured."""
    dsn = os.getenv("SENTRY_DSN", "").strip()
    if not dsn:
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.asyncpg import AsyncPGIntegration

        sentry_sdk.init(
            dsn=dsn,
            environment=os.getenv("ENVIRONMENT", "development"),
            release=os.getenv("APP_VERSION", "1.0.0"),
            traces_sample_rate=float(os.getenv("SENTRY_TRACES_RATE", "0.1")),
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                AsyncPGIntegration(),
            ],
            before_send=_scrub_sensitive,
        )
        logger.info(f"Sentry active: service={service_name} env={os.getenv('ENVIRONMENT')}")
    except ImportError:
        logger.debug("sentry-sdk not installed — skipping monitoring")
    except Exception as e:
        logger.warning(f"Sentry init failed: {e}")


def _scrub_sensitive(event: dict, hint: dict) -> dict:
    """Strip secrets before sending events to Sentry."""
    REDACT = {"password", "secret", "token", "access_token", "google_tokens", "client_secret", "authorization"}
    req = event.get("request", {})
    for section in ("headers", "data", "cookies"):
        for key in list(req.get(section, {}).keys()):
            if any(r in key.lower() for r in REDACT):
                req[section][key] = "[Filtered]"
    return event
