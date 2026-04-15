"""Tests for NLP Pipeline — unit segmentation, topic extraction, Bloom's inference."""
import pytest
from nlp_pipeline import NLPPipeline


@pytest.fixture(scope="module")
def pipeline():
    return NLPPipeline()


# ── Unit Segmentation ─────────────────────────────────────────

class TestExtractTextStructure:
    def test_detects_unit_headers(self, pipeline, sample_syllabus_text):
        result = pipeline.extract_text_structure(sample_syllabus_text)
        assert len(result["units"]) >= 2
        unit_names = [u["name"] for u in result["units"]]
        assert any("Unit 1" in n or "Introduction" in n for n in unit_names)

    def test_fallback_to_general_unit_when_no_headers(self, pipeline):
        text = "This is plain text with no unit headers. Just some content about databases."
        result = pipeline.extract_text_structure(text)
        assert len(result["units"]) == 1
        assert result["units"][0]["name"] == "General"

    def test_empty_text_returns_general_unit(self, pipeline):
        result = pipeline.extract_text_structure("")
        assert len(result["units"]) == 1
        assert result["units"][0]["name"] == "General"

    def test_module_header_pattern(self, pipeline):
        text = "Module 1: Introduction\nSome content here.\nModule 2: Advanced Topics\nMore content."
        result = pipeline.extract_text_structure(text)
        assert len(result["units"]) == 2

    def test_chapter_header_pattern(self, pipeline):
        text = "Chapter 1: Basics\nContent.\nChapter 2: Advanced\nMore content."
        result = pipeline.extract_text_structure(text)
        assert len(result["units"]) == 2

    def test_numbered_header_pattern(self, pipeline):
        text = "1. Introduction\nContent here.\n2. Advanced Topics\nMore content."
        result = pipeline.extract_text_structure(text)
        assert len(result["units"]) >= 1

    def test_unit_content_captured(self, pipeline):
        text = "Unit 1: Databases\nThis is the content for unit 1.\nUnit 2: SQL\nSQL content here."
        result = pipeline.extract_text_structure(text)
        assert "content for unit 1" in result["units"][0]["raw_content"]

    def test_units_have_order(self, pipeline, sample_syllabus_text):
        result = pipeline.extract_text_structure(sample_syllabus_text)
        orders = [u["order"] for u in result["units"]]
        assert orders == list(range(1, len(orders) + 1))


# ── Topic Extraction ──────────────────────────────────────────

class TestExtractTopics:
    def test_returns_list_of_topics(self, pipeline, sample_syllabus_text):
        topics = pipeline.extract_topics(sample_syllabus_text)
        assert isinstance(topics, list)
        assert len(topics) > 0

    def test_topic_has_required_fields(self, pipeline, sample_syllabus_text):
        topics = pipeline.extract_topics(sample_syllabus_text)
        for topic in topics:
            assert "topic_name" in topic
            assert "topic_keywords" in topic
            assert "blooms_levels" in topic

    def test_respects_top_n_limit(self, pipeline, sample_syllabus_text):
        topics = pipeline.extract_topics(sample_syllabus_text, top_n=5)
        assert len(topics) <= 5

    def test_empty_text_returns_empty_or_minimal(self, pipeline):
        topics = pipeline.extract_topics("   ")
        assert isinstance(topics, list)

    def test_single_sentence_text(self, pipeline):
        topics = pipeline.extract_topics("Normalization reduces database redundancy.")
        assert isinstance(topics, list)

    def test_no_duplicate_topics(self, pipeline, sample_syllabus_text):
        topics = pipeline.extract_topics(sample_syllabus_text)
        names = [t["topic_name"] for t in topics]
        assert len(names) == len(set(names))


# ── Bloom's Level Inference ───────────────────────────────────

class TestInferBloomsLevels:
    def test_remember_keywords_detected(self, pipeline):
        text = "Students should define and list the key components."
        levels = pipeline._infer_blooms_levels(text)
        assert "remember" in levels

    def test_apply_keywords_detected(self, pipeline):
        text = "Students should solve problems and implement solutions."
        levels = pipeline._infer_blooms_levels(text)
        assert "apply" in levels

    def test_analyze_keywords_detected(self, pipeline):
        text = "Students should analyze and differentiate between approaches."
        levels = pipeline._infer_blooms_levels(text)
        assert "analyze" in levels

    def test_evaluate_keywords_detected(self, pipeline):
        text = "Students should evaluate and justify their design choices."
        levels = pipeline._infer_blooms_levels(text)
        assert "evaluate" in levels

    def test_create_keywords_detected(self, pipeline):
        text = "Students should design and construct a database system."
        levels = pipeline._infer_blooms_levels(text)
        assert "create" in levels

    def test_default_levels_when_no_keywords(self, pipeline):
        text = "This text has no taxonomy keywords at all."
        levels = pipeline._infer_blooms_levels(text)
        assert levels == ["remember", "understand", "apply"]

    def test_multiple_levels_detected(self, pipeline, sample_syllabus_text):
        levels = pipeline._infer_blooms_levels(sample_syllabus_text)
        assert len(levels) > 1

    def test_empty_text_returns_defaults(self, pipeline):
        levels = pipeline._infer_blooms_levels("")
        assert levels == ["remember", "understand", "apply"]


# ── Full Knowledge Graph Build ────────────────────────────────

class TestBuildKnowledgeGraph:
    def test_returns_correct_structure(self, pipeline, sample_syllabus_text):
        kg = pipeline.build_knowledge_graph(sample_syllabus_text, "sub_001")
        assert kg["subject_id"] == "sub_001"
        assert "units" in kg
        assert kg["version"] == 1

    def test_units_have_topics(self, pipeline, sample_syllabus_text):
        kg = pipeline.build_knowledge_graph(sample_syllabus_text, "sub_001")
        for unit in kg["units"]:
            assert "name" in unit
            assert "topics" in unit
            assert isinstance(unit["topics"], list)

    def test_empty_text_produces_valid_graph(self, pipeline):
        kg = pipeline.build_knowledge_graph("", "sub_empty")
        assert kg["subject_id"] == "sub_empty"
        assert isinstance(kg["units"], list)

    def test_subject_id_preserved(self, pipeline, sample_syllabus_text):
        kg = pipeline.build_knowledge_graph(sample_syllabus_text, "my_subject_123")
        assert kg["subject_id"] == "my_subject_123"
