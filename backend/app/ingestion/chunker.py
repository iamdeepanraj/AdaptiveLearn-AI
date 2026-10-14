from typing import List, Dict, Any, Optional
import re
import logging
from backend.app.models.document import SourceType

logger = logging.getLogger(__name__)

class SemanticChunker:
    @staticmethod
    def chunk_document_content(
        items: List[Dict[str, Any]],
        source_type: SourceType,
        max_words_per_chunk: int = 300,
        overlap_words: int = 40
    ) -> List[Dict[str, Any]]:
        """
        Splits extracted document items into searchable chunks while strictly preserving
        source locations (page numbers, slide numbers, or timestamps).
        """
        chunks = []
        global_chunk_idx = 0

        for item in items:
            page_number = item.get("page_number")
            slide_number = item.get("slide_number")
            timestamp_start = item.get("timestamp_start_sec")
            timestamp_end = item.get("timestamp_end_sec")
            figures = item.get("figures", [])
            text = item.get("text", "").strip()

            if not text and not figures:
                continue

            # Format figure description text if any
            fig_desc = None
            if figures:
                fig_desc = "; ".join([f.get("description", "") for f in figures if f.get("description")])

            # Split paragraphs
            paragraphs = [p.strip() for p in re.split(r'\n{2,}', text) if p.strip()]
            if not paragraphs:
                paragraphs = [text]

            current_chunk_words = []
            
            for para in paragraphs:
                words = para.split()
                if len(current_chunk_words) + len(words) > max_words_per_chunk and current_chunk_words:
                    # Emit current chunk
                    chunk_text = " ".join(current_chunk_words)
                    chunks.append({
                        "chunk_index": global_chunk_idx,
                        "content": chunk_text,
                        "page_number": page_number,
                        "slide_number": slide_number,
                        "timestamp_start_sec": timestamp_start,
                        "timestamp_end_sec": timestamp_end,
                        "source_type": source_type,
                        "figure_description": fig_desc
                    })
                    global_chunk_idx += 1
                    # Retain overlap words
                    current_chunk_words = current_chunk_words[-overlap_words:] + words
                else:
                    current_chunk_words.extend(words)

            if current_chunk_words:
                chunk_text = " ".join(current_chunk_words)
                chunks.append({
                    "chunk_index": global_chunk_idx,
                    "content": chunk_text,
                    "page_number": page_number,
                    "slide_number": slide_number,
                    "timestamp_start_sec": timestamp_start,
                    "timestamp_end_sec": timestamp_end,
                    "source_type": source_type,
                    "figure_description": fig_desc
                })
                global_chunk_idx += 1

        logger.info(f"Generated {len(chunks)} grounded chunks from {len(items)} source units.")
        return chunks
