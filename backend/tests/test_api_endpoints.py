import pytest
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)

def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "AdaptiveLearn AI" in data["app"]

def test_auth_login_and_me():
    # Login as seeded student
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    token = token_data["access_token"]
    assert token_data["role"] == "student"

    # Get /me with Bearer token
    me_resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    user_info = me_resp.json()
    assert user_info["email"] == "student@adaptivelearn.ai"
    assert user_info["full_name"] == "Alex Chen"

def test_courses_and_prerequisites():
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    courses_resp = client.get("/api/courses", headers=headers)
    assert courses_resp.status_code == 200
    courses = courses_resp.json()
    assert len(courses) >= 1
    course_id = courses[0]["id"]

    prereq_resp = client.get(f"/api/courses/{course_id}/prerequisites", headers=headers)
    assert prereq_resp.status_code == 200
    graph = prereq_resp.json()
    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["nodes"]) >= 4

def test_grounded_tutor_chat():
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query grounded in seeded course document
    chat_resp = client.post("/api/chat", headers=headers, json={
        "course_id": 1,
        "message": "What is the primary objective of Gradient Descent in neural network optimization?"
    })
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["is_grounded"] is True
    assert len(chat_data["citations"]) >= 1
    # Check that citation has exact document and page
    first_cit = chat_data["citations"][0]
    assert first_cit["document_name"] == "Neural_Networks_Fundamentals.pdf"
    assert first_cit["page"] == 3

def test_unsupported_question_triggers_honest_abstention():
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Query that is completely out of domain
    chat_resp = client.post("/api/chat", headers=headers, json={
        "course_id": 1,
        "message": "What is the exact population of Madagascar during the bronze age?"
    })
    assert chat_resp.status_code == 200
    chat_data = chat_resp.json()
    assert chat_data["has_insufficient_evidence"] is True
    assert "insufficient" in chat_data["content"].lower()

def test_adaptive_quiz_flow():
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Start Quiz
    start_resp = client.post("/api/quizzes/start", headers=headers, json={
        "course_id": 1,
        "question_count": 2,
        "difficulty_mode": "adaptive"
    })
    assert start_resp.status_code == 200
    quiz_data = start_resp.json()
    session_id = quiz_data["id"]
    questions = quiz_data["questions"]
    assert len(questions) >= 1

    # Verify no correct answer leakage
    for q in questions:
        assert "correct_answer" not in q
        assert "numerical_tolerance" not in q

    # 2. Submit Answer
    target_q = questions[0]
    submit_resp = client.post("/api/quizzes/submit", headers=headers, json={
        "quiz_session_id": session_id,
        "question_id": target_q["id"],
        "answer": "A"
    })
    assert submit_resp.status_code == 200
    result = submit_resp.json()
    assert "is_correct" in result
    assert "p_mastery_after" in result
    assert "feedback" in result

    # 3. Finalize & Report
    finish_resp = client.post(f"/api/quizzes/{session_id}/finish", headers=headers)
    assert finish_resp.status_code == 200
    report = finish_resp.json()
    assert "score_percentage" in report
    assert "topic_breakdowns" in report
