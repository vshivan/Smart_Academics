#!/bin/sh
# Run all pending migrations in order.
# Called by docker-compose healthcheck or manually.
set -e

DB="${DATABASE_URL:-postgresql://saap:saap_pass@postgres:5432/saap_db}"
MIGRATIONS_DIR="$(dirname "$0")/migrations"

echo "Running SAAP database migrations..."

for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "  Applying: $(basename $f)"
  psql "$DB" -f "$f" -v ON_ERROR_STOP=0 2>&1 | grep -v "^NOTICE" || true
done

echo "Migrations complete."
