-- ============================================================
-- SAAP Database Schema (Multi-Tenant)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- TENANT / COLLEGE LAYER
-- ============================================================

CREATE TABLE colleges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    domain VARCHAR(100) UNIQUE,           -- e.g. "mit.edu" for tenant isolation
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255),
    google_id VARCHAR(255) UNIQUE,
    role VARCHAR(50) DEFAULT 'faculty',   -- faculty | admin | hod
    google_tokens TEXT,                   -- Fernet-encrypted OAuth tokens (not JSONB — stored as encrypted string)
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_college ON users(college_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================================
-- ACADEMIC STRUCTURE
-- ============================================================

CREATE TABLE academic_years (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL,           -- e.g. "2024-25"
    is_current BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subjects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    academic_year_id UUID REFERENCES academic_years(id),
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    department VARCHAR(100),
    semester INTEGER,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_subjects_college ON subjects(college_id);

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,           -- e.g. "CS-A 2024"
    google_classroom_id VARCHAR(255),     -- linked classroom
    faculty_id UUID REFERENCES users(id),
    academic_year_id UUID REFERENCES academic_years(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONTENT MEMORY (Upload Once, Reuse Always)
-- ============================================================

CREATE TABLE uploaded_files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(id),
    file_name VARCHAR(500) NOT NULL,
    file_hash VARCHAR(64) UNIQUE NOT NULL, -- SHA-256 to prevent re-processing
    file_type VARCHAR(50),                 -- syllabus | reference | video_link
    storage_path VARCHAR(1000),
    file_size_bytes BIGINT,
    processing_status VARCHAR(50) DEFAULT 'pending', -- pending|processing|done|failed
    processing_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_files_subject ON uploaded_files(subject_id);
CREATE INDEX idx_files_hash ON uploaded_files(file_hash);

-- ============================================================
-- KNOWLEDGE GRAPHS (Core Memory Store)
-- ============================================================

CREATE TABLE knowledge_graphs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE UNIQUE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    graph_data JSONB NOT NULL DEFAULT '{}', -- full knowledge graph
    unit_count INTEGER DEFAULT 0,
    topic_count INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kg_subject ON knowledge_graphs(subject_id);
CREATE INDEX idx_kg_graph_gin ON knowledge_graphs USING GIN(graph_data);

-- Knowledge graph topics (flattened for fast querying)
CREATE TABLE kg_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_graph_id UUID REFERENCES knowledge_graphs(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    unit_name VARCHAR(255),
    unit_order INTEGER,
    topic_name VARCHAR(500) NOT NULL,
    topic_keywords TEXT[],
    blooms_levels TEXT[],                  -- applicable Bloom's levels
    difficulty_weights JSONB DEFAULT '{"easy":0.3,"medium":0.5,"hard":0.2}',
    question_count INTEGER DEFAULT 0,      -- how many times used
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_topics_kg ON kg_topics(knowledge_graph_id);
CREATE INDEX idx_topics_subject ON kg_topics(subject_id);

-- ============================================================
-- QUESTION PAPERS
-- ============================================================

CREATE TABLE question_papers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    title VARCHAR(500),
    exam_type VARCHAR(100),               -- midterm | final | quiz | assignment
    total_marks INTEGER,
    duration_minutes INTEGER,
    paper_set VARCHAR(10) DEFAULT 'A',
    status VARCHAR(50) DEFAULT 'draft',   -- draft | finalized | published
    generation_config JSONB,              -- units, bloom levels, marks dist
    created_at TIMESTAMPTZ DEFAULT NOW(),
    finalized_at TIMESTAMPTZ
);

CREATE INDEX idx_papers_subject ON question_papers(subject_id);
CREATE INDEX idx_papers_college ON question_papers(college_id);

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID REFERENCES question_papers(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(50),            -- mcq | short | long | case_study
    marks INTEGER NOT NULL,
    blooms_level VARCHAR(50),             -- remember|understand|apply|analyze|evaluate|create
    topic VARCHAR(500),
    unit_name VARCHAR(255),
    answer_key TEXT,
    keywords TEXT[],
    order_index INTEGER,
    is_edited BOOLEAN DEFAULT FALSE,      -- faculty edited flag
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_questions_paper ON questions(paper_id);

-- ============================================================
-- ASSIGNMENT EVALUATION
-- ============================================================

CREATE TABLE evaluation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    google_coursework_id VARCHAR(255),
    assignment_title VARCHAR(500),
    total_marks INTEGER,
    rubric JSONB,                          -- evaluation rubric
    status VARCHAR(50) DEFAULT 'pending', -- pending|processing|done
    processed_count INTEGER DEFAULT 0,
    total_submissions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE evaluation_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES evaluation_sessions(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    student_google_id VARCHAR(255) NOT NULL,
    student_name VARCHAR(255),
    student_email VARCHAR(255),
    marks_awarded NUMERIC(5,2),
    total_marks INTEGER,
    percentage NUMERIC(5,2),
    feedback TEXT,
    keyword_score NUMERIC(5,2),
    semantic_score NUMERIC(5,2),
    rubric_scores JSONB,
    confidence_score NUMERIC(3,2),        -- 0-1, low = flag for review
    needs_review BOOLEAN DEFAULT FALSE,
    faculty_override BOOLEAN DEFAULT FALSE,
    override_marks NUMERIC(5,2),
    override_feedback TEXT,
    submission_time TIMESTAMPTZ,
    evaluated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_eval_session ON evaluation_results(session_id);
CREATE INDEX idx_eval_college ON evaluation_results(college_id);

-- ============================================================
-- ANALYTICS CACHE
-- ============================================================

CREATE TABLE analytics_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    snapshot_type VARCHAR(100),           -- submission_stats | performance | coverage
    data JSONB NOT NULL,
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_class ON analytics_snapshots(class_id);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_college ON audit_logs(college_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
