"""
Rule Engine — 100% deterministic.
Handles: marks distribution, Bloom's mapping, exam patterns.
No AI involved.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ExamPattern:
    exam_type: str
    total_marks: int
    sections: list[dict] = field(default_factory=list)
    blooms_distribution: dict[str, float] = field(default_factory=dict)
    difficulty_distribution: dict[str, float] = field(default_factory=dict)


# Predefined exam patterns (configurable per college)
EXAM_PATTERNS = {
    "midterm": ExamPattern(
        exam_type="midterm",
        total_marks=50,
        sections=[
            {"type": "short", "marks_per_q": 2, "count": 10, "total": 20},
            {"type": "long",  "marks_per_q": 5, "count": 4,  "total": 20},
            {"type": "long",  "marks_per_q": 10,"count": 1,  "total": 10},
        ],
        blooms_distribution={"remember": 0.3, "understand": 0.3, "apply": 0.25, "analyze": 0.15},
        difficulty_distribution={"easy": 0.4, "medium": 0.4, "hard": 0.2},
    ),
    "final": ExamPattern(
        exam_type="final",
        total_marks=100,
        sections=[
            {"type": "short", "marks_per_q": 2, "count": 10, "total": 20},
            {"type": "long",  "marks_per_q": 5, "count": 6,  "total": 30},
            {"type": "long",  "marks_per_q": 10,"count": 5,  "total": 50},
        ],
        blooms_distribution={"remember": 0.2, "understand": 0.2, "apply": 0.3, "analyze": 0.2, "evaluate": 0.1},
        difficulty_distribution={"easy": 0.3, "medium": 0.5, "hard": 0.2},
    ),
    "quiz": ExamPattern(
        exam_type="quiz",
        total_marks=20,
        sections=[
            {"type": "mcq",   "marks_per_q": 1, "count": 10, "total": 10},
            {"type": "short", "marks_per_q": 2, "count": 5,  "total": 10},
        ],
        blooms_distribution={"remember": 0.5, "understand": 0.3, "apply": 0.2},
        difficulty_distribution={"easy": 0.5, "medium": 0.4, "hard": 0.1},
    ),
}

# Bloom's level → question verb templates
BLOOMS_TEMPLATES = {
    "remember": [
        "Define {topic}.",
        "List the key components of {topic}.",
        "State the properties of {topic}.",
        "Name the types of {topic}.",
        "Recall the definition of {topic}.",
    ],
    "understand": [
        "Explain {topic} with an example.",
        "Describe the concept of {topic}.",
        "Summarize the importance of {topic}.",
        "Compare {topic} with {alt_topic}.",
        "Classify the types of {topic}.",
    ],
    "apply": [
        "Solve the following problem using {topic}.",
        "Demonstrate the use of {topic} in a real-world scenario.",
        "Apply {topic} to solve: {scenario}.",
        "Calculate the result using {topic}.",
        "Implement {topic} for the given case.",
    ],
    "analyze": [
        "Analyze the advantages and disadvantages of {topic}.",
        "Differentiate between {topic} and {alt_topic}.",
        "Examine the relationship between {topic} and {alt_topic}.",
        "Break down the components of {topic}.",
        "Identify the key factors affecting {topic}.",
    ],
    "evaluate": [
        "Evaluate the effectiveness of {topic}.",
        "Justify the use of {topic} in the given context.",
        "Critique the approach of {topic}.",
        "Assess the impact of {topic} on {context}.",
        "Argue for or against the use of {topic}.",
    ],
    "create": [
        "Design a system using {topic}.",
        "Construct a solution for {scenario} using {topic}.",
        "Develop a plan that incorporates {topic}.",
        "Formulate an approach to solve {scenario} using {topic}.",
        "Create a model demonstrating {topic}.",
    ],
}

# Answer key templates per Bloom's level
ANSWER_KEY_TEMPLATES = {
    "remember":   "Key points: Definition of {topic}, its types, and basic properties.",
    "understand": "Explanation should cover: concept of {topic}, examples, and significance.",
    "apply":      "Solution should demonstrate: application of {topic} principles to the given problem.",
    "analyze":    "Analysis should include: comparison, advantages/disadvantages, and relationships of {topic}.",
    "evaluate":   "Evaluation should cover: criteria, justification, and conclusion about {topic}.",
    "create":     "Design/solution should include: requirements, approach, and implementation of {topic}.",
}


class RuleEngine:
    def get_pattern(self, exam_type: str, total_marks: Optional[int] = None) -> ExamPattern:
        pattern = EXAM_PATTERNS.get(exam_type, EXAM_PATTERNS["midterm"])
        if total_marks and total_marks != pattern.total_marks:
            # Scale sections proportionally
            pattern = self._scale_pattern(pattern, total_marks)
        return pattern

    def _scale_pattern(self, pattern: ExamPattern, target_marks: int) -> ExamPattern:
        scale = target_marks / pattern.total_marks
        scaled_sections = []
        for section in pattern.sections:
            scaled_sections.append({
                **section,
                "count": max(1, round(section["count"] * scale)),
                "total": round(section["total"] * scale),
            })
        return ExamPattern(
            exam_type=pattern.exam_type,
            total_marks=target_marks,
            sections=scaled_sections,
            blooms_distribution=pattern.blooms_distribution,
            difficulty_distribution=pattern.difficulty_distribution,
        )

    def get_question_template(self, blooms_level: str, topic: str, alt_topic: str = "", scenario: str = "") -> str:
        import random
        templates = BLOOMS_TEMPLATES.get(blooms_level, BLOOMS_TEMPLATES["remember"])
        template = random.choice(templates)
        return template.format(
            topic=topic,
            alt_topic=alt_topic or topic,
            scenario=scenario or f"a real-world {topic} problem",
            context="academic settings",
        )

    def get_answer_key(self, blooms_level: str, topic: str) -> str:
        template = ANSWER_KEY_TEMPLATES.get(blooms_level, ANSWER_KEY_TEMPLATES["remember"])
        return template.format(topic=topic)

    def distribute_topics_to_questions(
        self,
        topics: list[dict],
        sections: list[dict],
        blooms_dist: dict[str, float],
    ) -> list[dict]:
        """Map topics to question slots based on Bloom's distribution."""
        import random
        assignments = []

        # Fall back to default midterm distribution if empty
        if not blooms_dist:
            blooms_dist = EXAM_PATTERNS["midterm"].blooms_distribution

        blooms_levels = [k for k, v in blooms_dist.items() if v > 0]
        blooms_weights = [v for v in blooms_dist.values() if v > 0]

        # Safety: if still empty, use uniform distribution
        if not blooms_levels:
            blooms_levels = ["remember", "understand", "apply"]
            blooms_weights = [0.4, 0.4, 0.2]

        topic_pool = topics.copy()
        if not topic_pool:
            return []

        for section in sections:
            for i in range(section["count"]):
                topic = random.choice(topic_pool)
                blooms = random.choices(blooms_levels, weights=blooms_weights, k=1)[0]
                assignments.append({
                    "question_type": section["type"],
                    "marks": section["marks_per_q"],
                    "blooms_level": blooms,
                    "topic": topic.get("topic_name", ""),
                    "unit_name": topic.get("unit_name", ""),
                    "keywords": topic.get("topic_keywords", []),
                })

        return assignments
