FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r saap && useradd -r -g saap -d /app saap
WORKDIR /app
COPY notification-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared/monitoring.py ./monitoring.py
COPY shared/response.py ./response.py
COPY shared/cache.py ./cache.py
COPY notification-service/ .
RUN chown -R saap:saap /app
USER saap
EXPOSE 8010
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010"]
