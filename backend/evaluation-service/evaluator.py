"""
Assignment Evaluator — local, no external AI.
Uses: keyword scoring + TF-IDF semantic similarity + rubric-based grading.
"""
import re
import logging
from typing import Optional
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import nltk
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer

nltk.download("stopwords", quiet=True)
nltk.download("punkt", quiet=True)

logger = logging.getLogger(__name__)
STOP_WORDS = set(stopwords.words("english"))
stemmer = PorterStemmer()


class AssignmentEvaluator:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))

    def evaluate(
        self,
        student_text: str,
        answer_key: str,
        keywords: list[str],
        total_marks: int,
        rubric: Optional[dict] = None,
    ) -> dict:
        """
        Multi-signal evaluation:
        1. Keyword coverage score (40%)
        2. Semantic similarity via TF-IDF cosine (40%)
        3. Rubric-based score (20%) if rubric provided
        """
        if not student_text.strip():
            return self._empty_submission(total_marks)

        keyword_score = self._keyword_score(student_text, keywords)
        semantic_score = self._semantic_similarity(student_text, answer_key)
        rubric_score = self._rubric_score(student_text, rubric) if rubric else semantic_score

        # Weighted combination
        if rubric:
            final_score = (keyword_score * 0.4) + (semantic_score * 0.4) + (rubric_score * 0.2)
        else:
            final_score = (keyword_score * 0.5) + (semantic_score * 0.5)

        marks = round(final_score * total_marks, 2)
        confidence = self._confidence(keyword_score, semantic_score)

        feedback = self._generate_feedback(keyword_score, semantic_score, keywords, student_text)

        return {
            "marks_awarded": marks,
            "total_marks": total_marks,
            "percentage": round(final_score * 100, 2),
            "keyword_score": round(keyword_score, 3),
            "semantic_score": round(semantic_score, 3),
            "rubric_scores": {"rubric": round(rubric_score, 3)} if rubric else {},
            "confidence_score": round(confidence, 3),
            "needs_review": confidence < 0.5,
            "feedback": feedback,
        }

    def _keyword_score(self, text: str, keywords: list[str]) -> float:
        """Fraction of expected keywords found in student text."""
        if not keywords:
            return 0.5  # neutral if no keywords defined
        text_lower = text.lower()
        text_tokens = set(self._tokenize(text_lower))
        found = 0
        for kw in keywords:
            kw_stem = stemmer.stem(kw.lower())
            if kw.lower() in text_lower or kw_stem in {stemmer.stem(t) for t in text_tokens}:
                found += 1
        return found / len(keywords)

    def _semantic_similarity(self, student_text: str, answer_key: str) -> float:
        """TF-IDF cosine similarity between student answer and answer key."""
        try:
            corpus = [answer_key, student_text]
            tfidf = self.vectorizer.fit_transform(corpus)
            sim = cosine_similarity(tfidf[0:1], tfidf[1:2])[0][0]
            return float(sim)
        except Exception as e:
            logger.warning(f"Semantic similarity failed: {e}")
            return 0.3

    def _rubric_score(self, text: str, rubric: dict) -> float:
        """Score based on rubric criteria (keyword presence per criterion)."""
        if not rubric or "criteria" not in rubric:
            return 0.5
        total_weight = sum(c.get("weight", 1) for c in rubric["criteria"])
        earned = 0.0
        for criterion in rubric["criteria"]:
            kws = criterion.get("keywords", [])
            weight = criterion.get("weight", 1)
            score = self._keyword_score(text, kws)
            earned += score * weight
        return earned / total_weight if total_weight > 0 else 0.5

    def _confidence(self, keyword_score: float, semantic_score: float) -> float:
        """Confidence = agreement between keyword and semantic scores."""
        diff = abs(keyword_score - semantic_score)
        avg = (keyword_score + semantic_score) / 2
        # High confidence when both signals agree and score is not near boundary
        return max(0.0, min(1.0, avg * (1 - diff)))

    def _generate_feedback(
        self, keyword_score: float, semantic_score: float, keywords: list[str], text: str
    ) -> str:
        parts = []
        if keyword_score >= 0.8:
            parts.append("Excellent coverage of key concepts.")
        elif keyword_score >= 0.5:
            parts.append("Good coverage of key concepts.")
        else:
            missing = [kw for kw in keywords if kw.lower() not in text.lower()][:3]
            parts.append(f"Missing key concepts: {', '.join(missing)}." if missing else "Limited concept coverage.")

        if semantic_score >= 0.7:
            parts.append("Answer aligns well with expected content.")
        elif semantic_score >= 0.4:
            parts.append("Partial alignment with expected answer.")
        else:
            parts.append("Answer needs more depth and detail.")

        return " ".join(parts)

    def _tokenize(self, text: str) -> list[str]:
        return re.findall(r"\b[a-z]+\b", text.lower())

    def _empty_submission(self, total_marks: int) -> dict:
        return {
            "marks_awarded": 0,
            "total_marks": total_marks,
            "percentage": 0.0,
            "keyword_score": 0.0,
            "semantic_score": 0.0,
            "rubric_scores": {},
            "confidence_score": 1.0,
            "needs_review": False,
            "feedback": "No submission found.",
        }
