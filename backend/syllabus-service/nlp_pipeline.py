"""
NLP Pipeline: PDF text → structured knowledge graph.
80-90% deterministic: spaCy + NLTK + TF-IDF.
"""
import re
import json
from typing import Optional
import spacy
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np

# Download required NLTK data
nltk.download("stopwords", quiet=True)
nltk.download("punkt", quiet=True)

# Load spaCy model (small, fast, free)
try:
    nlp = spacy.load("en_core_web_sm")
except OSError:
    import subprocess
    subprocess.run(["python", "-m", "spacy", "download", "en_core_web_sm"], check=True)
    nlp = spacy.load("en_core_web_sm")

STOP_WORDS = set(stopwords.words("english"))

# Bloom's taxonomy keyword mapping (deterministic)
BLOOMS_KEYWORDS = {
    "remember":   ["define", "list", "recall", "identify", "name", "state", "describe"],
    "understand": ["explain", "summarize", "classify", "compare", "interpret", "discuss"],
    "apply":      ["solve", "use", "demonstrate", "calculate", "implement", "apply"],
    "analyze":    ["analyze", "differentiate", "examine", "break down", "distinguish"],
    "evaluate":   ["evaluate", "justify", "critique", "assess", "argue", "defend"],
    "create":     ["design", "construct", "develop", "formulate", "create", "build"],
}

# Unit header patterns
UNIT_PATTERNS = [
    r"(?i)^(unit|module|chapter|section)\s*[-:]?\s*(\d+|[IVX]+)[:\s]+(.+)$",
    r"(?i)^(\d+)\.\s+(.+)$",
]


class NLPPipeline:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=200,
            stop_words="english",
            ngram_range=(1, 2),
        )

    def extract_text_structure(self, raw_text: str) -> dict:
        """Parse raw text into units and topics."""
        lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
        units = []
        current_unit = None
        current_content = []

        for line in lines:
            unit_match = self._match_unit_header(line)
            if unit_match:
                if current_unit:
                    current_unit["raw_content"] = " ".join(current_content)
                    units.append(current_unit)
                current_unit = {"name": unit_match, "order": len(units) + 1, "raw_content": ""}
                current_content = []
            else:
                current_content.append(line)

        if current_unit:
            current_unit["raw_content"] = " ".join(current_content)
            units.append(current_unit)

        # Fallback: treat whole text as one unit
        if not units:
            units = [{"name": "General", "order": 1, "raw_content": raw_text}]

        return {"units": units}

    def _match_unit_header(self, line: str) -> Optional[str]:
        for pattern in UNIT_PATTERNS:
            m = re.match(pattern, line)
            if m:
                return line.strip()
        return None

    def extract_topics(self, text: str, top_n: int = 10) -> list[dict]:
        """Extract key topics using TF-IDF + NER."""
        topics = []

        # TF-IDF based topic extraction
        sentences = sent_tokenize(text)
        if len(sentences) < 2:
            sentences = [text]

        try:
            tfidf_matrix = self.vectorizer.fit_transform(sentences)
            feature_names = self.vectorizer.get_feature_names_out()
            scores = np.asarray(tfidf_matrix.sum(axis=0)).flatten()
            top_indices = scores.argsort()[-top_n:][::-1]
            tfidf_topics = [feature_names[i] for i in top_indices]
        except Exception:
            tfidf_topics = []

        # spaCy NER for named concepts
        doc = nlp(text[:10000])  # limit for performance
        ner_topics = list({
            ent.text.lower() for ent in doc.ents
            if ent.label_ in ("ORG", "PRODUCT", "WORK_OF_ART", "LAW", "LANGUAGE")
        })

        # Noun chunks as topics
        noun_chunks = list({
            chunk.text.lower() for chunk in doc.noun_chunks
            if len(chunk.text.split()) <= 3
            and chunk.text.lower() not in STOP_WORDS
        })[:top_n]

        # Merge and deduplicate
        all_topics = list(dict.fromkeys(tfidf_topics + ner_topics + noun_chunks))[:top_n]

        for topic in all_topics:
            topics.append({
                "topic_name": topic,
                "topic_keywords": self._extract_keywords(topic, text),
                "blooms_levels": self._infer_blooms_levels(text),
            })

        return topics

    def _extract_keywords(self, topic: str, context: str) -> list[str]:
        """Extract related keywords for a topic from context."""
        doc = nlp(context[:5000])
        keywords = []
        for token in doc:
            if (
                not token.is_stop
                and not token.is_punct
                and token.pos_ in ("NOUN", "PROPN", "ADJ")
                and topic.lower() in token.text.lower()
            ):
                keywords.append(token.lemma_.lower())
        return list(set(keywords))[:5]

    def _infer_blooms_levels(self, text: str) -> list[str]:
        """Infer applicable Bloom's levels from text keywords."""
        text_lower = text.lower()
        applicable = []
        for level, keywords in BLOOMS_KEYWORDS.items():
            if any(kw in text_lower for kw in keywords):
                applicable.append(level)
        return applicable or ["remember", "understand", "apply"]

    def build_knowledge_graph(self, raw_text: str, subject_id: str) -> dict:
        """Full pipeline: raw text → knowledge graph JSON."""
        structure = self.extract_text_structure(raw_text)
        units_out = []

        for unit in structure["units"]:
            topics = self.extract_topics(unit["raw_content"])
            units_out.append({
                "name": unit["name"],
                "order": unit["order"],
                "topics": topics,
            })

        return {
            "subject_id": subject_id,
            "units": units_out,
            "version": 1,
        }
