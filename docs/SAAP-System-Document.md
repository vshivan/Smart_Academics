# Smart Academic Automation Platform (SAAP)
## System Documentation — Version 1.0

---

# Table of Contents

1. Executive Summary
2. Problem Statement
3. Proposed Solution
4. System Overview
5. Architecture
6. Technology Stack
7. Features (15 Modules)
8. User Flow
9. Database Design
10. API Overview
11. Security
12. Testing
13. Deployment
14. Future Scope
15. Team & Acknowledgements

---

# 1. Executive Summary

**SAAP (Smart Academic Automation Platform)** is a web-based system designed to automate the most time-consuming academic tasks faced by college faculty — question paper generation, assignment evaluation, and academic analytics.

The platform uses **Natural Language Processing (NLP)** and **rule-based deterministic logic** to perform 80–90% of the work automatically, with minimal reliance on expensive AI APIs. It is built as a **multi-tenant SaaS platform**, meaning multiple colleges can use the same system with complete data isolation.

**Key Highlights:**
- Generates Bloom's taxonomy-mapped question papers in seconds
- Auto-grades assignments fetched from Google Classroom
- Provides real-time analytics on student performance
- Supports 15 features including plagiarism detection, question bank, rubric builder, and more
- Built with open-source tools — near-zero AI cost

---

# 2. Problem Statement

Indian colleges face significant challenges in academic administration:

| Problem | Impact |
|---------|--------|
| Faculty spend 4–8 hours manually creating question papers | Less time for teaching and research |
| Manual assignment grading is inconsistent and slow | Delayed feedback to students |
| No centralized analytics on student performance | Difficult to identify struggling students early |
| Question papers are often repeated across semesters | Academic integrity issues |
| No plagiarism detection for assignments | Unfair grading |
| Syllabus changes require rebuilding everything from scratch | Wasted effort |

**Root Cause:** Lack of affordable, integrated academic automation tools built specifically for Indian colleges.

**Existing Solutions Fall Short:**
- International tools (Turnitin, Canvas) are expensive and not localized
- Manual processes are error-prone and time-consuming
- No single platform covers the full academic workflow

---

# 3. Proposed Solution

SAAP addresses all these problems through a single integrated platform:

```
Faculty uploads syllabus PDF (once)
         ↓
System extracts topics, units, Bloom's levels automatically
         ↓
Faculty generates question papers in seconds
         ↓
Students submit assignments via Google Classroom
         ↓
System auto-grades all submissions
         ↓
Faculty reviews analytics and flags
```

**Core Philosophy:**
- **Upload once, reuse forever** — same syllabus powers paper generation and evaluation
- **80–90% deterministic** — rules + NLP, not expensive AI
- **Faculty-first design** — non-technical users can operate the full system

---

# 4. System Overview

SAAP is a **full-stack web application** accessible from any browser. No software installation is required for end users.

**Who uses it:**

| Role | What they do |
|------|-------------|
| **Faculty** | Upload syllabi, generate papers, evaluate assignments, view analytics |
| **HOD** | View department-wide analytics, manage faculty roles |
| **Admin** | Manage colleges, departments, academic years |

**How it works at a high level:**

1. Faculty signs in with their Google account
2. Sets up their college, department, subject, and class (one-time)
3. Uploads the subject syllabus PDF
4. System processes the PDF and builds a knowledge graph of topics
5. Faculty generates question papers using Bloom's taxonomy
6. Faculty connects Google Classroom to auto-fetch student submissions
7. System evaluates all submissions and provides grades + feedback
8. Faculty reviews analytics, overrides if needed, exports PDF papers

---

# 5. Architecture

## 5.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FACULTY BROWSER                       │
│              Next.js 14 (Port 3000)                      │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
┌──────────────────────▼──────────────────────────────────┐
│               API GATEWAY (Port 8000)                    │
│         FastAPI · JWT Auth · Rate Limiting               │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬────────────┘
   │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼
[Mgmt] [Syll] [KG]  [Qstn] [Eval] [Anlyt] [Feat]
 8006   8001   8002   8003   8004   8005   8008
                           │
              ┌────────────▼────────────┐
              │     ASYNC LAYER         │
              │  Redis Queue + Celery   │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │      PostgreSQL 15      │
              │   Multi-tenant schema   │
              └─────────────────────────┘
