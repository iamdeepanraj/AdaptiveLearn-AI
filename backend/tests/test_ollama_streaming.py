import pytest
import json
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.config import settings

client = TestClient(app)

def get_auth_token():
    login_resp = client.post("/api/auth/login", json={
        "email": "student@adaptivelearn.ai",
        "password": "StudentPass123!"
    })
    return login_resp.json()["access_token"]

def test_chat_health_endpoint():
    resp = client.get("/api/chat/health")
    assert resp.status_code == 200
    data = resp.json()
    assert "is_online" in data
    assert "model" in data
    assert "badge" in data
    assert "fix_command" in data
    assert settings.OLLAMA_MODEL in data["fix_command"]
    assert "ollama pull" in data["fix_command"]

def test_ollama_stream_endpoint_sse_events():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    courses_resp = client.get("/api/courses", headers=headers)
    course_id = courses_resp.json()[0]["id"]

    mock_tokens = ["Gradient ", "descent ", "updates ", "weights [S1]."]

    with patch("backend.app.ai.llm.OllamaProvider.check_health", return_value=(True, "Online")):
        with patch("backend.app.ai.llm.OllamaProvider.stream_complete", return_value=iter(mock_tokens)):
            resp = client.post(
                "/api/chat/stream",
                headers=headers,
                json={
                    "course_id": course_id,
                    "message": "Explain how gradient descent updates weights."
                }
            )
            assert resp.status_code == 200
            assert "text/event-stream" in resp.headers["content-type"]

            lines = [line.strip() for line in resp.text.split("\n") if line.strip().startswith("data: ")]
            assert len(lines) >= 3

            events = [json.loads(line[6:]) for line in lines]
            event_types = [e["type"] for e in events]

            assert "start" in event_types
            assert "token" in event_types
            assert "done" in event_types

            # Verify start event
            start_ev = next(e for e in events if e["type"] == "start")
            assert "conversation_id" in start_ev
            assert "model_badge" in start_ev
            assert start_ev["is_online"] is True

            # Verify token events
            streamed_text = "".join(e["token"] for e in events if e["type"] == "token")
            assert "Gradient" in streamed_text

            # Verify done event
            done_ev = next(e for e in events if e["type"] == "done")
            assert "id" in done_ev
            assert "model_badge" in done_ev
            assert "citations" in done_ev

def test_ollama_stream_offline_fallback():
    token = get_auth_token()
    headers = {"Authorization": f"Bearer {token}"}

    courses_resp = client.get("/api/courses", headers=headers)
    course_id = courses_resp.json()[0]["id"]

    # When Ollama is offline (check_health returns False)
    with patch("backend.app.ai.llm.OllamaProvider.check_health", return_value=(False, "Connection refused: Ollama daemon offline")):
        resp = client.post(
            "/api/chat/stream",
            headers=headers,
            json={
                "course_id": course_id,
                "message": "What is backpropagation in neural networks?"
            }
        )
        assert resp.status_code == 200
        assert "text/event-stream" in resp.headers["content-type"]

        lines = [line.strip() for line in resp.text.split("\n") if line.strip().startswith("data: ")]
        assert len(lines) >= 2

        events = [json.loads(line[6:]) for line in lines]
        
        # Verify fallback badge
        start_ev = next(e for e in events if e["type"] == "start")
        assert start_ev["is_online"] is False
        assert "extractive" in start_ev["model_badge"].lower()

        done_ev = next(e for e in events if e["type"] == "done")
        assert "extractive" in done_ev["model_badge"].lower()
        assert done_ev["content"] is not None
