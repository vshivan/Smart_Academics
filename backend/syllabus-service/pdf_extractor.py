"""PDF text extraction with OCR fallback."""
import io
import logging
from pathlib import Path

import pdfplumber
from PIL import Image
import pytesseract

logger = logging.getLogger(__name__)


class PDFExtractor:
    def extract(self, file_path: str) -> str:
        """Extract text from PDF. Falls back to OCR if text layer is absent."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        text = self._extract_text_layer(file_path)

        # If less than 100 chars extracted, assume scanned PDF → OCR
        if len(text.strip()) < 100:
            logger.info(f"Text layer sparse, falling back to OCR: {file_path}")
            text = self._ocr_extract(file_path)

        return text

    def _extract_text_layer(self, file_path: str) -> str:
        """Extract embedded text using pdfplumber."""
        pages_text = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        pages_text.append(page_text)
        except Exception as e:
            logger.warning(f"pdfplumber failed: {e}")
        return "\n".join(pages_text)

    def _ocr_extract(self, file_path: str) -> str:
        """OCR fallback using pytesseract."""
        pages_text = []
        try:
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    img = page.to_image(resolution=200).original
                    text = pytesseract.image_to_string(img, lang="eng")
                    pages_text.append(text)
        except Exception as e:
            logger.error(f"OCR failed: {e}")
            raise RuntimeError(f"PDF extraction failed (text + OCR): {e}")
        return "\n".join(pages_text)
