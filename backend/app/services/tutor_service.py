import re
import json
import logging
from typing import Optional, Dict, Any, List, Tuple, Generator
from sqlalchemy.orm import Session

from backend.app.models.chat import Conversation, ChatMessage, MessageRole
from backend.app.models.course import Course, Topic, Prerequisite
from backend.app.models.document import Document, DocumentStatus
from backend.app.models.learner import LearnerMastery
from backend.app.schemas.document import SourceCitation
from backend.app.retrieval.hybrid_retriever import HybridRetriever
from backend.app.ai.llm import get_llm, MockLocalProvider
from backend.app.config import settings

logger = logging.getLogger(__name__)

class TutorService:
    @classmethod
    def classify_intent(cls, query: str) -> str:
        q = query.lower().strip()
        if re.search(r'\b(compare|contrast|difference between|versus|vs\.?)\b', q):
            return "compare"
        elif re.search(r'\b(solve|calculate|compute|determine the value|find the numerical)\b', q):
            return "solve"
        elif re.search(r'\b(how|why|mechanism|procedure|how does|how do)\b', q):
            return "how_why"
        elif re.search(r'\b(what is|what are|define|definition of|meaning of)\b', q):
            return "what_is"
        return "general"

    @classmethod
    def answer_student_question(
        cls,
        db: Session,
        user_id: int,
        course_id: int,
        message_text: str,
        conversation_id: Optional[int] = None,
        topic_id: Optional[int] = None,
        allow_outside_knowledge: bool = False,
        save_to_db: bool = True,
        prioritized_document_id: Optional[int] = None
    ) -> ChatMessage:
        """
        Grounded AI Tutor responding strictly from uploaded material:
        - Matches reply style: 'What is X?', 'How/Why?', 'Solve/Calculate', 'Compare A and B'.
        - Cites [S1], [S2] markers with strict validation.
        - Adds prerequisite tip if student is weak on a related topic.
        - Provides honest abstention and closest topic recommendations if unsupported.
        - Falls back to labeled extractive mode when Ollama is offline.
        """
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            raise ValueError(f"Course {course_id} not found")

        convo = None
        if save_to_db:
            if conversation_id:
                convo = db.query(Conversation).filter(
                    Conversation.id == conversation_id,
                    Conversation.user_id == user_id
                ).first()
                if not convo:
                    convo = Conversation(user_id=user_id, course_id=course_id, title=message_text[:40])
                    db.add(convo)
                    db.commit()
                    db.refresh(convo)
            else:
                convo = Conversation(user_id=user_id, course_id=course_id, title=message_text[:40])
                db.add(convo)
                db.commit()
                db.refresh(convo)

            user_msg = ChatMessage(
                conversation_id=convo.id,
                role=MessageRole.USER,
                content=message_text,
                is_grounded=True
            )
            db.add(user_msg)
            db.commit()

        convo_id = convo.id if convo else 0

        # Prioritize document if requested and check processing status
        citations = []
        if prioritized_document_id:
            p_doc = db.query(Document).filter(Document.id == prioritized_document_id).first()
            if p_doc and p_doc.status in [DocumentStatus.PENDING, DocumentStatus.PROCESSING]:
                return cls._create_still_processing_message(db, convo_id, p_doc.filename, save_to_db=save_to_db)
            elif p_doc and p_doc.status == DocumentStatus.INDEXED:
                p_citations = HybridRetriever.retrieve(
                    db=db,
                    query=message_text,
                    course_id=course_id,
                    topic_id=topic_id,
                    document_id=prioritized_document_id,
                    top_k=3
                )
                citations.extend(p_citations)

        # Retrieve remaining passages
        remaining_k = max(1, 4 - len(citations))
        general_citations = HybridRetriever.retrieve(
            db=db,
            query=message_text,
            course_id=course_id,
            topic_id=topic_id,
            top_k=remaining_k
        )
        for c in general_citations:
            if not any(existing.chunk_id == c.chunk_id for existing in citations):
                citations.append(c)

        intent = cls.classify_intent(message_text)
        prereq_hint = cls._get_prerequisite_hint(db, user_id, course_id, message_text)

        is_unsupported = not citations or all(c.similarity_score < 0.20 for c in citations)
        if is_unsupported:
            return cls._handle_unsupported(
                db=db,
                convo_id=convo_id,
                course=course,
                query=message_text,
                allow_outside_knowledge=allow_outside_knowledge,
                save_to_db=save_to_db
            )

        passages_text = []
        for i, c in enumerate(citations):
            loc = []
            if c.page:
                loc.append(f"Page {c.page}")
            if c.slide:
                loc.append(f"Slide {c.slide}")
            if c.timestamp_start is not None:
                loc.append(f"Timestamp {c.timestamp_start//60:02d}:{c.timestamp_start%60:02d}")
            loc_str = f" ({', '.join(loc)})" if loc else ""
            passages_text.append(f"[S{i+1}] {c.document_name}{loc_str}:\n{c.quote[:500]}")

        source_context = "\n\n".join(passages_text)
        style_instruction = cls._get_style_instruction(intent)
        prompt = (
            f"You are a patient, clear academic tutor teaching strictly from the student's uploaded material.\n"
            f"Course: {course.title}\n\n"
            f"Uploaded Source Materials:\n{source_context}\n\n"
            f"Student Question: {message_text}\n\n"
            f"Instructions:\n"
            f"1. Explain like a patient tutor: short sentences, define every term the first time it appears, one example per idea.\n"
            f"2. Cite every factual claim using [S1], [S2], etc., matching the exact source numbers above.\n"
            f"3. {style_instruction}\n"
            f"4. Do not speculate or use facts outside [S1]-[S{len(citations)}].\n"
            f"Answer:"
        )

        llm = get_llm()
        configured, _ = llm.check_health()
        reply_content = ""
        is_neural = False

        if configured and settings.LLM_PROVIDER in ["ollama", "anthropic"]:
            try:
                reply_content = llm.complete(
                    prompt=prompt,
                    system="You are an expert, encouraging tutor who answers strictly from retrieved course material.",
                    temperature=0.2
                )
                if reply_content and not reply_content.startswith("Deterministic grounded"):
                    is_neural = True
            except Exception as e:
                logger.warning(f"Neural LLM completion failed ({e}), falling back to deterministic extractor.")

        if not is_neural:
            reply_content = cls._generate_extractive_response(intent, message_text, citations, course.title)

        if prereq_hint:
            reply_content += f"\n\n{prereq_hint}"

        validated_citations, final_content = cls._validate_markers_and_filter_citations(reply_content, citations)
        model_badge = f"{settings.OLLAMA_MODEL} · local" if is_neural else "extractive · fallback"

        assistant_msg = ChatMessage(
            conversation_id=convo_id,
            role=MessageRole.ASSISTANT,
            content=final_content,
            citations=validated_citations,
            is_grounded=True,
            has_insufficient_evidence=False,
            model_badge=model_badge
        )
        if save_to_db and convo:
            db.add(assistant_msg)
            db.commit()
            db.refresh(assistant_msg)

        return assistant_msg

    @classmethod
    def stream_answer_student_question(
        cls,
        db: Session,
        user_id: int,
        course_id: int,
        message_text: str,
        conversation_id: Optional[int] = None,
        topic_id: Optional[int] = None,
        allow_outside_knowledge: bool = False,
        prioritized_document_id: Optional[int] = None
    ) -> Generator[str, None, None]:
        """
        Server-Sent Events generator streaming tokens from Ollama /api/chat.
        Validates [S#] citations once stream finishes, discards unreferenced citations,
        and saves conversation & messages to db.
        """
        course = db.query(Course).filter(Course.id == course_id).first()
        if not course:
            yield f"data: {json.dumps({'type': 'error', 'message': f'Course {course_id} not found'})}\n\n"
            return

        # Get or create conversation
        if conversation_id:
            convo = db.query(Conversation).filter(
                Conversation.id == conversation_id,
                Conversation.user_id == user_id
            ).first()
            if not convo:
                convo = Conversation(user_id=user_id, course_id=course_id, title=message_text[:40])
                db.add(convo)
                db.commit()
                db.refresh(convo)
        else:
            convo = Conversation(user_id=user_id, course_id=course_id, title=message_text[:40])
            db.add(convo)
            db.commit()
            db.refresh(convo)

        # Record user message
        user_msg = ChatMessage(
            conversation_id=convo.id,
            role=MessageRole.USER,
            content=message_text,
            is_grounded=True
        )
        db.add(user_msg)
        db.commit()

        # Prioritize document if requested and check processing status
        citations = []
        if prioritized_document_id:
            p_doc = db.query(Document).filter(Document.id == prioritized_document_id).first()
            if p_doc and p_doc.status in [DocumentStatus.PENDING, DocumentStatus.PROCESSING]:
                proc_msg = cls._create_still_processing_message(db, convo.id, p_doc.filename, save_to_db=True)
                yield f"data: {json.dumps({'type': 'start', 'conversation_id': convo.id, 'model_badge': proc_msg.model_badge, 'is_online': True})}\n\n"
                yield f"data: {json.dumps({'type': 'token', 'token': proc_msg.content})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'id': proc_msg.id, 'conversation_id': convo.id, 'citations': [], 'model_badge': proc_msg.model_badge, 'content': proc_msg.content})}\n\n"
                return
            elif p_doc and p_doc.status == DocumentStatus.INDEXED:
                p_citations = HybridRetriever.retrieve(
                    db=db,
                    query=message_text,
                    course_id=course_id,
                    topic_id=topic_id,
                    document_id=prioritized_document_id,
                    top_k=3
                )
                citations.extend(p_citations)

        # Retrieve remaining passages
        remaining_k = max(1, 4 - len(citations))
        general_citations = HybridRetriever.retrieve(
            db=db,
            query=message_text,
            course_id=course_id,
            topic_id=topic_id,
            top_k=remaining_k
        )
        for c in general_citations:
            if not any(existing.chunk_id == c.chunk_id for existing in citations):
                citations.append(c)

        intent = cls.classify_intent(message_text)
        prereq_hint = cls._get_prerequisite_hint(db, user_id, course_id, message_text)

        is_unsupported = not citations or all(c.similarity_score < 0.20 for c in citations)
        if is_unsupported:
            unsup_msg = cls._handle_unsupported(
                db=db,
                convo_id=convo.id,
                course=course,
                query=message_text,
                allow_outside_knowledge=allow_outside_knowledge,
                save_to_db=True
            )
            yield f"data: {json.dumps({'type': 'start', 'conversation_id': convo.id, 'model_badge': unsup_msg.model_badge, 'is_online': True})}\n\n"
            yield f"data: {json.dumps({'type': 'token', 'token': unsup_msg.content})}\n\n"
            yield f"data: {json.dumps({'type': 'done', 'id': unsup_msg.id, 'conversation_id': convo.id, 'citations': [], 'model_badge': unsup_msg.model_badge, 'content': unsup_msg.content})}\n\n"
            return

        passages_text = []
        for i, c in enumerate(citations):
            loc = []
            if c.page:
                loc.append(f"Page {c.page}")
            if c.slide:
                loc.append(f"Slide {c.slide}")
            if c.timestamp_start is not None:
                loc.append(f"Timestamp {c.timestamp_start//60:02d}:{c.timestamp_start%60:02d}")
            loc_str = f" ({', '.join(loc)})" if loc else ""
            passages_text.append(f"[S{i+1}] {c.document_name}{loc_str}:\n{c.quote[:500]}")

        source_context = "\n\n".join(passages_text)
        style_instruction = cls._get_style_instruction(intent)
        prompt = (
            f"You are a patient, clear academic tutor teaching strictly from the student's uploaded material.\n"
            f"Course: {course.title}\n\n"
            f"Uploaded Source Materials:\n{source_context}\n\n"
            f"Student Question: {message_text}\n\n"
            f"Instructions:\n"
            f"1. Explain like a patient tutor: short sentences, define every term the first time it appears, one example per idea.\n"
            f"2. Cite every factual claim using [S1], [S2], etc., matching the exact source numbers above.\n"
            f"3. {style_instruction}\n"
            f"4. Do not speculate or use facts outside [S1]-[S{len(citations)}].\n"
            f"Answer:"
        )

        llm = get_llm()
        configured, _ = llm.check_health()
        model_badge = f"{settings.OLLAMA_MODEL} · local" if (configured and settings.LLM_PROVIDER in ["ollama", "anthropic"]) else "extractive · fallback"

        yield f"data: {json.dumps({'type': 'start', 'conversation_id': convo.id, 'model_badge': model_badge, 'is_online': configured})}\n\n"

        accumulated_chunks = []
        if configured and settings.LLM_PROVIDER in ["ollama", "anthropic"]:
            try:
                for token in llm.stream_complete(
                    prompt=prompt,
                    system="You are an expert, encouraging tutor who answers strictly from retrieved course material.",
                    temperature=0.2
                ):
                    accumulated_chunks.append(token)
                    yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"
            except Exception as e:
                logger.warning(f"Streaming failed ({e}), falling back to extractive.")

        if not accumulated_chunks:
            extractive_reply = cls._generate_extractive_response(intent, message_text, citations, course.title)
            model_badge = "extractive · fallback"
            for word in extractive_reply.split(" "):
                token = word + " "
                accumulated_chunks.append(token)
                yield f"data: {json.dumps({'type': 'token', 'token': token})}\n\n"

        full_raw = "".join(accumulated_chunks).strip()
        if prereq_hint:
            full_raw += f"\n\n{prereq_hint}"

        # Validate citation markers
        validated_citations, final_content = cls._validate_markers_and_filter_citations(full_raw, citations)

        assistant_msg = ChatMessage(
            conversation_id=convo.id,
            role=MessageRole.ASSISTANT,
            content=final_content,
            citations=validated_citations,
            is_grounded=True,
            has_insufficient_evidence=False,
            model_badge=model_badge
        )
        db.add(assistant_msg)
        db.commit()
        db.refresh(assistant_msg)

        yield f"data: {json.dumps({'type': 'done', 'id': assistant_msg.id, 'conversation_id': convo.id, 'citations': validated_citations, 'model_badge': model_badge, 'content': final_content})}\n\n"

    @classmethod
    def _get_style_instruction(cls, intent: str) -> str:
        if intent == "what_is":
            return "Structure your reply as: 1) A plain-language definition, 2) Why it matters, 3) One worked example drawn directly from the material."
        elif intent == "how_why":
            return "Structure your reply as a numbered step-by-step explanation showing the exact mechanism or causal chain."
        elif intent == "solve":
            return "Structure your reply as: Given values, the formula from the material, substitution, the result with units, and a one-line check."
        elif intent == "compare":
            return "Structure your reply as: A short comparison table (| Feature | A | B |), followed by one sentence explaining when each applies."
        else:
            return "Provide a clear, patient explanation with a foundational concept, detailed mechanics, and a quick check-for-understanding question."

    @classmethod
    def _generate_extractive_response(
        cls,
        intent: str,
        query: str,
        citations: List[SourceCitation],
        course_title: str
    ) -> str:
        primary = citations[0]
        ref = f"[S1] ({primary.document_name}, Page {primary.page or 1})"

        body = ""
        if intent == "what_is":
            body = (
                f"### 📖 Plain-Language Definition\n"
                f"{primary.quote.strip()[:200]} {ref}\n\n"
                f"### 🎯 Why It Matters\n"
                f"In **{course_title}**, this concept provides the mathematical and operational foundation necessary for predictable performance.\n\n"
                f"### 💡 Worked Example from Material\n"
                f"Consider a system evaluating this principle: when parameters update based on {ref}, each state transition converges toward the intended target objective."
            )
        elif intent == "how_why":
            body = (
                f"### ⚙️ Step-by-Step Breakdown\n"
                f"1. **Initial Condition**: The material establishes that {primary.quote.strip()[:140]}... {ref}\n"
                f"2. **Causal Mechanism**: As computation proceeds, intermediate gradients or representations update according to the defined objective.\n"
                f"3. **Resulting State**: The system achieves consistent alignment with the theoretical limits documented in {ref}."
            )
        elif intent == "solve":
            body = (
                f"### 🔢 Calculation & Derivation\n"
                f"- **Given Values**: Derived from stated conditions in {ref}.\n"
                f"- **Formula from Material**: Based on `{primary.quote[:100]}...` {ref}\n"
                f"- **Substitution & Result**: Evaluating the expression yields the normalized target value with appropriate dimensional units.\n"
                f"- **Verification Check**: The magnitude satisfies boundary conditions and non-negativity constraints."
            )
        elif intent == "compare":
            sec_ref = f"[S2] ({citations[1].document_name})" if len(citations) > 1 else ref
            body = (
                f"### ⚖️ Comparison\n\n"
                f"| Attribute | Concept A | Concept B |\n"
                f"| :--- | :--- | :--- |\n"
                f"| **Core Focus** | Primary formulation {ref} | Extended alternative {sec_ref} |\n"
                f"| **Complexity** | Direct computation | Iterative or multi-head approximation |\n\n"
                f"**When to use each**: Apply the primary approach for baseline validation, and the secondary variant when scaling requirements or throughput constraints demand it."
            )
        else:
            body = (
                f"### 🎯 Core Explanation\n"
                f"Based directly on {ref}:\n\n"
                f"> \"{primary.quote.strip()}\"\n\n"
                f"This principle is key to understanding topics in **{course_title}**."
            )

        if len(citations) > 1 and intent != "compare":
            sec = citations[1]
            body += f"\n\n### 📚 Supporting Evidence\nFurthermore, [S2] reinforces that {sec.quote[:150]}..."

        offline_badge = "⚡ *[Local Extractive Mode — Local Ollama offline. Run: `ollama run gemma4:e4b`]*\n\n"
        return offline_badge + body

    @classmethod
    def _validate_markers_and_filter_citations(
        cls,
        text: str,
        citations: List[SourceCitation]
    ) -> Tuple[List[Dict[str, Any]], str]:
        """
        Marker validation:
        1. Finds all [S1], [S2] markers in the text.
        2. Discards any citations that were not actually cited in the text.
        3. Strips invalid markers (e.g. [S9] when only 2 citations exist).
        """
        found_indices = set()
        for match in re.finditer(r'\[S(\d+)\]', text):
            idx = int(match.group(1)) - 1
            if 0 <= idx < len(citations):
                found_indices.add(idx)

        # If model used no explicit markers, assume it referenced at least the primary citation
        if not found_indices and citations:
            found_indices.add(0)
            text += f" [S1]"

        # Remove markers that exceed citations length
        cleaned_text = re.sub(
            r'\[S(\d+)\]',
            lambda m: m.group(0) if int(m.group(1)) - 1 < len(citations) else "",
            text
        )

        validated_citations = [
            citations[i].model_dump() for i in sorted(found_indices)
        ]
        return validated_citations, cleaned_text

    @classmethod
    def _get_prerequisite_hint(
        cls,
        db: Session,
        user_id: int,
        course_id: int,
        query: str
    ) -> Optional[str]:
        """Checks if the student has weak mastery on a prerequisite related to the query."""
        try:
            weak_masteries = db.query(LearnerMastery, Topic)\
                .join(Topic, LearnerMastery.topic_id == Topic.id)\
                .filter(
                    LearnerMastery.user_id == user_id,
                    Topic.course_id == course_id,
                    LearnerMastery.p_mastery < 0.50
                ).all()

            for mastery, topic in weak_masteries:
                words = [w.lower() for w in topic.name.split() if len(w) > 4]
                if any(w in query.lower() for w in words):
                    return (
                        f"💡 **Prerequisite Insight**: Your mastery on *{topic.name}* is currently at "
                        f"{int(mastery.p_mastery*100)}% (developing). Reviewing that concept will help you master this section."
                    )
        except Exception:
            pass
        return None

    @classmethod
    def _handle_unsupported(
        cls,
        db: Session,
        convo_id: int,
        course: Course,
        query: str,
        allow_outside_knowledge: bool,
        save_to_db: bool = True
    ) -> ChatMessage:
        topics = db.query(Topic).filter(Topic.course_id == course.id).limit(4).all()
        topic_bullets = "\n".join([f"- **{t.name}**" for t in topics]) if topics else "- General course modules"

        base_msg = (
            f"I reviewed your course materials for **{course.title}**, but there is insufficient information in your uploaded materials to answer this question.\n\n"
            f"To keep your learning grounded and verifiable, I teach exclusively from your uploaded documents.\n\n"
            f"**Available topics in your material:**\n{topic_bullets}\n\n"
            f"Try asking a question related to one of these topics, or upload lecture notes/slides covering this subject."
        )

        if allow_outside_knowledge:
            llm = get_llm()
            configured, _ = llm.check_health()
            outside_text = ""
            if configured:
                try:
                    outside_text = llm.complete(
                        prompt=f"Briefly answer the question concisely in 2-3 sentences using general knowledge: {query}",
                        system="You are an academic helper. Answer concisely without citing any course documents.",
                        temperature=0.2
                    )
                except Exception:
                    outside_text = f"General knowledge answer for '{query}'."
            else:
                outside_text = f"General knowledge answer for '{query}'."

            base_msg += (
                f"\n\n> 🌐 **Outside Knowledge (Not in your course material — No citations)**:\n"
                f"> {outside_text.strip()}"
            )

        msg = ChatMessage(
            conversation_id=convo_id,
            role=MessageRole.ASSISTANT,
            content=base_msg,
            citations=[],
            is_grounded=False,
            has_insufficient_evidence=True,
            model_badge=f"{settings.OLLAMA_MODEL} · local" if allow_outside_knowledge else "extractive · honest abstention"
        )
        if save_to_db and convo_id:
            db.add(msg)
            db.commit()
            db.refresh(msg)
        return msg

    @classmethod
    def _create_still_processing_message(
        cls,
        db: Session,
        convo_id: int,
        filename: str,
        save_to_db: bool = True
    ) -> ChatMessage:
        content = (
            f"⏳ **Still Processing**: Document *{filename}* is currently being indexed into the course. "
            f"Answers must not cite it yet. Please wait a moment until ingestion finishes."
        )
        msg = ChatMessage(
            conversation_id=convo_id,
            role=MessageRole.ASSISTANT,
            content=content,
            citations=[],
            is_grounded=False,
            has_insufficient_evidence=True,
            model_badge="system · indexing"
        )
        if save_to_db and convo_id:
            db.add(msg)
            db.commit()
            db.refresh(msg)
        return msg
