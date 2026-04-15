# SAAP — Tech Stack Documentation

## Overview

Smart Academic Automation Platform (SAAP) is built as a **microservices architecture** using a hybrid approach:
- **80–90% deterministic** processing (rules + NLP)
- **Minimal AI** usage (optional, max 2 API calls per paper)
- **100% open-source** core stack — runs at near-zero cost

---

## 1. Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Next.js** | 14.2.3 | React framework with App Router, SSR support |
| **React** | 18.3.1 | UI component library |
| **TypeScript** | 5.4.5 | Type safety across all components |
| **Tailwind CSS** | 3.4.3 | Utility-first styling, no CSS files needed |
| **TanStack Query** | 5.37.1 | Server state management, caching, auto-refetch |
| **React Hook Form** | 7.51.5 | Performant form handling |
| **Zod** | 3.23.8 | Schema validation for form inputs |
| **Recharts** | 2.12.7 | Analytics charts (bar, pie, line) |
| **Axios** | 1.7.2 | HTTP client with interceptors for JWT injection |
| **Lucide React** | 0.379.0 | Icon library |

### Why Next.js 14?
- App Router enables server components for faster initial loads
- `output: standalone` for minimal Docker image size
- Built-in API routes if needed for BFF pattern later

---

## 2. Backend — API Gateway

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.111.0 | Main API framework — async, auto Swagger docs |
| **Uvicorn** | 0.29.0 | ASGI server (async capable) |
| **python-jose** | 3.3.0 | JWT creation and verification |
| **httpx** | 0.27.0 | Async HTTP client for proxying to microservices |
| **python-multipart** | 0.0.9 | File upload handling |

### Why FastAPI over Django/Flask?
- Native `async/await` support — handles concurrent requests without blocking
- Auto-generates OpenAPI docs at `/docs`
- Pydantic v2 integration for request/response validation
- 3x faster than Flask in benchmarks

---

## 3. Backend — Syllabus Processing Service

| Technology | Version | Purpose |
|------------|---------|---------|
| **pdfplumber** | 0.11.0 | Extract text from PDF with layout awareness |
| **pytesseract** | 0.3.10 | OCR fallback for scanned/image PDFs |
| **Tesseract OCR** | system | OCR engine (installed via apt) |
| **Pillow** | 10.3.0 | Image processing for OCR pipeline |
| **spaCy** | 3.7.4 | NLP: NER, noun chunks, POS tagging |
| **en_core_web_sm** | — | spaCy small English model (free, local) |
| **NLTK** | 3.8.1 | Tokenization, stopwords, stemming |
| **scikit-learn** | 1.4.2 | TF-IDF vectorizer for topic extraction |
| **NumPy** | 1.26.4 | Matrix operations for TF-IDF scoring |
| **Celery** | 5.4.0 | Async task queue for background processing |
| **asyncpg** | 0.29.0 | Async PostgreSQL driver |

### NLP Pipeline (fully local, zero cost)
```
Raw PDF text
    ↓
Unit segmentation    → regex patterns (UNIT 1, Module 2, Chapter...)
    ↓
TF-IDF extraction    → top-N topic terms across sentences
    ↓
spaCy NER            → named entities (products, languages, laws)
    ↓
Noun chunk mining    → multi-word concept phrases
    ↓
Bloom's inference    → keyword matching against taxonomy verbs
    ↓
Knowledge Graph JSON → stored in PostgreSQL JSONB
```

---

## 4. Backend — Knowledge Graph Service

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.111.0 | REST API |
| **asyncpg** | 0.29.0 | Async PostgreSQL driver |
| **PostgreSQL JSONB** | — | Stores full graph + GIN index for fast queries |

### Storage Strategy
- `knowledge_graphs` table: full JSONB graph per subject
- `kg_topics` table: flattened rows for fast SQL filtering
- GIN index on JSONB for graph traversal queries
- One knowledge graph per subject — updated on re-upload, never duplicated

---

## 5. Backend — Rule Engine (Question Generation)

**Zero external dependencies** — pure Python logic.

| Component | Implementation |
|-----------|---------------|
| Exam patterns | Hardcoded dataclasses (midterm/final/quiz) |
| Bloom's taxonomy | 6-level keyword mapping dictionary |
| Marks distribution | Proportional scaling algorithm |
| Question templates | String templates per Bloom's level (30+ templates) |
| Answer key templates | Per-level structured response guides |
| Topic assignment | Weighted random selection with Bloom's distribution |

### Bloom's Taxonomy Levels Supported
`remember → understand → apply → analyze → evaluate → create`

---

## 6. Backend — Question Generation Service

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.111.0 | REST API |
| **asyncpg** | 0.29.0 | Store generated papers + questions |
| **httpx** | 0.27.0 | Fetch topics from knowledge service |

### Generation Flow
1. Fetch topics from knowledge service (Redis cached, 1hr TTL)
2. Rule engine assigns topics → question slots
3. Template engine fills question text deterministically
4. Optional: 1–2 OpenAI calls for grammar refinement
5. Generates Set A + Set B (shuffled topic order)
6. Faculty can edit any question before finalizing

---

## 7. Backend — Evaluation Service

| Technology | Version | Purpose |
|------------|---------|---------|
| **scikit-learn** | 1.4.2 | TF-IDF cosine similarity scoring |
| **NLTK** | 3.8.1 | Stemming for keyword matching |
| **pdfplumber** | 0.11.0 | Extract text from student submissions |
| **google-api-python-client** | 2.128.0 | Google Classroom + Drive API |
| **google-auth-oauthlib** | 1.2.0 | OAuth token refresh |

