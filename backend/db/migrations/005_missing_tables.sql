-- ============================================================
-- SAAP Migration 005 — Missing tables for new features
-- ============================================================

-- Exam Schedule
CREATE TABLE IF NOT EXISTS exam_schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    subject_name VARCHAR(255) NOT NULL,
    subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
    exam_type VARCHAR(50) DEFAULT 'midterm',
    exam_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    venue VARCHAR(255),
    invigilator VARCHAR(255),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schedule_college ON exam_schedule(college_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON exam_schedule(exam_date);

-- CO-PO Mappings
CREATE TABLE IF NOT EXISTS copo_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id UUID UNIQUE REFERENCES subjects(id) ON DELETE CASCADE,
    college_id UUID REFERENCES colleges(id) ON DELETE CASCADE,
    mapping_data JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_copo_subject ON copo_mappings(subject_id);
