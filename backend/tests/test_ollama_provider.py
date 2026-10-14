import pytest
from unittest.mock import patch, MagicMock
from pydantic import BaseModel
import httpx

from backend.app.ai.llm import OllamaProvider, get_llm

class SampleSchema(BaseModel):
    explanation: str
    key_points: list[str]

def test_ollama_provider_complete_mocked():
    provider = OllamaProvider(base_url="http://mock-ollama:11434", model="gemma4:e4b")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "message": {"content": "Grounded explanation from Gemma."}
    }

    with patch("httpx.Client.post", return_value=mock_resp) as mock_post:
        result = provider.complete(prompt="What is gradient descent?", system="You are an expert tutor.")
        assert result == "Grounded explanation from Gemma."
        assert mock_post.called
        call_args, call_kwargs = mock_post.call_args
        payload = call_kwargs["json"]
        assert payload["model"] == "gemma4:e4b"
        assert payload["stream"] is False
        assert len(payload["messages"]) == 2
        assert payload["messages"][0]["role"] == "system"
        assert payload["messages"][1]["role"] == "user"

def test_ollama_provider_complete_json_success():
    provider = OllamaProvider(base_url="http://mock-ollama:11434", model="gemma4:e4b")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "message": {
            "content": '{"explanation": "A first-order iterative optimization algorithm.", "key_points": ["gradient", "learning rate"]}'
        }
    }

    with patch("httpx.Client.post", return_value=mock_resp):
        parsed = provider.complete_json(
            prompt="Explain gradient descent",
            schema=SampleSchema
        )
        assert parsed is not None
        assert parsed.explanation.startswith("A first-order")
        assert "gradient" in parsed.key_points

def test_ollama_provider_complete_json_retry_on_invalid():
    provider = OllamaProvider(base_url="http://mock-ollama:11434", model="gemma4:e4b")

    # First attempt returns invalid text, second returns valid JSON
    bad_resp = MagicMock()
    bad_resp.status_code = 200
    bad_resp.json.return_value = {"message": {"content": "Here is the result: not valid json"}}

    good_resp = MagicMock()
    good_resp.status_code = 200
    good_resp.json.return_value = {
        "message": {
            "content": '{"explanation": "Valid recovered JSON.", "key_points": ["point1"]}'
        }
    }

    with patch("httpx.Client.post", side_effect=[bad_resp, good_resp]):
        parsed = provider.complete_json(
            prompt="Explain topic",
            schema=SampleSchema
        )
        assert parsed is not None
        assert parsed.explanation == "Valid recovered JSON."

def test_ollama_check_health_unpulled_model():
    provider = OllamaProvider(base_url="http://mock-ollama:11434", model="gemma4:e4b")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "models": [{"name": "llama3:latest"}]
    }

    with patch("httpx.Client.get", return_value=mock_resp):
        configured, reason = provider.check_health()
        assert configured is False
        assert "run: ollama pull gemma4:e4b" in reason

def test_ollama_check_health_ready():
    provider = OllamaProvider(base_url="http://mock-ollama:11434", model="gemma4:e4b")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "models": [{"name": "gemma4:e4b"}]
    }

    with patch("httpx.Client.get", return_value=mock_resp):
        configured, reason = provider.check_health()
        assert configured is True
        assert "ready" in reason.lower()

def test_ollama_check_health_unreachable():
    provider = OllamaProvider(base_url="http://mock-ollama:11434", model="gemma4:e4b")

    with patch("httpx.Client.get", side_effect=httpx.ConnectError("Connection refused")):
        configured, reason = provider.check_health()
        assert configured is False
        assert "unreachable" in reason.lower()

def test_get_llm_factory():
    llm = get_llm("ollama")
    assert isinstance(llm, OllamaProvider)
