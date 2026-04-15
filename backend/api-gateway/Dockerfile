# ── api-gateway — optimized ──────────────────────────────────
# Build context: ./backend  (set in docker-compose.yml)
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r saap && useradd -r -g saap -d /app saap

WORKDIR /app

COPY api-gateway/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Shared monitoring (Sentry)
COPY shared/monitoring.py ./monitoring.py

COPY api-gateway/ .

RUN chown -R saap:saap /app
USER saap

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