```

## 5.2 Microservices

| Service | Port | Responsibility |
|---------|------|---------------|
| API Gateway | 8000 | Single entry point, auth, routing |
| Syllabus Service | 8001 | PDF upload, OCR, NLP processing |
| Knowledge Service | 8002 | Knowledge graph storage and queries |
| Question Service | 8003 | Paper generation, rule engine |
| Evaluation Service | 8004 | Assignment grading, Google Classroom |
| Analytics Service | 8005 | Metrics, trends, performance |
| Management Service | 8006 | College, subject, class, faculty |
| Export Service | 8007 | PDF generation with ReportLab |
| Features Service | 8008 | Question bank, rubrics, plagiarism, notifications |

## 5.3 Data Flow — Syllabus Processing

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
Celery Queue (async)
        │
        ▼
PDFPlumber extract text
        │ (< 100 chars?)
        ▼
pytesseract OCR fallback
        │
        ▼
NLP Pipeline (spaCy + TF-IDF)
  ├── Unit segmentation (regex)
  ├── Topic extraction (TF-IDF top-N)
  ├── NER (spaCy named entities)
  └── Bloom's level inference (keyword matching)
        │
        ▼
Knowledge Graph JSON → PostgreSQL
```

## 5.4 Data Flow — Question Generation

```
Faculty selects: Subject ID + Exam Type + Bloom's Mode
        │
        ▼
Fetch topics from knowledge graph (Redis cached)
        │
        ▼
Rule Engine: get_pattern(exam_type, total_marks)
  ├── Section definitions (short/long/MCQ counts)
  ├── Bloom's distribution weights
  └── Difficulty distribution
        │
        ▼
Assign topics to question slots (weighted random)
        │
        ▼
Fill templates: "Define {topic}." / "Analyze {topic} vs {alt_topic}."
        │
        ▼
Generate answer keys per Bloom's level
        │
        ▼ (optional, max 2 calls)
AI Refinement: grammar/clarity only
        │
        ▼
Store in DB → Return Set A + Set B
```

## 5.5 Data Flow — Evaluation

```
Faculty provides: Class ID + Coursework ID + Answer Key + Keywords
        │
        ▼
Google Classroom API → list_submissions()
        │
        ▼
For each submission:
  ├── Download PDF from Drive (in-memory only)
  ├── pdfplumber text extraction
  └── AssignmentEvaluator.evaluate()
        ├── Keyword Score (40%): fraction of expected keywords found
        ├── Semantic Score (40%): TF-IDF cosine similarity vs answer key
        └── Rubric Score (20%): per-criterion keyword matching
              │
              ▼
        Confidence = agreement between keyword + semantic signals
        needs_review = confidence < 0.5
              │
              ▼
        Store in evaluation_results
        Faculty can override any result
```

---

# 6. Technology Stack

## 6.1 Backend

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| API Framework | **FastAPI** | 0.111.0 | REST APIs, async, auto Swagger docs |
| Language | **Python** | 3.11 | All backend services |
| Server | **Uvicorn** | 0.29.0 | ASGI server |
| Auth | **JWT + Google OAuth2** | — | Secure login |
| DB Driver | **asyncpg** | 0.29.0 | Async PostgreSQL |
| Task Queue | **Celery** | 5.4.0 | Background processing |
| HTTP Client | **httpx** | 0.27.0 | Inter-service communication |

## 6.2 NLP & AI (All Local — Zero Cost)

| Task | Technology | Cost |
|------|-----------|------|
| PDF text extraction | **pdfplumber** | Free |
| OCR fallback | **pytesseract** + Tesseract | Free |
| NLP pipeline | **spaCy** (en_core_web_sm) | Free |
| Topic extraction | **TF-IDF** (scikit-learn) | Free |
| Semantic similarity | **TF-IDF cosine** (scikit-learn) | Free |
| Tokenization | **NLTK** | Free |
| PDF generation | **ReportLab** | Free |
| Optional AI refinement | OpenAI API (max 2 calls/paper) | ~₹0.80/paper |

