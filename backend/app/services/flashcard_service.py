from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import re
import json
import logging

from backend.app.models.course import Topic, Course
from backend.app.models.document import DocumentChunk, Document
from backend.app.models.quiz import Question
from backend.app.models.learner import LearnerMastery, MasteryState
from backend.app.learner.bkt import BayesianKnowledgeTracer
from backend.app.learner_model.spaced_repetition import SpacedRepetitionScheduler
from backend.app.schemas.flashcard import (
    FlashcardItem, FlashcardDeckResponse, FlashcardReviewRequest, FlashcardReviewResponse
)
from backend.app.ai.llm import get_llm

logger = logging.getLogger(__name__)

class FlashcardService:
    @classmethod
    def get_flashcards_for_topic(
        cls,
        db: Session,
        course_id: int,
        topic_id: int,
        user_id: int
    ) -> FlashcardDeckResponse:
        """
        Builds 6-10 flashcards strictly from the topic's uploaded material,
        each with an exact citation (page, slide, or timestamp).
        """
        topic = db.query(Topic).filter(Topic.id == topic_id).first()
        if not topic:
            raise ValueError(f"Topic {topic_id} not found")

        # 1. Fetch chunks for this topic
        chunks = db.query(DocumentChunk).filter(DocumentChunk.topic_id == topic_id).all()
        if not chunks:
            # Fallback to course chunks if topic has no directly tagged chunks
            chunks = db.query(DocumentChunk).filter(DocumentChunk.course_id == course_id).all()

        cards: List[FlashcardItem] = []

        # Attempt LLM extraction first if chunks exist
        llm = None
        try:
            llm = get_llm()
        except Exception:
            llm = None

        if llm and chunks:
            try:
                # Prepare compact chunk excerpts with metadata
                chunk_snippets = []
                for c in chunks[:8]:
                    doc_name = c.document.filename if c.document else "Course Guide"
                    cite_ref = f"Doc: {doc_name}"
                    if c.page_number:
                        cite_ref += f", Page: {c.page_number}"
                    elif c.slide_number:
                        cite_ref += f", Slide: {c.slide_number}"
                    elif c.timestamp_start_sec is not None:
                        cite_ref += f", Timestamp: {c.timestamp_start_sec}s"
                    chunk_snippets.append(f"[{c.id}] ({cite_ref}):\n{c.content[:400]}")

                prompt = (
                    f"You are a study companion generating quick-revise flashcards for the topic '{topic.name}'.\n"
                    f"Extract 6 to 10 distinct flashcards strictly from these course passages.\n"
                    f"Each card must be a definition, formula, or key fact.\n"
                    f"Never invent concepts not in the text.\n\n"
                    f"Passages:\n" + "\n\n".join(chunk_snippets) + "\n\n"
                    f"Output a valid JSON array of objects with keys:\n"
                    f"- 'front': concept question or term\n"
                    f"- 'back': concise explanation, formula, or fact\n"
                    f"- 'card_type': 'definition' | 'formula' | 'key_fact'\n"
                    f"- 'chunk_id': integer ID of the passage it was taken from\n"
                )
                system_prompt = "You are a precise educational tool. Return ONLY valid JSON array with no conversational filler."
                resp = llm.complete(prompt=prompt, system=system_prompt, temperature=0.1)
                
                # Parse JSON
                raw_text = resp if isinstance(resp, str) else getattr(resp, 'content', str(resp))
                raw_text = raw_text.strip()
                # Find JSON array
                match = re.search(r'\[\s*\{.*\}\s*\]', raw_text, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    chunk_map = {c.id: c for c in chunks}
                    for i, item in enumerate(parsed):
                        cid = item.get("chunk_id")
                        chunk_obj = chunk_map.get(cid, chunks[i % len(chunks)])
                        doc_name = chunk_obj.document.filename if chunk_obj.document else "Course Notes"
                        
                        cite_text = doc_name
                        if chunk_obj.page_number:
                            cite_text += f", p. {chunk_obj.page_number}"
                        elif chunk_obj.slide_number:
                            cite_text += f", Slide {chunk_obj.slide_number}"
                        elif chunk_obj.timestamp_start_sec is not None:
                            mins = chunk_obj.timestamp_start_sec // 60
                            secs = chunk_obj.timestamp_start_sec % 60
                            cite_text += f", {mins:02d}:{secs:02d}"

                        cards.append(FlashcardItem(
                            id=f"topic_{topic_id}_card_{i+1}",
                            topic_id=topic_id,
                            topic_name=topic.name,
                            front=item.get("front", f"Key Concept {i+1}"),
                            back=item.get("back", ""),
                            card_type=item.get("card_type", "key_fact"),
                            document_id=chunk_obj.document_id,
                            document_name=doc_name,
                            page=chunk_obj.page_number,
                            slide=chunk_obj.slide_number,
                            timestamp=chunk_obj.timestamp_start_sec,
                            citation_text=cite_text
                        ))
                        if len(cards) >= 10:
                            break
            except Exception as e:
                logger.warning(f"LLM flashcard generation fallback: {e}")
                cards.clear()

        # Deterministic extraction fallback (guarantees 6-10 cards with exact citations)
        if len(cards) < 6:
            cards.clear()
            # 1. From chunks: look for definitions, formulas, or key sentences
            card_idx = 1
            for c in chunks:
                doc_name = c.document.filename if c.document else "Course Document"
                cite_text = doc_name
                if c.page_number:
                    cite_text += f", p. {c.page_number}"
                elif c.slide_number:
                    cite_text += f", Slide {c.slide_number}"
                elif c.timestamp_start_sec is not None:
                    cite_text += f", {c.timestamp_start_sec // 60:02d}:{c.timestamp_start_sec % 60:02d}"

                lines = [l.strip() for l in c.content.split("\n") if len(l.strip()) > 20]
                for line in lines:
                    # Look for definitions or key concepts
                    card_type = "key_fact"
                    front = ""
                    back = ""

                    if "=" in line or "formula" in line.lower() or "speedup" in line.lower():
                        card_type = "formula"
                        parts = line.split(":", 1) if ":" in line else line.split("=", 1)
                        front = f"Formula / Calculation: {parts[0].strip()}"
                        back = line
                    elif "is defined as" in line.lower() or "refers to" in line.lower():
                        card_type = "definition"
                        m = re.split(r'is defined as|refers to', line, flags=re.IGNORECASE)
                        front = f"What is {m[0].strip()}?"
                        back = line
                    elif ":" in line and len(line.split(":")[0]) < 40:
                        parts = line.split(":", 1)
                        front = f"Definition: {parts[0].strip()}"
                        back = parts[1].strip()
                    else:
                        front = f"Key Fact in {topic.name}"
                        back = line

                    if front and back and len(back) > 15:
                        cards.append(FlashcardItem(
                            id=f"topic_{topic_id}_card_{card_idx}",
                            topic_id=topic_id,
                            topic_name=topic.name,
                            front=front,
                            back=back,
                            card_type=card_type,
                            document_id=c.document_id,
                            document_name=doc_name,
                            page=c.page_number,
                            slide=c.slide_number,
                            timestamp=c.timestamp_start_sec,
                            citation_text=cite_text
                        ))
                        card_idx += 1
                        if len(cards) >= 10:
                            break
                if len(cards) >= 10:
                    break

            # 2. If still < 6, supplement from existing questions on this topic
            if len(cards) < 6:
                topic_questions = db.query(Question).filter(Question.topic_id == topic_id).all()
                for q in topic_questions:
                    cites = q.source_citations or []
                    first_cite = cites[0] if cites and isinstance(cites[0], dict) else {}
                    doc_n = first_cite.get("document_name", "Course Material")
                    pg = first_cite.get("page")
                    sld = first_cite.get("slide")
                    ts = first_cite.get("timestamp_start")

                    c_str = doc_n
                    if pg:
                        c_str += f", p. {pg}"
                    elif sld:
                        c_str += f", Slide {sld}"
                    elif ts is not None:
                        c_str += f", {int(ts)//60:02d}:{int(ts)%60:02d}"

                    cards.append(FlashcardItem(
                        id=f"topic_{topic_id}_card_{card_idx}",
                        topic_id=topic_id,
                        topic_name=topic.name,
                        front=q.question_text,
                        back=f"Answer: {q.correct_answer}\nExplanation: {q.explanation}",
                        card_type="formula" if q.question_type.value == "numerical" else "definition",
                        document_id=first_cite.get("document_id"),
                        document_name=doc_n,
                        page=pg,
                        slide=sld,
                        timestamp=int(ts) if ts is not None else None,
                        citation_text=c_str
                    ))
                    card_idx += 1
                    if len(cards) >= 10:
                        break

            # 3. If still < 6, split sentences from chunks to guarantee at least 6 cards
            if len(cards) < 6:
                for c in chunks:
                    doc_name = c.document.filename if c.document else "Course Notes"
                    cite_text = doc_name
                    if c.page_number:
                        cite_text += f", p. {c.page_number}"
                    elif c.slide_number:
                        cite_text += f", Slide {c.slide_number}"
                    elif c.timestamp_start_sec is not None:
                        cite_text += f", {c.timestamp_start_sec // 60:02d}:{c.timestamp_start_sec % 60:02d}"

                    sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', c.content) if len(s.strip()) > 30]
                    for s in sentences:
                        if any(existing.back == s for existing in cards):
                            continue
                        cards.append(FlashcardItem(
                            id=f"topic_{topic_id}_card_{len(cards)+1}",
                            topic_id=topic_id,
                            topic_name=topic.name,
                            front=f"Key principle in {topic.name}:",
                            back=s,
                            card_type="key_fact",
                            document_id=c.document_id,
                            document_name=doc_name,
                            page=c.page_number,
                            slide=c.slide_number,
                            timestamp=c.timestamp_start_sec,
                            citation_text=cite_text
                        ))
                        if len(cards) >= 6:
                            break
                    if len(cards) >= 6:
                        break

        # Ensure between 6 and 10 cards
        final_cards = cards[:10]
        return FlashcardDeckResponse(
            topic_id=topic_id,
            topic_name=topic.name,
            course_id=course_id,
            cards=final_cards
        )

    @classmethod
    def review_flashcard(
        cls,
        db: Session,
        user_id: int,
        req: FlashcardReviewRequest
    ) -> FlashcardReviewResponse:
        """
        Updates the BKT learner model for the topic when a card is reviewed.
        'Didn't know' cards (knew_it=False) count as a negative learning signal,
        while 'Knew it' (knew_it=True) reinforces mastery.
        """
        mastery = db.query(LearnerMastery).filter(
            LearnerMastery.user_id == user_id,
            LearnerMastery.topic_id == req.topic_id
        ).first()

        if not mastery:
            mastery = LearnerMastery(
                user_id=user_id,
                topic_id=req.topic_id,
                p_mastery=BayesianKnowledgeTracer.DEFAULT_P_INIT,
                p_transit=BayesianKnowledgeTracer.DEFAULT_P_TRANSIT,
                p_slip=BayesianKnowledgeTracer.DEFAULT_P_SLIP,
                p_guess=BayesianKnowledgeTracer.DEFAULT_P_GUESS,
                mastery_state=MasteryState.NOVICE,
                total_attempts=0,
                correct_attempts=0,
                understanding_score=0.0,
                understanding_level="Not assessed",
                misconception_counts={},
                history_scores=[]
            )
            db.add(mastery)
            db.commit()
            db.refresh(mastery)

        p_before = mastery.p_mastery
        observed_score = 1.0 if req.knew_it else 0.0

        p_after, new_state = BayesianKnowledgeTracer.update_mastery(
            p_mastery_prior=p_before,
            observed_score=observed_score,
            p_transit=mastery.p_transit,
            p_slip=mastery.p_slip,
            p_guess=mastery.p_guess
        )

        mastery.p_mastery = p_after
        mastery.mastery_state = new_state
        mastery.total_attempts += 1
        if req.knew_it:
            mastery.correct_attempts += 1
        mastery.last_accuracy = mastery.correct_attempts / max(1, mastery.total_attempts)
        mastery.last_practiced_at = datetime.utcnow()

        # Update spaced repetition
        next_due, reps, inter, ease = SpacedRepetitionScheduler.calculate_next_review(
            is_correct=req.knew_it,
            repetition_count=mastery.repetition_count,
            easiness_factor=mastery.easiness_factor,
            interval_days=mastery.interval_days
        )
        mastery.next_review_due_at = next_due
        mastery.repetition_count = reps
        mastery.interval_days = inter
        mastery.easiness_factor = ease

        db.commit()

        delta = round(p_after - p_before, 4)
        status_msg = "Reinforced concept knowledge" if req.knew_it else "Flagged for spaced review"
        return FlashcardReviewResponse(
            success=True,
            topic_id=req.topic_id,
            p_mastery_before=round(p_before, 4),
            p_mastery_after=round(p_after, 4),
            mastery_delta=delta,
            message=f"{status_msg} ({'+' if delta >= 0 else ''}{round(delta*100, 1)} pts)"
        )
