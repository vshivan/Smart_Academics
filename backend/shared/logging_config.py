"""
Centralised structured logging configuration.

Usage in any service:
    from shared.logging_config import get_logger
    logger = get_logger("syllabus-service")
    logger.info("File uploaded", extra={"file_id": file_id, "college_id": college_id})
"""
import os
import logging
import json
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    """Emit log records as single-line JSON for log aggregators (Datadog, CloudWatch, etc.)."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level":     record.levelname,
            "logger":    record.name,
            "message":   record.getMessage(),
            "service":   os.getenv("SERVICE_NAME", record.name),
            "env":       os.getenv("ENVIRONMENT", "development"),
        }

        # Include any extra fields passed via extra={}
        for key, value in record.__dict__.items():
            if key not in (
                "name", "msg", "args", "levelname", "levelno", "pathname",
                "filename", "module", "exc_info", "exc_text", "stack_info",
                "lineno", "funcName", "created", "msecs", "relativeCreated",
                "thread", "threadName", "processName", "process", "message",
                "taskName",
            ):
                log_entry[key] = value

        if record.exc_info:
            log_entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_entry, default=str)


def get_logger(service_name: str) -> logging.Logger:
    """
    Return a configured logger for the given service.
    Uses JSON format in production, human-readable in development.
    """
    logger = logging.getLogger(service_name)

    if logger.handlers:
        return logger  # Already configured

    level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)
    logger.setLevel(level)

    handler = logging.StreamHandler()
    handler.setLevel(level)

    if os.getenv("ENVIRONMENT") == "production":
        handler.setFormatter(JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
                datefmt="%H:%M:%S",
            )
        )

    logger.addHandler(handler)
    logger.propagate = False
    return logger
