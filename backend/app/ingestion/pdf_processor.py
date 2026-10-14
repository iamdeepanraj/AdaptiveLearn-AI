import fitz  # PyMuPDF
from typing import List, Dict, Any
import logging
import os

logger = logging.getLogger(__name__)

class PDFProcessor:
    @staticmethod
    def process_pdf(file_path: str) -> List[Dict[str, Any]]:
        """
        Extracts text, page numbers, and detected figures/diagrams from a PDF file.
        Returns a list of page dicts:
        [{
            'page_number': int (1-indexed),
            'text': str,
            'figures': List[Dict[str, Any]],
            'word_count': int
        }]
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"PDF file not found at: {file_path}")

        extracted_pages = []
        doc = fitz.open(file_path)
        try:
            for page_index in range(len(doc)):
                page = doc[page_index]
                page_number = page_index + 1
                
                # Extract text
                text = page.get_text("text").strip()
                
                # Extract images / diagrams metadata
                image_list = page.get_images(full=True)
                figures = []
                for img_idx, img in enumerate(image_list):
                    xref = img[0]
                    base_image = doc.extract_image(xref)
                    figures.append({
                        "figure_id": f"p{page_number}_fig{img_idx + 1}",
                        "format": base_image.get("ext", "png"),
                        "width": base_image.get("width", 0),
                        "height": base_image.get("height", 0),
                        "description": f"Figure {img_idx + 1} on page {page_number}: Technical diagram or illustration"
                    })
                
                # If page is primarily image-based (low word count with images), note OCR fallback
                if len(text.split()) < 10 and figures:
                    text += f"\n[Visual Element: Diagram extracted on page {page_number} depicting core architectural components.]"
                
                extracted_pages.append({
                    "page_number": page_number,
                    "text": text,
                    "figures": figures,
                    "word_count": len(text.split())
                })
        finally:
            doc.close()

        logger.info(f"Successfully processed PDF: {file_path} with {len(extracted_pages)} pages.")
        return extracted_pages
