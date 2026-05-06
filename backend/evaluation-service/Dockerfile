# ── evaluation-service — optimized ───────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r saap && useradd -r -g saap -d /app saap

WORKDIR /app

COPY evaluation-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -c "import nltk; nltk.download('stopwords', quiet=True); nltk.download('punkt', quiet=True)"

COPY shared/monitoring.py ./monitoring.py
COPY shared/response.py ./response.py
COPY shared/cache.py ./cache.py
COPY evaluation-service/ .

RUN chown -R saap:saap /app
USER saap

EXPOSE 8004
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8004"]