## 6.3 Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Next.js** | 14.2.3 | React framework, App Router |
| **React** | 18.3.1 | UI components |
| **TypeScript** | 5.4.5 | Type safety |
| **Tailwind CSS** | 3.4.3 | Utility-first styling |
| **TanStack Query** | 5.37.1 | Server state, caching |
| **React Hook Form** | 7.51.5 | Form handling |
| **Recharts** | 2.12.7 | Analytics charts |
| **Lucide React** | 0.379.0 | Icons |

## 6.4 Infrastructure

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Database | **PostgreSQL 15** | Primary data store |
| Cache + Queue | **Redis 7** | Caching + Celery broker |
| Containers | **Docker + Docker Compose** | Local + production deployment |
| CI/CD | **GitHub Actions** | Automated testing + build |
| Error Monitoring | **Sentry** | Production error tracking |

---

# 7. Features (15 Modules)

## Module 1: Syllabus Processing
- Upload PDF once — processed and stored permanently
- SHA-256 deduplication — same file never reprocessed
- OCR fallback for scanned PDFs
- Extracts: units, topics, keywords, Bloom's levels
- Version history — roll back to any previous version

## Module 2: Question Paper Generation
- **Bloom's Taxonomy Mode** — standard presets (Midterm/Final/Quiz)
- **Custom Mode** — manual sliders for each Bloom's level
- Generates 2 paper sets (A & B) simultaneously
- Edit any question before finalizing
- Finalize to lock paper for distribution

## Module 3: PDF Export
- Download formatted A4 paper with college header
- Separate answer key sheet (optional)
- Sections auto-grouped by question type

## Module 4: Assignment Evaluation
- Fetches submissions directly from Google Classroom
- 3-signal grading: keyword (40%) + semantic (40%) + rubric (20%)
- Confidence scoring — low confidence flagged for review
- Faculty override for any result
- Batch override for all flagged results

## Module 5: Plagiarism Detection
- TF-IDF cosine similarity between all submissions
- Configurable threshold (default 75%)
- Flags suspicious pairs with similarity percentage
- Full report saved for review

## Module 6: Analytics Dashboard
- Score distribution (donut chart)
- Assignment trends over time (bar chart)
- Per-session stats: average, highest, lowest, flagged count
- On-time vs late submission tracking

## Module 7: Question Bank
- Searchable store of all questions
- Filter by Bloom's level, difficulty, topic, language
- Import from any finalized paper
- Usage count tracking

## Module 8: Rubric Builder
- Visual criteria builder with name, keywords, weight
- Share rubrics across faculty
- Used in evaluation for more accurate grading

## Module 9: College Setup Wizard
- Step-by-step: College → Academic Year → Subject → Class
- Multi-tenant isolation (college_id on all tables)
- Google Classroom ID linking

## Module 10: Department & HOD Management
- Create departments, assign HOD
- HOD gets institution-wide analytics view
- Role-based access: faculty / hod / admin

## Module 11: Syllabus Version History
- Every re-upload creates a new version
- View change history with timestamps
- One-click restore to any previous version

## Module 12: Difficulty Calibration
- After evaluation, computes average student score
- Auto-classifies questions: Easy (≥75%) / Medium (45–75%) / Hard (<45%)
- Stored for future paper generation improvement

## Module 13: Notification System
- In-app notifications for: syllabus processed, evaluation done, paper finalized, review needed
- Unread count badge in sidebar
- Mark individual or all as read

## Module 14: Multi-language Support
- Subjects and questions support: English, Hindi, Marathi, Tamil, Telugu
- Language filter in question bank

## Module 15: LMS Integration
- Google Classroom: fully connected (OAuth)
- Moodle, Canvas, Microsoft Teams: architecture ready

---

# 8. User Flow

## 8.1 First-Time Setup (One-time, ~5 minutes)
```
1. Sign in with Google
2. College Setup Wizard:
   a. Create college (name, domain)
   b. Create academic year (e.g. 2024-25)
   c. Create subject (name, code, department, semester)
   d. Create class (name, link Google Classroom)
3. Upload syllabus PDF for the subject
4. Wait ~30 seconds for processing
```

## 8.2 Generate Question Paper (~2 minutes)
```
1. Go to Question Papers
2. Enter Subject ID
3. Select exam type (Midterm / Final / Quiz)
4. Choose Bloom's mode (preset or custom sliders)
5. Click Generate → Get Set A + Set B instantly
6. Edit any question if needed
7. Finalize → Download PDF
```