### Evaluation Algorithm (3 signals)
```
Student submission text
    ↓
Signal 1: Keyword Score (40%)
    → Fraction of expected keywords found (with stemming)

Signal 2: Semantic Score (40%)
    → TF-IDF cosine similarity vs answer key

Signal 3: Rubric Score (20%)
    → Per-criterion keyword matching (if rubric provided)
    → Falls back to semantic score if no rubric

Final Score = weighted combination
Confidence  = agreement between keyword + semantic signals
needs_review = confidence < 0.5  → flagged for faculty
```

### Privacy
- Student PDFs downloaded **in-memory only** — never persisted to disk
- No student data stored beyond marks + feedback

---

## 8. Backend — Analytics Service

| Technology | Version | Purpose |
|------------|---------|---------|
| **FastAPI** | 0.111.0 | REST API |
| **asyncpg** | 0.29.0 | Aggregate queries on evaluation results |

### Metrics Provided
- Score distribution (0–40, 40–60, 60–75, 75–90, 90–100 buckets)
- Assignment-wise average trends
- On-time vs late submission counts
- Flagged-for-review counts per session

---

## 9. Database

| Technology | Version | Purpose |
|------------|---------|---------|
| **PostgreSQL** | 15 | Primary relational database |
| **JSONB columns** | — | Knowledge graphs, rubrics, configs |
| **GIN indexes** | — | Fast JSONB search |
| **pg_trgm extension** | — | Fuzzy text search |
| **uuid-ossp extension** | — | UUID primary keys |

### Multi-Tenancy Strategy
- Every table has a `college_id` column
- API Gateway injects `X-College-Id` from JWT into every downstream request
- All queries filter by `college_id` — complete data isolation between colleges
- No row-level security needed — enforced at application layer

### Key Tables
```
colleges → users, subjects, classes, academic_years
subjects → uploaded_files (SHA-256 dedup), knowledge_graphs, question_papers
classes  → evaluation_sessions → evaluation_results
```

---

## 10. Caching & Queue

| Technology | Version | Purpose |
|------------|---------|---------|
| **Redis** | 7 | Cache + message broker |
| **Celery** | 5.4.0 | Distributed task queue |
| **redis-py** | 5.0.4 | Python Redis client |

### Queue Architecture
```
Redis DB 0  → Application cache (knowledge graphs, 1hr TTL)
Redis DB 1  → Celery broker (task messages)
Redis DB 2  → Celery result backend (task status)
```

### Async Tasks
| Task | Queue | Trigger |
|------|-------|---------|
| PDF processing + NLP | `syllabus` queue | File upload |
| Assignment evaluation | `evaluation` queue | Evaluate request |

---

## 11. Authentication & Security

| Technology | Purpose |
|------------|---------|
| **Google OAuth2** | Faculty login — no passwords stored |
| **JWT (HS256)** | Stateless session tokens (8hr expiry) |
| **python-jose** | JWT encode/decode |
| **RBAC** | Roles: `faculty`, `hod`, `admin` |

---

## 12. Infrastructure & DevOps

| Technology | Version | Purpose |
|------------|---------|---------|
| **Docker** | 24+ | Containerize all services |
| **Docker Compose** | v2 | Local orchestration |
| **GitHub Actions** | — | CI/CD pipeline |

### Docker Services
| Service | Base Image | Exposed Port |
|---------|-----------|-------------|
| frontend | node:20-alpine | 3000 |
| api-gateway | python:3.11-slim | 8000 |
| syllabus-service | python:3.11-slim | 8001 |
| knowledge-service | python:3.11-slim | 8002 |
| question-service | python:3.11-slim | 8003 |
| evaluation-service | python:3.11-slim | 8004 |
| analytics-service | python:3.11-slim | 8005 |
| celery-worker | python:3.11-slim | — |
| celery-beat | python:3.11-slim | — |
| postgres | postgres:15-alpine | 5432 |
| redis | redis:7-alpine | 6379 |

---

## 13. External Integrations

| Service | SDK | Usage |
|---------|-----|-------|
| **Google Classroom API** | google-api-python-client | List courses, coursework, submissions |
| **Google Drive API** | google-api-python-client | Download student submission PDFs |
| **Google OAuth2** | google-auth-oauthlib | Faculty login + token refresh |
| **OpenAI API** | openai (optional) | Grammar/clarity refinement only, max 2 calls/paper |

---

## 14. Cost Breakdown

| Component | Technology | Monthly Cost |
|-----------|-----------|-------------|
| NLP processing | spaCy + NLTK + TF-IDF (local) | **$0** |
| PDF extraction | pdfplumber + pytesseract (local) | **$0** |
| Semantic similarity | TF-IDF cosine (local) | **$0** |
| AI refinement | OpenAI (optional, ~2 calls/paper) | **~$0.01/paper** |
| Database | PostgreSQL (self-hosted) | **~$10/mo** |
| Cache + Queue | Redis (self-hosted) | **~$5/mo** |
| Hosting (small) | Render / Railway | **$7–50/mo** |
| **Total** | | **~$22–65/mo** |

---

## 15. Scaling Strategy

| Bottleneck | Solution |
|-----------|---------|
| Heavy PDF processing | Add more Celery workers (`--concurrency=8`) |
| High API traffic | Scale individual FastAPI services horizontally |
| DB read load | Add PostgreSQL read replicas for analytics |
| Knowledge graph queries | Redis cache (1hr TTL) eliminates repeated DB hits |
| Large file uploads | Swap local volume for AWS S3 / GCS |
| Production orchestration | Migrate `docker-compose.yml` → Kubernetes manifests |
