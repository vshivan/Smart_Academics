"""
Seed test data into the running PostgreSQL container.
Creates the college, user, and subject records needed for integration tests.
Run once before integration tests.
"""
import subprocess
import sys

COLLEGE_ID  = "22222222-2222-2222-2222-222222222222"
USER_ID     = "11111111-1111-1111-1111-111111111111"
SUBJECT_ID  = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
YEAR_ID     = "33333333-3333-3333-3333-333333333333"

SQL = f"""
-- Seed college
INSERT INTO colleges (id, name, domain, is_active)
VALUES ('{COLLEGE_ID}', 'Test College', 'test.edu', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed user
INSERT INTO users (id, college_id, email, name, google_id, role, is_active)
VALUES ('{USER_ID}', '{COLLEGE_ID}', 'faculty@testcollege.edu', 'Test Faculty',
        'google_test_001', 'faculty', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed academic year
INSERT INTO academic_years (id, college_id, label, is_current)
VALUES ('{YEAR_ID}', '{COLLEGE_ID}', '2024-25', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed subject
INSERT INTO subjects (id, college_id, academic_year_id, name, code, department, semester, created_by)
VALUES ('{SUBJECT_ID}', '{COLLEGE_ID}', '{YEAR_ID}',
        'Database Management Systems', 'CS301', 'Computer Science', 5, '{USER_ID}')
ON CONFLICT (id) DO NOTHING;
"""

def seed():
    result = subprocess.run(
        ["docker", "exec", "-i", "minim-postgres-1",
         "psql", "-U", "saap", "-d", "saap_db", "-c", SQL],
        capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"SEED ERROR: {result.stderr}")
        sys.exit(1)
    print("✅ Test data seeded successfully")
    print(result.stdout)

if __name__ == "__main__":
    seed()