## 8.3 Evaluate Assignments (~3 minutes setup, auto-runs)
```
1. Go to Evaluation
2. Enter Class ID + Google Coursework ID
3. Paste answer key + keywords
4. Click Start Evaluation
5. System fetches all submissions from Google Classroom
6. Auto-grades each submission
7. Review flagged results, override if needed
8. Run plagiarism check
```

---

# 9. Database Design

## 9.1 Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `colleges` | Multi-tenant root | id, name, domain |
| `users` | Faculty/admin accounts | id, college_id, email, role, google_tokens |
| `academic_years` | Year labels | id, college_id, label, is_current |
| `subjects` | Courses | id, college_id, name, code, department, language |
| `classes` | Class sections | id, subject_id, google_classroom_id |
| `uploaded_files` | Deduped file storage | id, file_hash (SHA-256), processing_status |
| `knowledge_graphs` | Subject knowledge | id, subject_id, graph_data (JSONB), version |
| `kg_topics` | Flattened topics | id, subject_id, unit_name, topic_name, blooms_levels[] |
| `question_papers` | Paper metadata | id, subject_id, exam_type, total_marks, status |
| `questions` | Individual questions | id, paper_id, question_text, blooms_level, answer_key |
| `evaluation_sessions` | Grading batches | id, class_id, status, total_submissions |
| `evaluation_results` | Student grades | id, session_id, marks_awarded, confidence_score, needs_review |

## 9.2 Feature Tables (15 new features)

| Table | Purpose |
|-------|---------|
| `question_bank` | Reusable question store |
| `rubric_templates` | Evaluation rubrics |
| `syllabus_versions` | Version history |
| `notifications` | In-app alerts |
| `departments` | Department structure |
| `plagiarism_reports` | Similarity results |
| `question_performance` | Difficulty calibration data |
| `batch_overrides` | Bulk grade adjustments |
| `lms_integrations` | LMS connection config |
| `lms_course_mappings` | Course sync mappings |

## 9.3 Multi-Tenancy Strategy
Every table has a `college_id` column. The API Gateway injects `X-College-Id` from the JWT into every downstream request. All queries filter by `college_id` — complete data isolation between colleges at the application layer.

---

# 10. API Overview

The system exposes **40+ REST API endpoints** through the API Gateway at `http://localhost:8000`.

Interactive documentation available at: **http://localhost:8000/docs**

## Key Endpoints

| Category | Method | Endpoint | Description |
|----------|--------|----------|-------------|
| Auth | GET | `/auth/login` | Redirect to Google OAuth |
| Auth | GET | `/auth/callback` | Exchange code → JWT |
| Syllabus | POST | `/upload-syllabus` | Upload PDF |
| Knowledge | GET | `/subjects/{id}/knowledge` | Get knowledge graph |
| Papers | POST | `/generate-paper` | Generate question papers |
| Papers | GET | `/papers/{id}` | Get paper with questions |
| Papers | GET | `/papers/{id}/export/pdf` | Download PDF |
| Evaluation | POST | `/evaluate-assignment` | Start evaluation session |
| Evaluation | GET | `/evaluation/{id}/results` | Get graded results |
| Analytics | GET | `/analytics/{class_id}` | Class analytics |
| Management | POST | `/colleges` | Create college |
| Management | POST | `/colleges/{id}/subjects` | Create subject |
| Features | GET | `/question-bank` | Search question bank |
| Features | POST | `/plagiarism/check/{session_id}` | Run plagiarism check |
| Features | GET | `/notifications` | Get notifications |

---

# 11. Security

| Measure | Implementation |
|---------|---------------|
| Authentication | Google OAuth2 + JWT (8-hour expiry) |
| Authorization | Role-based: faculty / hod / admin |
| Multi-tenancy | college_id isolation on all queries |
| Secret scrubbing | Sentry filters passwords, tokens before logging |
| SQL injection | Parameterized queries via asyncpg |
| Input validation | Pydantic models on all API inputs |
| Non-root containers | All Docker containers run as `saap` user |
| Student data privacy | PDFs downloaded in-memory only, never persisted |

---

# 12. Testing

**112 test cases** across 5 test files:

