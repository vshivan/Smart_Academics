# ── celery-workers — optimized ───────────────────────────────
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        tesseract-ocr \
        poppler-utils \
        libpq-dev \
        gcc \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r saap && useradd -r -g saap -d /app saap

WORKDIR /app

COPY workers/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && python -m spacy download en_core_web_sm \
    && python -c "import nltk; nltk.download('stopwords', quiet=True); nltk.download('punkt', quiet=True)"

COPY shared/monitoring.py ./monitoring.py
# Workers need syllabus-service modules for task imports
COPY syllabus-service/pdf_extractor.py ./pdf_extractor.py
COPY syllabus-service/nlp_pipeline.py  ./nlp_pipeline.py
COPY workers/ .

RUN chown -R saap:saap /app
USER saap
