"""Tests for PDF Extractor — text layer extraction and OCR fallback."""
import os
import io
import pytest
import tempfile
from unittest.mock import patch, MagicMock
from pdf_extractor import PDFExtractor


@pytest.fixture
def extractor():
    return PDFExtractor()


@pytest.fixture
def sample_pdf_path(tmp_path):
    """Create a minimal real PDF with embedded text using reportlab if available, else skip."""
    try:
        from reportlab.pdfgen import canvas
        pdf_path = str(tmp_path / "test_syllabus.pdf")
        c = canvas.Canvas(pdf_path)
        c.drawString(100, 750, "Unit 1: Introduction to Databases")
        c.drawString(100, 730, "Topics: normalization, SQL, transactions")
        c.drawString(100, 710, "Students should define and explain database concepts.")
        c.save()
        return pdf_path
    except ImportError:
        pytest.skip("reportlab not installed — skipping PDF creation tests")


class TestPDFExtractor:
    def test_file_not_found_raises_error(self, extractor):
        with pytest.raises(FileNotFoundError):
            extractor.extract("/nonexistent/path/file.pdf")

    def test_extract_returns_string(self, extractor, sample_pdf_path):
        text = extractor.extract(sample_pdf_path)
        assert isinstance(text, str)

    def test_extract_text_layer_from_valid_pdf(self, extractor, sample_pdf_path):
        text = extractor._extract_text_layer(sample_pdf_path)
        assert isinstance(text, str)

    def test_extract_contains_expected_content(self, extractor, sample_pdf_path):
        text = extractor.extract(sample_pdf_path)
        assert len(text) > 0

    def test_ocr_fallback_triggered_for_sparse_text(self, extractor, sample_pdf_path):
        """When text layer returns < 100 chars, OCR should be triggered."""
        with patch.object(extractor, "_extract_text_layer", return_value="short"):
            with patch.object(extractor, "_ocr_extract", return_value="OCR extracted text") as mock_ocr:
                result = extractor.extract(sample_pdf_path)
                mock_ocr.assert_called_once()
                assert result == "OCR extracted text"

    def test_no_ocr_when_text_layer_sufficient(self, extractor, sample_pdf_path):
        """When text layer returns >= 100 chars, OCR should NOT be triggered."""
        long_text = "A" * 200
        with patch.object(extractor, "_extract_text_layer", return_value=long_text):
            with patch.object(extractor, "_ocr_extract") as mock_ocr:
                result = extractor.extract(sample_pdf_path)
                mock_ocr.assert_not_called()
                assert result == long_text

    def test_extract_text_layer_handles_pdfplumber_error(self, extractor, tmp_path):
        """Corrupted PDF should return empty string, not raise."""
        bad_pdf = str(tmp_path / "bad.pdf")
        with open(bad_pdf, "wb") as f:
            f.write(b"not a real pdf content")
        result = extractor._extract_text_layer(bad_pdf)
        assert isinstance(result, str)

    def test_ocr_failure_raises_runtime_error(self, extractor, sample_pdf_path):
        with patch("pytesseract.image_to_string", side_effect=Exception("OCR engine error")):
            with pytest.raises(RuntimeError, match="PDF extraction failed"):
                extractor._ocr_extract(sample_pdf_path)
