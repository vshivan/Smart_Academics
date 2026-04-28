"""Question paper generator — deterministic core + optional AI refinement."""
import os
import uuid
import random
import logging
import httpx
from typing import Optional

from rule_engine import RuleEngine

logger = logging.getLogger(__name__)

KNOWLEDGE_SERVICE_URL = os.getenv("KNOWLEDGE_SERVICE_URL", "http://knowledge-service:8002")
AI_REFINEMENT_URL = os.getenv("AI_REFINEMENT_URL", "http://ai-refinement:8006")
USE_AI_REFINEMENT = os.getenv("USE_AI_REFINEMENT", "false").lower() == "true"

rule_engine = RuleEngine()


class QuestionGenerator:
    async def generate(self, config: dict) -> list[dict]:
        """
        Generate N paper sets from knowledge graph + rule engine.
        Returns list of paper dicts (one per set).
        """
        subject_id = config["subject_id"]
        exam_type = config.get("exam_type", "midterm")
        total_marks = config.get("total_marks")
        selected_units = config.get("selected_units", [])
        num_sets = config.get("generate_sets", 2)

        # Fetch topics from knowledge service
        topics = await self._fetch_topics(subject_id, selected_units)
        if not topics:
            raise ValueError(f"No topics found for subject {subject_id}. Upload syllabus first.")

        # Get exam pattern from rule engine
        pattern = rule_engine.get_pattern(exam_type, total_marks)

        papers = []
        for set_idx in range(num_sets):
            set_label = chr(65 + set_idx)  # A, B, C...
            questions = self._generate_paper(topics, pattern, config)

            # Optional AI refinement (max 1-2 calls per paper)
            if USE_AI_REFINEMENT:
                questions = await self._refine_with_ai(questions)

            papers.append({
                "paper_id": str(uuid.uuid4()),
                "paper_set": set_label,
                "exam_type": exam_type,
                "total_marks": sum(q["marks"] for q in questions),
                "duration_minutes": config.get("duration_minutes", 180),
                "questions": questions,
            })

        return papers

    def _generate_paper(self, topics: list[dict], pattern, config: dict) -> list[dict]:
        """Core deterministic generation."""
        # Use config distribution if provided and non-empty, else fall back to pattern default
        config_dist = config.get("blooms_distribution", {})
        blooms_dist = config_dist if config_dist else pattern.blooms_distribution
        assignments = rule_engine.distribute_topics_to_questions(topics, pattern.sections, blooms_dist)

        questions = []
        used_topics = set()

        for idx, assignment in enumerate(assignments):
            topic = assignment["topic"]
            blooms = assignment["blooms_level"]

            # Pick an alt_topic for comparison questions
            alt_topics = [t["topic_name"] for t in topics if t["topic_name"] != topic]
            alt_topic = random.choice(alt_topics) if alt_topics else topic

            question_text = rule_engine.get_question_template(blooms, topic, alt_topic)
            answer_key = rule_engine.get_answer_key(blooms, topic)

            questions.append({
                "question_id": str(uuid.uuid4()),
                "order_index": idx + 1,
                "question_text": question_text,
                "question_type": assignment["question_type"],
                "marks": assignment["marks"],
                "blooms_level": blooms,
                "topic": topic,
                "unit_name": assignment["unit_name"],
                "answer_key": answer_key,
                "keywords": assignment.get("keywords", []),
            })

        return questions

    async def _fetch_topics(self, subject_id: str, selected_units: list[str]) -> list[dict]:
        """Fetch topics from knowledge service (cached)."""
        async with httpx.AsyncClient(timeout=10) as client:
            params = {}
            resp = await client.get(f"{KNOWLEDGE_SERVICE_URL}/subjects/{subject_id}/topics", params=params)
            resp.raise_for_status()
            all_topics = resp.json().get("topics", [])

        if selected_units:
            all_topics = [t for t in all_topics if t.get("unit_name") in selected_units]

        return all_topics

    async def _refine_with_ai(self, questions: list[dict]) -> list[dict]:
        """
        Optional: send 1-2 questions to AI for grammar/clarity improvement.
        Strictly limited to avoid cost.
        """
        try:
            # Only refine first 2 questions max
            sample = questions[:2]
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    f"{AI_REFINEMENT_URL}/refine",
                    json={"questions": [q["question_text"] for q in sample]},
                )
                if resp.status_code == 200:
                    refined = resp.json().get("refined", [])
                    for i, q in enumerate(sample):
                        if i < len(refined):
                            questions[i]["question_text"] = refined[i]
        except Exception as e:
            logger.warning(f"AI refinement skipped: {e}")
        return questions
