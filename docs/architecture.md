# SAAP — Architecture Reference

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FACULTY BROWSER                          │
│                    Next.js 14 (Port 3000)                       │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS
┌──────────────────────────▼──────────────────────────────────────┐
│                    API GATEWAY (Port 8000)                       │
│         FastAPI · JWT Auth · Rate Limiting · Routing            │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬───────────────────┘
   │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼
[Auth] [Syll] [KG]  [Rule] [Qstn] [Eval] [Anlyt]
 8000   8001   8002  (lib)   8003   8004   8005

                           │
              ┌────────────▼────────────┐
              │     ASYNC LAYER         │
              │  Redis Queue + Celery   │
              │  Workers (PDF, Eval)    │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │      PostgreSQL 15      │
              │   Multi-tenant schema   │
              │   (college_id on all)   │
              └─────────────────────────┘
```

## Data Flow: Upload Once, Reuse Always

```
Faculty uploads PDF
        │
        ▼
SHA-256 hash check ──► Already exists? ──► Return cached knowledge graph
        │ (new file)
        ▼
Save to /uploads
        │
        ▼
Celery Queue (syllabus queue)
        │
        ▼
PDFPlumber extract text
        │ (< 100 chars?)
        ▼
pytesseract OCR fallback
        │
        ▼
NLP Pipeline (spaCy + TF-IDF)
  ├── Unit segmentation (regex patterns)
  ├── Topic extraction (TF-IDF top-N)
  ├── NER (spaCy named entities)
  └── Bloom's level inference (keyword matching)
        │
        ▼
Knowledge Graph JSON stored in PostgreSQL
        │
        ▼
kg_topics table populated (flattened for fast queries)
        │
        ▼
File status → "done", faculty notified
```

## Question Generation Flow

```
POST /generate-paper
        │
        ▼
Fetch kg_topics (cached in Redis 1hr)
        │
        ▼
Rule Engine: get_pattern(exam_type, total_marks)
  ├── Section definitions (short/long/mcq counts)
  ├── Bloom's distribution weights
  └── Difficulty distribution
        │
        ▼
distribute_topics_to_questions()
  └── Random weighted assignment of topics → question slots
        │
        ▼
For each slot: get_question_template(blooms_level, topic)
  └── Template strings with topic substitution (deterministic)
        │
        ▼
get_answer_key(blooms_level, topic)
        │
        ▼ (optional, max 2 calls)
AI Refinement: grammar/clarity only
        │
        ▼
Store in question_papers + questions tables
Return paper_ids (Set A, Set B)
```

## Evaluation Flow

```
POST /evaluate-assignment
        │
        ▼
Create evaluation_session record
        │
        ▼
Background Task (FastAPI BackgroundTasks)
        │
        ▼
Google Classroom API → list_submissions()
        │
        ▼
For each submission:
  ├── Download PDF from Drive (in-memory only)
  ├── pdfplumber text extraction
  └── AssignmentEvaluator.evaluate()
        ├── keyword_score: fraction of expected keywords found (40%)
        ├── semantic_score: TF-IDF cosine similarity (40%)
        └── rubric_score: per-criterion keyword matching (20%)
              │
              ▼
        confidence = agreement between signals
        needs_review = confidence < 0.5
              │
              ▼
        Store in evaluation_results
        Faculty can override any result
```

## Database Schema (Key Relations)

```
colleges (1)
  └── users (N)
  └── academic_years (N)
  └── subjects (N)
       └── uploaded_files (N)  ← SHA-256 dedup
       └── knowledge_graphs (1) ← one per subject
            └── kg_topics (N)   ← flattened for queries
       └── question_papers (N)
            └── questions (N)
  └── classes (N)
       └── evaluation_sessions (N)
            └── evaluation_results (N)
       └── analytics_snapshots (N)
```

## Multi-Tenancy Strategy

- Every table has `college_id` column
- API Gateway injects `X-College-Id` header from JWT
- All queries filter by `college_id` — complete data isolation
- No cross-college data leakage possible at query level

## Cost Optimization

| Component | Approach | Cost |
|-----------|----------|------|
| NLP | spaCy + NLTK + TF-IDF (local) | $0 |
| Embeddings | TF-IDF cosine (local) | $0 |
| AI Refinement | Max 2 OpenAI calls/paper, optional | ~$0.01/paper |
| PDF Processing | pdfplumber + pytesseract (local) | $0 |
| Database | PostgreSQL (self-hosted) | ~$10/mo |
| Queue | Redis (self-hosted) | ~$5/mo |
| Hosting | Render/Railway free tier or $7/mo | ~$7-50/mo |

## Scaling Strategy

- **Horizontal**: Each microservice scales independently via Docker replicas
- **Queue workers**: Add Celery workers for heavy PDF/eval load
- **DB**: Read replicas for analytics queries
- **Cache**: Redis caches knowledge graphs (1hr TTL) — eliminates repeated DB hits
- **CDN**: Static assets via Vercel/CloudFront