| Test File | Coverage | Tests |
|-----------|---------|-------|
| `test_nlp_pipeline.py` | NLP extraction, Bloom's inference | 26 |
| `test_rule_engine.py` | Exam patterns, topic distribution | 34 |
| `test_evaluator.py` | Keyword scoring, semantic similarity | 38 |
| `test_auth.py` | JWT creation, validation, expiry | 14 |
| `test_api_integration.py` | Live service health, routing | 33 |

**Run tests:**
```bash
# Unit tests (no Docker needed)
pytest tests/test_nlp_pipeline.py tests/test_rule_engine.py tests/test_evaluator.py tests/test_auth.py -v

# Integration tests (Docker must be running)
pytest tests/test_api_integration.py -v
```

---

# 13. Deployment

## 13.1 Local Development (Current)
```bash
# Prerequisites: Docker Desktop
cp .env.example .env
# Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
docker-compose up --build
```

**Access:**
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs

## 13.2 Production (Recommended Stack)

| Component | Service | Cost |
|-----------|---------|------|
| Database | Supabase | Free (500MB) |
| Backend | Render.com | Free tier |
| Frontend | Vercel | Free |
| Redis | Upstash | Free tier |
| File Storage | Supabase Storage | Free |

**Migration to production:**
1. Create Supabase project → run `backend/db/init.sql`
2. Update `DATABASE_URL` in environment variables
3. Deploy backend services to Render
4. Deploy frontend to Vercel
5. No code changes required

---

# 14. Future Scope

| Feature | Priority | Description |
|---------|---------|-------------|
| Mobile App | High | React Native app for faculty on tablets |
| Moodle Integration | High | Connect to Moodle LMS for non-Google colleges |
| AI Question Refinement | Medium | Optional GPT-4 for grammar/clarity (already architected) |
| Student Portal | Medium | Students view their own grades and feedback |
| Offline Mode | Medium | PWA with service worker for poor connectivity |
| Regional Language NLP | High | spaCy models for Hindi, Marathi, Tamil |
| Automated Scheduling | Low | Auto-generate papers on exam schedule |
| Parent Portal | Low | Parents view student performance |
| Proctoring Integration | Low | Connect to online exam platforms |

---

# 15. Summary Statistics

| Metric | Value |
|--------|-------|
| Total lines of code | ~15,000 |
| Backend services | 9 microservices |
| Frontend pages | 18 pages |
| API endpoints | 40+ |
| Database tables | 22 |
| Test cases | 112 |
| Features | 15 modules |
| Docker containers | 11 |
| Languages supported | 5 (EN, HI, MR, TA, TE) |
| AI cost per paper | ~₹0 (optional: ~₹0.80) |

---

# Appendix A — Running the System

```
Step 1: Install Docker Desktop
Step 2: Clone the repository
Step 3: Copy .env.example to .env
Step 4: Add Google OAuth credentials to .env
Step 5: Run: docker-compose up --build
Step 6: Open http://localhost:3000
Step 7: Sign in with Google
Step 8: Complete College Setup Wizard (5 minutes)
Step 9: Upload a syllabus PDF
Step 10: Generate your first question paper
```

---

# Appendix B — Repository Structure

```
Smart_Academics/
├── backend/
│   ├── api-gateway/          # Auth + routing
│   ├── syllabus-service/     # PDF → knowledge graph
│   ├── knowledge-service/    # Graph storage
│   ├── question-service/     # Paper generation
│   ├── evaluation-service/   # Assignment grading
│   ├── analytics-service/    # Metrics
│   ├── management-service/   # College/subject/class
│   ├── export-service/       # PDF generation
│   ├── features-service/     # 8 feature modules
│   ├── workers/              # Celery async tasks
│   ├── shared/               # Monitoring utilities
│   └── db/                   # SQL schema + migrations
├── frontend/
│   └── src/
│       ├── app/              # 18 Next.js pages
│       ├── components/       # Sidebar, Topbar, Toast, etc.
│       └── lib/              # API client
├── tests/                    # 112 test cases
├── docs/                     # Documentation
├── docker-compose.yml        # Full stack in one command
└── .github/workflows/        # CI/CD pipeline
```

---

*Document prepared for: SAAP Presentation*
*Date: April 2026*
*Version: 1.0*
