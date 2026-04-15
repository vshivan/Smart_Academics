"""Celery task registry — imports all service tasks."""
import os
from celery import Celery

celery_app = Celery(
    "saap_workers",
    broker=os.getenv("CELERY_BROKER_URL", "redis://redis:6379/1"),
    backend=os.getenv("CELERY_RESULT_BACKEND", "redis://redis:6379/2"),
    include=["syllabus_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_routes={
        "syllabus_tasks.*": {"queue": "syllabus"},
        "evaluation_tasks.*": {"queue": "evaluation"},
    },
)
