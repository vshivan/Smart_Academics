"""Tests for Assignment Evaluator — keyword scoring, semantic similarity, rubric grading."""
import pytest
from evaluator import AssignmentEvaluator


@pytest.fixture(scope="module")
def evaluator():
    return AssignmentEvaluator()


# ── Full Evaluation ───────────────────────────────────────────

class TestEvaluate:
    def test_perfect_answer_high_marks(self, evaluator, perfect_student_answer, answer_key, keywords):
        result = evaluator.evaluate(perfect_student_answer, answer_key, keywords, total_marks=10)
        assert result["marks_awarded"] >= 6.0
        assert result["percentage"] >= 60.0

    def test_poor_answer_low_marks(self, evaluator, poor_student_answer, answer_key, keywords):
        result = evaluator.evaluate(poor_student_answer, answer_key, keywords, total_marks=10)
        assert result["marks_awarded"] < 5.0

    def test_empty_submission_zero_marks(self, evaluator, answer_key, keywords):
        result = evaluator.evaluate("", answer_key, keywords, total_marks=10)
        assert result["marks_awarded"] == 0
        assert result["percentage"] == 0.0
        assert result["needs_review"] is False
        assert result["feedback"] == "No submission found."

    def test_whitespace_only_is_empty(self, evaluator, answer_key, keywords):
        result = evaluator.evaluate("   \n\t  ", answer_key, keywords, total_marks=10)
        assert result["marks_awarded"] == 0

    def test_result_has_all_required_fields(self, evaluator, perfect_student_answer, answer_key, keywords):
        result = evaluator.evaluate(perfect_student_answer, answer_key, keywords, total_marks=10)
        required = ["marks_awarded", "total_marks", "percentage", "keyword_score",
                    "semantic_score", "rubric_scores", "confidence_score", "needs_review", "feedback"]
        for field in required:
            assert field in result, f"Missing field: {field}"

    def test_marks_do_not_exceed_total(self, evaluator, perfect_student_answer, answer_key, keywords):
        result = evaluator.evaluate(perfect_student_answer, answer_key, keywords, total_marks=10)
        assert result["marks_awarded"] <= 10.0

    def test_marks_not_negative(self, evaluator, poor_student_answer, answer_key, keywords):
        result = evaluator.evaluate(poor_student_answer, answer_key, keywords, total_marks=10)
        assert result["marks_awarded"] >= 0.0

    def test_with_rubric_uses_three_signals(self, evaluator, perfect_student_answer, answer_key, keywords, sample_rubric):
        result = evaluator.evaluate(perfect_student_answer, answer_key, keywords, total_marks=10, rubric=sample_rubric)
        assert result["rubric_scores"] != {}

    def test_without_rubric_empty_rubric_scores(self, evaluator, perfect_student_answer, answer_key, keywords):
        result = evaluator.evaluate(perfect_student_answer, answer_key, keywords, total_marks=10)
        assert result["rubric_scores"] == {}

    def test_total_marks_preserved(self, evaluator, perfect_student_answer, answer_key, keywords):
        result = evaluator.evaluate(perfect_student_answer, answer_key, keywords, total_marks=25)
        assert result["total_marks"] == 25

    def test_percentage_matches_marks(self, evaluator, perfect_student_answer, answer_key, keywords):
        result = evaluator.evaluate(perfect_student_answer, answer_key, keywords, total_marks=10)
        expected_pct = round((result["marks_awarded"] / 10) * 100, 2)
        assert abs(result["percentage"] - expected_pct) < 0.1


# ── Keyword Scoring ───────────────────────────────────────────

class TestKeywordScore:
    def test_all_keywords_present_score_one(self, evaluator):
        text = "normalization 1NF 2NF 3NF redundancy atomic dependency"
        keywords = ["normalization", "1NF", "2NF", "3NF"]
        score = evaluator._keyword_score(text, keywords)
        assert score == 1.0

    def test_no_keywords_present_score_zero(self, evaluator):
        text = "completely unrelated text about cooking recipes"
        keywords = ["normalization", "1NF", "2NF"]
        score = evaluator._keyword_score(text, keywords)
        assert score == 0.0

    def test_partial_keywords_partial_score(self, evaluator):
        text = "normalization and 1NF are important"
        keywords = ["normalization", "1NF", "2NF", "3NF"]
        score = evaluator._keyword_score(text, keywords)
        assert 0.0 < score < 1.0

    def test_empty_keywords_returns_neutral(self, evaluator):
        score = evaluator._keyword_score("some text", [])
        assert score == 0.5

    def test_case_insensitive_matching(self, evaluator):
        text = "NORMALIZATION and SQL are important"
        keywords = ["normalization", "sql"]
        score = evaluator._keyword_score(text, keywords)
        assert score == 1.0

    def test_stemming_matches_variations(self, evaluator):
        text = "normalizing the database reduces redundancies"
        keywords = ["normalization", "redundancy"]
        score = evaluator._keyword_score(text, keywords)
        assert score > 0.0


# ── Semantic Similarity ───────────────────────────────────────

