"""Tests for Rule Engine — exam patterns, Bloom's templates, topic distribution."""
import pytest
from rule_engine import RuleEngine, EXAM_PATTERNS, BLOOMS_TEMPLATES


@pytest.fixture
def engine():
    return RuleEngine()


@pytest.fixture
def sample_topics():
    return [
        {"topic_name": "normalization", "unit_name": "Unit 1", "topic_keywords": ["1NF", "2NF"]},
        {"topic_name": "SQL queries",   "unit_name": "Unit 2", "topic_keywords": ["SELECT"]},
        {"topic_name": "transactions",  "unit_name": "Unit 2", "topic_keywords": ["ACID"]},
        {"topic_name": "indexing",      "unit_name": "Unit 3", "topic_keywords": ["B-tree"]},
    ]


# ── Exam Pattern Retrieval ────────────────────────────────────

class TestGetPattern:
    def test_midterm_pattern(self, engine):
        p = engine.get_pattern("midterm")
        assert p.exam_type == "midterm"
        assert p.total_marks == 50
        assert len(p.sections) > 0

    def test_final_pattern(self, engine):
        p = engine.get_pattern("final")
        assert p.exam_type == "final"
        assert p.total_marks == 100

    def test_quiz_pattern(self, engine):
        p = engine.get_pattern("quiz")
        assert p.exam_type == "quiz"
        assert p.total_marks == 20

    def test_unknown_type_defaults_to_midterm(self, engine):
        p = engine.get_pattern("unknown_exam_type")
        assert p.exam_type == "midterm"

    def test_custom_marks_triggers_scaling(self, engine):
        p = engine.get_pattern("midterm", total_marks=100)
        assert p.total_marks == 100

    def test_same_marks_no_scaling(self, engine):
        p = engine.get_pattern("midterm", total_marks=50)
        assert p.total_marks == 50
        assert p.sections == EXAM_PATTERNS["midterm"].sections

    def test_blooms_distribution_sums_to_one(self, engine):
        for exam_type in ["midterm", "final", "quiz"]:
            p = engine.get_pattern(exam_type)
            total = sum(p.blooms_distribution.values())
            assert abs(total - 1.0) < 0.01, f"{exam_type} Bloom's dist doesn't sum to 1"


# ── Pattern Scaling ───────────────────────────────────────────

class TestScalePattern:
    def test_scale_up(self, engine):
        p = engine.get_pattern("midterm", total_marks=100)
        assert p.total_marks == 100
        for section in p.sections:
            assert section["count"] >= 1

    def test_scale_down(self, engine):
        p = engine.get_pattern("final", total_marks=50)
        assert p.total_marks == 50

    def test_sections_count_minimum_one(self, engine):
        p = engine.get_pattern("midterm", total_marks=5)
        for section in p.sections:
            assert section["count"] >= 1


# ── Question Templates ────────────────────────────────────────

class TestGetQuestionTemplate:
    @pytest.mark.parametrize("level", ["remember", "understand", "apply", "analyze", "evaluate", "create"])
    def test_all_blooms_levels_produce_output(self, engine, level):
        result = engine.get_question_template(level, "normalization")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_topic_substituted_in_template(self, engine):
        result = engine.get_question_template("remember", "normalization")
        assert "normalization" in result

    def test_alt_topic_used_in_compare_templates(self, engine):
        result = engine.get_question_template("understand", "normalization", alt_topic="denormalization")
        assert isinstance(result, str)

    def test_invalid_blooms_level_uses_remember(self, engine):
        result = engine.get_question_template("invalid_level", "normalization")
        assert isinstance(result, str)
        assert "normalization" in result

    def test_empty_topic_still_returns_string(self, engine):
        result = engine.get_question_template("remember", "")
        assert isinstance(result, str)


# ── Answer Key Templates ──────────────────────────────────────

class TestGetAnswerKey:
    @pytest.mark.parametrize("level", ["remember", "understand", "apply", "analyze", "evaluate", "create"])
    def test_all_levels_produce_answer_key(self, engine, level):
        result = engine.get_answer_key(level, "normalization")
        assert isinstance(result, str)
        assert "normalization" in result

    def test_invalid_level_returns_remember_template(self, engine):
        result = engine.get_answer_key("invalid", "SQL")
        assert isinstance(result, str)
        assert "SQL" in result


# ── Topic Distribution ────────────────────────────────────────

class TestDistributeTopics:
    def test_returns_correct_count(self, engine, sample_topics):
        sections = [{"type": "short", "marks_per_q": 2, "count": 5, "total": 10}]
        blooms = {"remember": 0.5, "understand": 0.5}
        assignments = engine.distribute_topics_to_questions(sample_topics, sections, blooms)
        assert len(assignments) == 5

    def test_empty_topics_returns_empty(self, engine):
        sections = [{"type": "short", "marks_per_q": 2, "count": 5, "total": 10}]
        blooms = {"remember": 1.0}
        assignments = engine.distribute_topics_to_questions([], sections, blooms)
        assert assignments == []

    def test_empty_sections_returns_empty(self, engine, sample_topics):
        assignments = engine.distribute_topics_to_questions(sample_topics, [], {"remember": 1.0})
        assert assignments == []

    def test_assignment_has_required_fields(self, engine, sample_topics):
        sections = [{"type": "short", "marks_per_q": 2, "count": 3, "total": 6}]
        blooms = {"remember": 0.5, "apply": 0.5}
        assignments = engine.distribute_topics_to_questions(sample_topics, sections, blooms)
        for a in assignments:
            assert "question_type" in a
            assert "marks" in a
            assert "blooms_level" in a
            assert "topic" in a

    def test_blooms_levels_from_distribution(self, engine, sample_topics):
        sections = [{"type": "short", "marks_per_q": 2, "count": 20, "total": 40}]
        blooms = {"remember": 1.0}
        assignments = engine.distribute_topics_to_questions(sample_topics, sections, blooms)
        for a in assignments:
            assert a["blooms_level"] == "remember"

    def test_marks_per_question_correct(self, engine, sample_topics):
        sections = [{"type": "long", "marks_per_q": 10, "count": 3, "total": 30}]
        blooms = {"apply": 1.0}
        assignments = engine.distribute_topics_to_questions(sample_topics, sections, blooms)
        for a in assignments:
            assert a["marks"] == 10

    def test_multiple_sections(self, engine, sample_topics):
        sections = [
            {"type": "short", "marks_per_q": 2, "count": 5, "total": 10},
            {"type": "long",  "marks_per_q": 5, "count": 3, "total": 15},
        ]
        blooms = {"remember": 0.5, "apply": 0.5}
        assignments = engine.distribute_topics_to_questions(sample_topics, sections, blooms)
        assert len(assignments) == 8
        types = [a["question_type"] for a in assignments]
        assert "short" in types
        assert "long" in types
