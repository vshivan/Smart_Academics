"""
Shared pytest fixtures and configuration.
"""
import os
import sys
import pytest

# ── Backend module paths ───────────────────────────────────────
# Each service exposes its modules by name; add all service dirs to sys.path.
_BACKEND = os.path.join(os.path.dirname(__file__), "..", "backend")
sys.path.insert(0, os.path.join(_BACKEND, "api-gateway"))       # auth, proxy, main
sys.path.insert(0, os.path.join(_BACKEND, "shared"))            # response, cache, logging_config
sys.path.insert(0, os.path.join(_BACKEND, "question-service"))  # rule_engine, generator
sys.path.insert(0, os.path.join(_BACKEND, "evaluation-service")) # evaluator, classroom_client
sys.path.insert(0, os.path.join(_BACKEND, "syllabus-service"))  # nlp_pipeline, pdf_extractor, processor

# Set test environment variables before any imports
os.environ.setdefault("SECRET_KEY",    "test-secret-key-for-unit-tests-only-32chars")
os.environ.setdefault("DATABASE_URL",  "postgresql://saap:saap_pass@localhost:5432/saap_test")
os.environ.setdefault("REDIS_URL",     "redis://localhost:6379/15")
os.environ.setdefault("ENVIRONMENT",   "test")
os.environ.setdefault("LOG_LEVEL",     "WARNING")
os.environ.setdefault("SMTP_USER",     "")
os.environ.setdefault("SMTP_PASS",     "")
os.environ.setdefault("GOOGLE_CLIENT_ID",     "test-client-id")
os.environ.setdefault("GOOGLE_CLIENT_SECRET", "test-client-secret")


# ── Fixtures ──────────────────────────────────────────────────

@pytest.fixture
def faculty_token():
    """JWT token for a faculty user with standard permissions."""
    from auth import create_access_token
    return create_access_token({
        "user_id":     "faculty-user-id",
        "email":       "faculty@college.edu",
        "role":        "faculty",
        "college_id":  "test-college-id",
        "permissions": [
            "upload_syllabus", "generate_papers", "evaluate_assignments",
            "view_own_analytics", "use_question_bank", "build_rubrics",
        ],
    })


@pytest.fixture
def hod_token():
    """JWT token for a HOD user."""
    from auth import create_access_token
    return create_access_token({
        "user_id":     "hod-user-id",
        "email":       "hod@college.edu",
        "role":        "hod",
        "college_id":  "test-college-id",
        "permissions": [
            "upload_syllabus", "generate_papers", "evaluate_assignments",
            "view_own_analytics", "view_class_analytics", "view_dept_analytics",
            "manage_faculty_roles", "manage_co_faculty", "use_question_bank",
            "build_rubrics", "generate_accreditation",
        ],
    })


@pytest.fixture
def admin_token():
    """JWT token for an admin user with all permissions."""
    from auth import create_access_token
    return create_access_token({
        "user_id":     "admin-user-id",
        "email":       "admin@college.edu",
        "role":        "admin",
        "college_id":  "test-college-id",
        "permissions": [
            "upload_syllabus", "generate_papers", "evaluate_assignments",
            "view_own_analytics", "view_class_analytics", "view_dept_analytics",
            "manage_faculty_roles", "manage_co_faculty", "use_question_bank",
            "build_rubrics", "generate_accreditation", "manage_colleges",
            "manage_all_users",
        ],
    })


@pytest.fixture
def student_token():
    """JWT token for a student user."""
    from auth import create_access_token
    return create_access_token({
        "user_id":     "student-user-id",
        "email":       "student@college.edu",
        "role":        "student",
        "college_id":  "test-college-id",
        "permissions": ["view_own_results", "view_own_attendance"],
    })


@pytest.fixture
def auth_headers(faculty_token):
    """Default auth headers using faculty token."""
    return {"Authorization": f"Bearer {faculty_token}"}


@pytest.fixture
def admin_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture
def hod_headers(hod_token):
    return {"Authorization": f"Bearer {hod_token}"}


# ── Domain fixtures for evaluator tests ───────────────────────

@pytest.fixture
def answer_key():
    return (
        "Normalization is the process of organizing a relational database to reduce data "
        "redundancy and improve data integrity. The normal forms (1NF, 2NF, 3NF, BCNF) "
        "define rules for eliminating redundancy. Functional dependencies are used to "
        "identify and remove redundancy by decomposing relations."
    )


@pytest.fixture
def keywords():
    return ["normalization", "1NF", "2NF", "3NF", "redundancy", "integrity", "dependency"]


@pytest.fixture
def perfect_student_answer():
    return (
        "Normalization is the process of organizing a relational database to minimize "
        "redundancy and ensure data integrity. It involves applying normal forms: 1NF "
        "ensures atomic values, 2NF removes partial dependencies, and 3NF removes "
        "transitive dependencies. Functional dependencies guide decomposition of relations "
        "to achieve higher normal forms. This process improves consistency and efficiency."
    )


@pytest.fixture
def poor_student_answer():
    return "I think database is good. It stores data somewhere and is useful."


@pytest.fixture
def sample_rubric():
    return {
        "criteria": [
            {
                "name": "Defines Normalization",
                "keywords": ["normalization", "redundancy", "organize"],
                "weight": 3,
            },
            {
                "name": "Explains Normal Forms",
                "keywords": ["1NF", "2NF", "3NF", "atomic"],
                "weight": 4,
            },
            {
                "name": "Discusses Integrity",
                "keywords": ["integrity", "consistency", "dependency"],
                "weight": 3,
            },
        ]
    }


# ── Domain fixtures for NLP pipeline tests ─────────────────────

@pytest.fixture(scope="module")
def sample_syllabus_text():
    return """
Unit 1: Introduction to Databases
Students should define and list the key components of database systems.
Topics include: data models, schemas, instances, and database users.
Students should recall the definition of DBMS and its advantages.

Unit 2: Relational Model and SQL
Students should explain and apply SQL queries to solve problems.
Topics: normalization, functional dependencies, 1NF, 2NF, 3NF.
Students should analyze and differentiate between normal forms.

Unit 3: Transactions and Concurrency
Students should evaluate and justify transaction management strategies.
Topics: ACID properties, locking protocols, deadlock detection.
Students should design concurrency control mechanisms.
    """