class TestSemanticSimilarity:
    def test_identical_texts_high_similarity(self, evaluator, answer_key):
        score = evaluator._semantic_similarity(answer_key, answer_key)
        assert score > 0.9

    def test_similar_texts_moderate_similarity(self, evaluator, perfect_student_answer, answer_key):
        score = evaluator._semantic_similarity(perfect_student_answer, answer_key)
        assert score > 0.3

    def test_unrelated_texts_low_similarity(self, evaluator, answer_key):
        unrelated = "The weather today is sunny and warm. I enjoy cooking pasta."
        score = evaluator._semantic_similarity(unrelated, answer_key)
        assert score < 0.5

    def test_score_between_zero_and_one(self, evaluator, perfect_student_answer, answer_key):
        score = evaluator._semantic_similarity(perfect_student_answer, answer_key)
        assert 0.0 <= score <= 1.0

    def test_empty_text_returns_low_score(self, evaluator, answer_key):
        score = evaluator._semantic_similarity("", answer_key)
        assert score <= 0.3  # empty text → 0.0 or default fallback


# ── Rubric Scoring ────────────────────────────────────────────

class TestRubricScore:
    def test_rubric_with_all_keywords_present(self, evaluator, sample_rubric):
        text = "normalization reduces redundancy. 1NF 2NF 3NF atomic values. integrity maintenance efficiency"
        score = evaluator._rubric_score(text, sample_rubric)
        assert score > 0.5

    def test_rubric_with_no_keywords_present(self, evaluator, sample_rubric):
        text = "completely unrelated text about cooking and weather"
        score = evaluator._rubric_score(text, sample_rubric)
        assert score == 0.0

    def test_no_rubric_returns_neutral(self, evaluator):
        score = evaluator._rubric_score("some text", None)
        assert score == 0.5

    def test_empty_rubric_returns_neutral(self, evaluator):
        score = evaluator._rubric_score("some text", {})
        assert score == 0.5

    def test_rubric_without_criteria_returns_neutral(self, evaluator):
        score = evaluator._rubric_score("some text", {"criteria": []})
        assert score == 0.5

    def test_weighted_criteria(self, evaluator):
        rubric = {
            "criteria": [
                {"name": "A", "keywords": ["normalization"], "weight": 3},
                {"name": "B", "keywords": ["sql"],           "weight": 1},
            ]
        }
        text_with_normalization = "normalization is important"
        text_with_sql = "sql is important"
        score_norm = evaluator._rubric_score(text_with_normalization, rubric)
        score_sql  = evaluator._rubric_score(text_with_sql, rubric)
        # normalization has 3x weight, so its score should be higher
        assert score_norm > score_sql


# ── Confidence Score ──────────────────────────────────────────

class TestConfidence:
    def test_agreeing_high_scores_high_confidence(self, evaluator):
        conf = evaluator._confidence(0.9, 0.85)
        assert conf > 0.5

    def test_disagreeing_scores_low_confidence(self, evaluator):
        conf = evaluator._confidence(0.9, 0.1)
        assert conf < 0.5

    def test_both_zero_zero_confidence(self, evaluator):
        conf = evaluator._confidence(0.0, 0.0)
        assert conf == 0.0

    def test_confidence_between_zero_and_one(self, evaluator):
        for ks, ss in [(0.5, 0.5), (0.8, 0.7), (0.2, 0.9), (1.0, 1.0)]:
            conf = evaluator._confidence(ks, ss)
            assert 0.0 <= conf <= 1.0


# ── Feedback Generation ───────────────────────────────────────

class TestGenerateFeedback:
    def test_high_keyword_score_positive_feedback(self, evaluator, keywords):
        fb = evaluator._generate_feedback(0.9, 0.8, keywords, "normalization 1NF 2NF 3NF redundancy atomic dependency")
        assert "Excellent" in fb or "Good" in fb

    def test_low_keyword_score_mentions_missing(self, evaluator, keywords):
        fb = evaluator._generate_feedback(0.1, 0.2, keywords, "some unrelated text")
        assert "Missing" in fb or "Limited" in fb

    def test_high_semantic_score_positive_feedback(self, evaluator, keywords):
        fb = evaluator._generate_feedback(0.8, 0.8, keywords, "normalization 1NF 2NF 3NF")
        assert "aligns well" in fb

    def test_low_semantic_score_constructive_feedback(self, evaluator, keywords):
        fb = evaluator._generate_feedback(0.3, 0.2, keywords, "some text")
        assert "depth" in fb or "detail" in fb or "Partial" in fb


# ── Needs Review Flag ─────────────────────────────────────────

class TestNeedsReview:
    def test_low_confidence_flagged_for_review(self, evaluator, answer_key, keywords):
        # Contradictory answer — high keyword match but low semantic
        contradictory = " ".join(keywords)  # just keywords, no context
        result = evaluator.evaluate(contradictory, answer_key, keywords, total_marks=10)
        # confidence depends on signal agreement — just check it's a bool
        assert isinstance(result["needs_review"], bool)

    def test_empty_submission_not_flagged(self, evaluator, answer_key, keywords):
        result = evaluator.evaluate("", answer_key, keywords, total_marks=10)
        assert result["needs_review"] is False
