-- ============================================================
-- SAAP Migration 003 — Full RBAC Schema
-- Adds: roles table, permissions table, user_roles junction,
--       student role, and re-seeds role_permissions cleanly.
-- ============================================================

-- ── Roles table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(50) UNIQUE NOT NULL,   -- admin | hod | faculty | student
    description TEXT,
    is_system   BOOLEAN DEFAULT FALSE,         -- system roles cannot be deleted
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Seed system roles
INSERT INTO roles (name, description, is_system) VALUES
  ('admin',   'Platform administrator — full access',                    TRUE),
  ('hod',     'Head of Department — department-wide access',             TRUE),
  ('faculty', 'Faculty member — own subjects and classes',               TRUE),
  ('student', 'Student — read-only access to own results and materials', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ── Permissions table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category    VARCHAR(50),   -- syllabus | papers | evaluation | analytics | management | admin
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO permissions (name, description, category) VALUES
  -- Syllabus
  ('upload_syllabus',          'Upload and process syllabus PDFs',              'syllabus'),
  -- Papers
  ('generate_papers',          'Generate question papers',                      'papers'),
  -- Evaluation
  ('evaluate_assignments',     'Start and manage evaluation sessions',          'evaluation'),
  -- Analytics
  ('view_own_analytics',       'View analytics for own classes',                'analytics'),
  ('view_class_analytics',     'View analytics for any class in college',       'analytics'),
  ('view_dept_analytics',      'View department-wide analytics',                'analytics'),
  -- Features
  ('use_question_bank',        'Search and add to question bank',               'features'),
  ('build_rubrics',            'Create and manage evaluation rubrics',          'features'),
  -- Management
  ('manage_faculty_roles',     'Assign and change faculty roles',               'management'),
  ('manage_co_faculty',        'Add co-faculty collaborators to classes',       'management'),
  ('manage_colleges',          'Create and manage college records',             'admin'),
  ('manage_all_users',         'Manage all users across the platform',          'admin'),
  -- Accreditation
  ('generate_accreditation',   'Generate NBA/NAAC accreditation reports',       'management'),
  -- Student
  ('view_own_results',         'View own evaluation results',                   'student'),
  ('view_own_attendance',      'View own attendance records',                   'student')
ON CONFLICT (name) DO NOTHING;

-- ── role_permissions (clean re-seed) ─────────────────────────
-- Use DELETE instead of TRUNCATE to avoid FK constraint issues
DELETE FROM role_permissions;

INSERT INTO role_permissions (role, permission) VALUES
  -- faculty
  ('faculty', 'upload_syllabus'),
  ('faculty', 'generate_papers'),
  ('faculty', 'evaluate_assignments'),
  ('faculty', 'view_own_analytics'),
  ('faculty', 'use_question_bank'),
  ('faculty', 'build_rubrics'),
  -- hod (inherits faculty + dept-level)
  ('hod', 'upload_syllabus'),
  ('hod', 'generate_papers'),
  ('hod', 'evaluate_assignments'),
  ('hod', 'view_own_analytics'),
  ('hod', 'view_class_analytics'),
  ('hod', 'view_dept_analytics'),
  ('hod', 'manage_faculty_roles'),
  ('hod', 'manage_co_faculty'),
  ('hod', 'use_question_bank'),
  ('hod', 'build_rubrics'),
  ('hod', 'generate_accreditation'),
  -- admin (all permissions)
  ('admin', 'upload_syllabus'),
  ('admin', 'generate_papers'),
  ('admin', 'evaluate_assignments'),
  ('admin', 'view_own_analytics'),
  ('admin', 'view_class_analytics'),
  ('admin', 'view_dept_analytics'),
  ('admin', 'manage_faculty_roles'),
  ('admin', 'manage_co_faculty'),
  ('admin', 'use_question_bank'),
  ('admin', 'build_rubrics'),
  ('admin', 'generate_accreditation'),
  ('admin', 'manage_colleges'),
  ('admin', 'manage_all_users'),
  -- student (read-only own data)
  ('student', 'view_own_results'),
  ('student', 'view_own_attendance')
ON CONFLICT DO NOTHING;

-- ── Add role column to users if missing ───────────────────────
-- (already exists in init.sql, this is a safety guard)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='users' AND column_name='role'
    ) THEN
        ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'faculty';
    END IF;
END $$;

-- Add student role support to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_student BOOLEAN DEFAULT FALSE;

-- ── Index for fast permission lookups ─────────────────────────
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm ON role_permissions(permission);
