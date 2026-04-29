-- ============================================================
-- SAAP Migration 002 — New Features + RBAC
-- ============================================================

-- ── RBAC: Role Permissions ────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,
    permission VARCHAR(100) NOT NULL,
    UNIQUE(role, permission)
);

-- Seed permissions
INSERT INTO role_permissions (role, permission) VALUES
  ('faculty',      'upload_syllabus'),
  ('faculty',      'generate_papers'),
  ('faculty',      'evaluate_assignments'),
  ('faculty',      'view_own_analytics'),
  ('faculty',      'use_question_bank'),
  ('faculty',      'build_rubrics'),
  ('hod',          'upload_syllabus'),
  ('hod',          'generate_papers'),
  ('hod',          'evaluate_assignments'),
  ('hod',          'view_own_analytics'),
  ('hod',          'view_class_analytics'),
  ('hod',          'view_dept_analytics'),
  ('hod',          'manage_faculty_roles'),
  ('hod',          'manage_co_faculty'),
  ('hod',          'use_question_bank'),
  ('hod',          'build_rubrics'),
  ('hod',          'generate_accreditation'),
  ('admin',        'upload_syllabus'),
  ('admin',        'generate_papers'),
  ('admin',        'evaluate_assignments'),
  ('admin',        'view_own_analytics'),
  ('admin',        'view_class_analytics'),
  ('admin',        'view_dept_analytics'),
  ('admin',        'manage_faculty_roles'),
  ('admin',        'manage_co_faculty'),
  ('admin',        'use_question_bank'),
  ('admin',        'build_rubrics'),
  ('admin',        'generate_accreditation'),
  ('admin',        'manage_colleges'),
  ('admin',        'manage_all_users')
ON CONFLICT DO NOTHING;

-- ── Student Portal ────────────────────────────────────────────
ALTER TABLE student_portals ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE student_portals ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS student_class_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_google_id VARCHAR(255) NOT NULL,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id),
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_google_id, class_id)
);
CREATE INDEX IF NOT EXISTS idx_enrollment_student ON student_class_enrollments(student_google_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_class ON student_class_enrollments(class_id);

-- ── Email Notifications ───────────────────────────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS email_template VARCHAR(100);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'normal';

CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(500) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Answer Sheet Scanner ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS scanned_sheets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES evaluation_sessions(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id),
    student_id VARCHAR(255),
    student_name VARCHAR(255),
    image_path VARCHAR(1000),
    ocr_text TEXT,
    processing_status VARCHAR(50) DEFAULT 'pending',
    processing_error TEXT,
    marks_awarded NUMERIC(5,2),
    feedback TEXT,
    processed_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_scanned_session ON scanned_sheets(session_id);

-- ── Paper Templates ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS paper_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    exam_type VARCHAR(50),
    total_marks INTEGER,
    duration_minutes INTEGER,
    blooms_distribution JSONB DEFAULT '{}',
    sections JSONB DEFAULT '[]',
    instructions TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_templates_college ON paper_templates(college_id);

-- ── Bulk Student Import ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS bulk_imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id),
    class_id UUID REFERENCES classes(id),
    imported_by UUID REFERENCES users(id),
    file_name VARCHAR(500),
    total_rows INTEGER DEFAULT 0,
    imported_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status VARCHAR(50) DEFAULT 'pending',
    errors JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS class_students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id),
    student_name VARCHAR(255) NOT NULL,
    student_email VARCHAR(255),
    roll_number VARCHAR(50),
    phone VARCHAR(20),
    parent_phone VARCHAR(20),
    parent_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    added_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_class_students ON class_students(class_id);
CREATE INDEX IF NOT EXISTS idx_class_students_email ON class_students(student_email);

-- ── Co-Faculty Collaboration ──────────────────────────────────
CREATE TABLE IF NOT EXISTS class_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    faculty_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'reviewer',  -- reviewer | co_evaluator | co_creator
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(class_id, faculty_id)
);
CREATE INDEX IF NOT EXISTS idx_collaborators_class ON class_collaborators(class_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_faculty ON class_collaborators(faculty_id);

-- Paper review workflow
CREATE TABLE IF NOT EXISTS paper_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paper_id UUID REFERENCES question_papers(id) ON DELETE CASCADE,
    reviewer_id UUID REFERENCES users(id),
    status VARCHAR(50) DEFAULT 'pending',  -- pending | approved | rejected | changes_requested
    comments TEXT,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Attendance ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id),
    session_date DATE NOT NULL,
    session_type VARCHAR(50) DEFAULT 'lecture',
    topic VARCHAR(500),
    marked_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance_sessions(class_id);

CREATE TABLE IF NOT EXISTS attendance_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attendance_session_id UUID REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id VARCHAR(255) NOT NULL,
    student_name VARCHAR(255),
    status VARCHAR(20) DEFAULT 'present',  -- present | absent | late | excused
    remarks TEXT,
    marked_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_attendance_records ON attendance_records(attendance_session_id);

-- ── Certificates ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id),
    class_id UUID REFERENCES classes(id),
    student_google_id VARCHAR(255),
    student_name VARCHAR(255),
    student_email VARCHAR(255),
    certificate_type VARCHAR(100),  -- participation | merit | completion | distinction
    issued_date DATE DEFAULT CURRENT_DATE,
    pdf_url TEXT,
    metadata JSONB DEFAULT '{}',
    issued_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_google_id);
CREATE INDEX IF NOT EXISTS idx_certificates_class ON certificates(class_id);

-- ── Parent Contacts & SMS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS parent_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID REFERENCES classes(id),
    college_id UUID REFERENCES colleges(id),
    student_name VARCHAR(255),
    student_email VARCHAR(255),
    parent_name VARCHAR(255),
    parent_phone VARCHAR(20) NOT NULL,
    parent_email VARCHAR(255),
    relationship VARCHAR(50) DEFAULT 'parent',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_parent_class ON parent_contacts(class_id);

CREATE TABLE IF NOT EXISTS sms_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id),
    recipient_phone VARCHAR(20),
    message TEXT,
    status VARCHAR(50) DEFAULT 'pending',
    provider_response JSONB,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Accreditation Reports ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS accreditation_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    generated_by UUID REFERENCES users(id),
    report_type VARCHAR(100),  -- NBA | NAAC | NIRF | custom
    academic_year_id UUID REFERENCES academic_years(id),
    data JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'draft',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    finalized_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_accreditation_college ON accreditation_reports(college_id);

-- ── AI Chatbot ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chatbot_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255),
    college_id UUID REFERENCES colleges(id),
    subject_id UUID REFERENCES subjects(id),
    messages JSONB DEFAULT '[]',
    context_type VARCHAR(50) DEFAULT 'general',  -- general | syllabus | paper | evaluation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_chatbot_user ON chatbot_conversations(user_id);

-- ── Comparative Analytics ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS comparative_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id),
    snapshot_type VARCHAR(100),  -- class_vs_class | semester_vs_semester | subject_trend
    class_ids UUID[],
    data JSONB NOT NULL DEFAULT '{}',
    computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Difficulty Prediction ─────────────────────────────────────
ALTER TABLE question_performance ADD COLUMN IF NOT EXISTS predicted_difficulty VARCHAR(20);
ALTER TABLE question_performance ADD COLUMN IF NOT EXISTS prediction_confidence NUMERIC(3,2);
ALTER TABLE question_performance ADD COLUMN IF NOT EXISTS historical_avg NUMERIC(5,2);
