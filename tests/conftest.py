"""Shared fixtures for all tests."""
import os
import sys
import pytest

# Add service paths so imports work without installing packages
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/syllabus-service"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/question-service"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/evaluation-service"))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/api-gateway"))

# ── Sample data fixtures ──────────────────────────────────────

@pytest.fixture
def sample_syllabus_text():
    return """
Unit 1: Introduction to Databases
A database is an organized collection of structured information or data.
Topics include: define data models, list types of databases, identify DBMS components.
Students should be able to explain the concept of normalization.

Unit 2: Normalization
Normalization is the process of organizing data to reduce redundancy.
1NF requires atomic values. 2NF removes partial dependencies. 3NF removes transitive dependencies.
Students should analyze, differentiate, and evaluate normal forms.
Apply normalization to solve real-world database design problems.

Unit 3: SQL and Transactions
SQL is used to manage relational databases. Transactions ensure ACID properties.
Design queries using SELECT, INSERT, UPDATE, DELETE.
Evaluate transaction isolation levels and their impact on concurrency.
"""

@pytest.fixture
def sample_knowledge_graph():
    return {
        "subject_id": "sub_test_001",
        "units": [
            {
                "name": "Unit 1: Introduction to Databases",
                "order": 1,
                "topics": [
                    {
                        "topic_name": "data models",
                        "topic_keywords": ["relational", "hierarchical", "network"],
                        "blooms_levels": ["remember", "understand"],
                    },
                    {
                        "topic_name": "normalization",
                        "topic_keywords": ["1NF", "2NF", "3NF", "redundancy"],
                        "blooms_levels": ["understand", "apply", "analyze"],
                    },
                ],
            },
            {
                "name": "Unit 2: SQL",
                "order": 2,
                "topics": [
                    {
                        "topic_name": "SQL queries",
                        "topic_keywords": ["SELECT", "INSERT", "UPDATE", "DELETE"],
                        "blooms_levels": ["apply", "analyze"],
                    },
                ],
            },
        ],
        "version": 1,
    }

@pytest.fixture
def sample_topics():
    return [
        {"topic_name": "normalization", "unit_name": "Unit 1", "topic_keywords": ["1NF", "2NF", "3NF"]},
        {"topic_name": "SQL queries",   "unit_name": "Unit 2", "topic_keywords": ["SELECT", "JOIN"]},
        {"topic_name": "transactions",  "unit_name": "Unit 2", "topic_keywords": ["ACID", "commit"]},
        {"topic_name": "data models",   "unit_name": "Unit 1", "topic_keywords": ["relational", "ER"]},
        {"topic_name": "indexing",      "unit_name": "Unit 3", "topic_keywords": ["B-tree", "hash"]},
    ]

@pytest.fixture
def perfect_student_answer():
    return (
        "Normalization is the process of organizing a relational database to reduce redundancy "
        "and improve data integrity. The first normal form (1NF) requires atomic values. "
        "The second normal form (2NF) removes partial dependencies on the primary key. "
        "The third normal form (3NF) eliminates transitive dependencies. "
        "Normalization improves database design by minimizing redundancy."
    )

@pytest.fixture
def poor_student_answer():
    return "Normalization is something related to databases. It makes things better."

@pytest.fixture
def empty_student_answer():
    return ""

@pytest.fixture
def answer_key():
    return (
        "Normalization is the process of organizing data in a database to reduce redundancy. "
        "1NF: atomic values, no repeating groups. "
        "2NF: no partial dependencies on composite primary key. "
        "3NF: no transitive dependencies. "
        "Benefits: reduced redundancy, improved data integrity, easier maintenance."
    )

@pytest.fixture
def keywords():
    return ["normalization", "1NF", "2NF", "3NF", "redundancy", "atomic", "dependency"]

@pytest.fixture
def sample_rubric():
    return {
        "criteria": [
            {"name": "Definition", "keywords": ["normalization", "redundancy", "organize"], "weight": 2},
            {"name": "Normal Forms", "keywords": ["1NF", "2NF", "3NF", "atomic"], "weight": 3},
            {"name": "Benefits",    "keywords": ["integrity", "maintenance", "efficiency"], "weight": 1},
        ]
    }

@pytest.fixture
def valid_jwt_token():
    """Generate a real JWT for testing auth."""
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../backend/api-gateway"))
    from auth import create_access_token
    return create_access_token({
        "user_id": "test_user_001",
        "email": "faculty@test.edu",
        "college_id": "college_001",
        "role": "faculty",
    })
