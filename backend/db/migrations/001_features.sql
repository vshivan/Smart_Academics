-- ============================================================
-- SAAP Migration 001 — 15 New Features
-- ============================================================

-- ── Feature 1: College & Faculty Management ──────────────────
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE colleges ADD COLUMN IF NOT EXISTS established_year INTEGER;

ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- ── Feature 2: Subject & Class Setup ─────────────────────────
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 3;
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

ALTER TABLE classes ADD COLUMN IF NOT EXISTS student_count INTEGER DEFAULT 0;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- ── Feature 3: PDF Export ─────────────────────────────────────
ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS pdf_url TEXT;
ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS instructions TEXT;
ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS college_header TEXT;
ALTER TABLE question_papers ADD COLUMN IF NOT EXISTS exported_at TIMESTAMPTZ;

-- ── Feature 4: Student Results ────────────────────────────────
CREATE TABLE IF NOT EXISTS student_portals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_google_id VARCHAR(255) NOT NULL,
    student_email VARCHAR(255),
    student_name VARCHAR(255),
    college_id UUID REFERENCES colleges(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_student_portal ON student_portals(student_google_id);

-- ── Feature 5: Batch Override & Re-evaluation ─────────────────
ALTER TABLE evaluation_sessions ADD COLUMN IF NOT EXISTS answer_key TEXT;
ALTER TABLE evaluation_sessions ADD COLUMN IF NOT EXISTS keywords TEXT[];
ALTER TABLE evaluation_sessions ADD COLUMN IF NOT EXISTS rerun_count INTEGER DEFAULT 0;
ALTER TABLE evaluation_sessions ADD COLUMN IF NOT EXISTS last_rerun_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS batch_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES evaluation_sessions(id) ON DELETE CASCADE,
    applied_by UUID REFERENCES users(id),
    adjustment_type VARCHAR(50),  -- add_marks | set_marks | add_feedback
    adjustment_value TEXT,
    affected_count INTEGER,
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Feature 6: Question Bank ──────────────────────────────────
CREATE TABLE IF NOT EXISTS question_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    question_type VARCHAR(50),
    marks INTEGER,
    blooms_level VARCHAR(50),
    topic VARCHAR(500),
    unit_name VARCHAR(255),
    answer_key TEXT,
    keywords TEXT[],
    difficulty VARCHAR(20) DEFAULT 'medium',
    usage_count INTEGER DEFAULT 0,
    source_paper_id UUID REFERENCES question_papers(id),
    is_verified BOOLEAN DEFAULT FALSE,
    tags TEXT[],
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qbank_subject ON question_bank(subject_id);
CREATE INDEX IF NOT EXISTS idx_qbank_blooms ON question_bank(blooms_level);
CREATE INDEX IF NOT EXISTS idx_qbank_topic ON question_bank(topic);

-- ── Feature 7: Syllabus Version History ──────────────────────
CREATE TABLE IF NOT EXISTS syllabus_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id),
    version_number INTEGER NOT NULL,
    graph_data JSONB NOT NULL,
    file_id UUID REFERENCES uploaded_files(id),
    change_summary TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_syllabus_versions ON syllabus_versions(subject_id, version_number);

-- ── Feature 8: Rubric Builder ─────────────────────────────────
CREATE TABLE IF NOT EXISTS rubric_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    criteria JSONB NOT NULL DEFAULT '[]',
    total_weight NUMERIC(5,2) DEFAULT 1.0,
    is_shared BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rubric_college ON rubric_templates(college_id);

-- ── Feature 9: Notifications ──────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id),
    type VARCHAR(100) NOT NULL,  -- syllabus_done|eval_done|paper_finalized|review_needed
    title VARCHAR(255) NOT NULL,
    message TEXT,
    resource_type VARCHAR(100),
    resource_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read);

-- ── Feature 10: Role-Based Access (HOD) ──────────────────────
CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50),
    hod_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_dept_college ON departments(college_id);

ALTER TABLE subjects ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES departments(id);

-- ── Feature 11: Question Difficulty Calibration ───────────────
CREATE TABLE IF NOT EXISTS question_performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_bank_id UUID REFERENCES question_bank(id) ON DELETE CASCADE,
    session_id UUID REFERENCES evaluation_sessions(id),
    avg_score NUMERIC(5,2),
    attempt_count INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    calibrated_difficulty VARCHAR(20),
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_qperf_bank ON question_performance(question_bank_id);

-- ── Feature 12: Plagiarism Detection ─────────────────────────
ALTER TABLE evaluation_results ADD COLUMN IF NOT EXISTS plagiarism_score NUMERIC(5,2);
ALTER TABLE evaluation_results ADD COLUMN IF NOT EXISTS similar_to TEXT[];  -- list of student_ids

CREATE TABLE IF NOT EXISTS plagiarism_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES evaluation_sessions(id) ON DELETE CASCADE,
    student_a_id VARCHAR(255),
    student_b_id VARCHAR(255),
    similarity_score NUMERIC(5,2),
    flagged_sections JSONB,
    reviewed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_plagiarism_session ON plagiarism_reports(session_id);

-- ── Feature 13: PWA / Offline ─────────────────────────────────
-- No DB changes needed — handled at frontend level

-- ── Feature 14: Multi-language ───────────────────────────────
ALTER TABLE subjects ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en';
ALTER TABLE question_bank ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en';
ALTER TABLE knowledge_graphs ADD COLUMN IF NOT EXISTS language VARCHAR(20) DEFAULT 'en';

-- ── Feature 15: LMS Integration ──────────────────────────────
CREATE TABLE IF NOT EXISTS lms_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    lms_type VARCHAR(50) NOT NULL,  -- moodle | canvas | teams | google
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_sync TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lms_college ON lms_integrations(college_id);

CREATE TABLE IF NOT EXISTS lms_course_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID REFERENCES lms_integrations(id) ON DELETE CASCADE,
    saap_class_id UUID REFERENCES classes(id),
    lms_course_id VARCHAR(255),
    lms_course_name VARCHAR(500),
    sync_enabled BOOLEAN DEFAULT TRUE,
    last_synced TIMESTAMPTZ
);
