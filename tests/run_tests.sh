#!/bin/bash
# ============================================================
# SAAP Test Runner
# Usage:
#   ./tests/run_tests.sh unit        — unit tests only (no Docker needed)
#   ./tests/run_tests.sh integration — integration tests (Docker must be up)
#   ./tests/run_tests.sh all         — everything
# ============================================================

set -e
MODE=${1:-unit}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

echo "================================================"
echo " SAAP Test Suite — Mode: $MODE"
echo "================================================"

# Install test deps if needed
pip install -q -r "$SCRIPT_DIR/requirements-test.txt"
python -m spacy download en_core_web_sm -q 2>/dev/null || true
python -c "import nltk; nltk.download('stopwords', quiet=True); nltk.download('punkt', quiet=True)"

cd "$ROOT_DIR"

case "$MODE" in
  unit)
    echo "Running unit tests..."
    pytest tests/test_nlp_pipeline.py \
           tests/test_rule_engine.py \
           tests/test_evaluator.py \
           tests/test_auth.py \
           tests/test_pdf_extractor.py \
           -v --tb=short --cov=backend --cov-report=term-missing
    ;;
  integration)
    echo "Running integration tests (requires docker-compose up)..."
    pytest tests/test_api_integration.py -v --tb=short
    ;;
  all)
    echo "Running all tests..."
    pytest tests/ -v --tb=short \
           --cov=backend --cov-report=term-missing \
           --cov-report=html:tests/coverage_report
    echo "Coverage report: tests/coverage_report/index.html"
    ;;
  *)
    echo "Unknown mode: $MODE. Use: unit | integration | all"
    exit 1
    ;;
esac

echo "================================================"
echo " Tests complete!"
echo "================================================"
