from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.user import User
from backend.app.models.chat import Conversation, ChatMessage
from backend.app.schemas.chat import ChatMessageRequest, ChatMessageResponse, ConversationResponse, RenameConversationRequest
from backend.app.schemas.document import SourceCitation
from backend.app.auth import get_current_user
from backend.app.services.tutor_service import TutorService

router = APIRouter(prefix="/chat", tags=["AI Tutor"])

@router.post("", response_model=ChatMessageResponse)
def send_chat_message(
    req: ChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        assistant_msg = TutorService.answer_student_question(
            db=db,
            user_id=current_user.id,
            course_id=req.course_id,
            message_text=req.message,
            conversation_id=req.conversation_id,
            topic_id=req.topic_id,
            allow_outside_knowledge=req.allow_outside_knowledge,
            prioritized_document_id=req.prioritized_document_id
        )

        citations_out = []
        for c in (assistant_msg.citations or []):
            if isinstance(c, dict):
                citations_out.append(SourceCitation(**c))

        return ChatMessageResponse(
            id=assistant_msg.id,
            conversation_id=assistant_msg.conversation_id,
            role=assistant_msg.role.value if hasattr(assistant_msg.role, 'value') else str(assistant_msg.role),
            content=assistant_msg.content,
            citations=citations_out,
            is_grounded=assistant_msg.is_grounded,
            has_insufficient_evidence=assistant_msg.has_insufficient_evidence,
            model_badge=getattr(assistant_msg, 'model_badge', None),
            created_at=assistant_msg.created_at
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/stream")
def stream_chat_message(
    req: ChatMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        TutorService.stream_answer_student_question(
            db=db,
            user_id=current_user.id,
            course_id=req.course_id,
            message_text=req.message,
            conversation_id=req.conversation_id,
            topic_id=req.topic_id,
            allow_outside_knowledge=req.allow_outside_knowledge,
            prioritized_document_id=req.prioritized_document_id
        ),
        media_type="text/event-stream"
    )

@router.get("/health")
def get_chat_health():
    from backend.app.ai.llm import get_llm
    from backend.app.config import settings
    llm = get_llm()
    configured, reason = llm.check_health()
    badge = f"{settings.OLLAMA_MODEL} · local" if (configured and settings.LLM_PROVIDER in ["ollama", "anthropic"]) else "extractive · offline"
    return {
        "is_online": configured,
        "model": settings.OLLAMA_MODEL,
        "badge": badge,
        "reason": reason,
        "fix_command": f"Start Ollama and run: ollama pull {settings.OLLAMA_MODEL}"
    }

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    course_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    convos = db.query(Conversation).filter(
        Conversation.user_id == current_user.id,
        Conversation.course_id == course_id
    ).order_by(Conversation.created_at.desc()).all()

    results = []
    for c in convos:
        results.append(ConversationResponse(
            id=c.id,
            course_id=c.course_id,
            title=c.title,
            created_at=c.created_at,
            updated_at=c.updated_at,
            messages=[]
        ))
    return results

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation_detail(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    convo = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    msgs = []
    for m in convo.messages:
        citations_out = []
        for c in (m.citations or []):
            if isinstance(c, dict):
                citations_out.append(SourceCitation(**c))
        msgs.append(ChatMessageResponse(
            id=m.id,
            conversation_id=m.conversation_id,
            role=m.role.value if hasattr(m.role, 'value') else str(m.role),
            content=m.content,
            citations=citations_out,
            is_grounded=m.is_grounded,
            has_insufficient_evidence=m.has_insufficient_evidence,
            model_badge=m.model_badge,
            created_at=m.created_at
        ))

    return ConversationResponse(
        id=convo.id,
        course_id=convo.course_id,
        title=convo.title,
        created_at=convo.created_at,
        updated_at=convo.updated_at,
        messages=msgs
    )

@router.patch("/conversations/{conversation_id}", response_model=ConversationResponse)
def rename_conversation(
    conversation_id: int,
    req: RenameConversationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    convo = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    convo.title = req.title.strip() or "Study Session"
    db.commit()
    db.refresh(convo)
    return ConversationResponse(
        id=convo.id,
        course_id=convo.course_id,
        title=convo.title,
        created_at=convo.created_at,
        updated_at=convo.updated_at,
        messages=[]
    )

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    convo = db.query(Conversation).filter(
        Conversation.id == conversation_id,
        Conversation.user_id == current_user.id
    ).first()
    if not convo:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(convo)
    db.commit()
    return {"status": "deleted", "id": conversation_id}
