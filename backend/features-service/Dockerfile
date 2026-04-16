FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev gcc \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r saap && useradd -r -g saap -d /app saap
WORKDIR /app
COPY features-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY shared/monitoring.py ./monitoring.py
COPY features-service/ .
RUN chown -R saap:saap /app
USER saap
EXPOSE 8008
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8008"]
