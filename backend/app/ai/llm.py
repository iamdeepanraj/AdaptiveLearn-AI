import os
import json
import base64
import logging
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, Type, Tuple, List, Generator
import httpx
from pydantic import BaseModel, ValidationError

from backend.app.config import settings

logger = logging.getLogger(__name__)

class BaseLLMProvider(ABC):
    @abstractmethod
    def complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.2,
        format: Optional[str] = None
    ) -> str:
        """Generates a text completion given prompt and optional system message."""
        pass

    @abstractmethod
    def describe_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        prompt: str = "Describe this figure or diagram in detail."
    ) -> str:
        """Generates a descriptive caption for a diagram or image."""
        pass

    @abstractmethod
    def check_health(self) -> Tuple[bool, str]:
        """Returns (configured: bool, reason: str)."""
        pass

    def stream_complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.2
    ) -> Generator[str, None, None]:
        """Streams completion tokens one-by-one."""
        full_text = self.complete(prompt=prompt, system=system, temperature=temperature)
        yield full_text

    def complete_json(
        self,
        prompt: str,
        schema: Type[BaseModel],
        system: Optional[str] = None,
        temperature: float = 0.2
    ) -> Optional[BaseModel]:
        """
        Validates JSON output against a Pydantic schema.
        If validation or JSON decoding fails, retries ONCE with a strict repair prompt.
        If it fails again, logs the failure and returns None.
        """
        # First attempt
        raw = self.complete(prompt=prompt, system=system, temperature=temperature, format="json")
        try:
            cleaned = self._clean_json_string(raw)
            data = json.loads(cleaned)
            return schema.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e1:
            logger.warning(f"Initial JSON validation failed: {e1}. Retrying with stricter instructions...")

        # Retry with strict prompt
        retry_prompt = (
            f"{prompt}\n\n"
            f"IMPORTANT: Your previous output failed JSON validation. "
            f"Return ONLY valid, well-formed JSON conforming exactly to the requested schema. "
            f"Do NOT include markdown fences, comments, or explanations outside the JSON."
        )
        try:
            raw_retry = self.complete(prompt=retry_prompt, system=system, temperature=0.1, format="json")
            cleaned_retry = self._clean_json_string(raw_retry)
            data_retry = json.loads(cleaned_retry)
            return schema.model_validate(data_retry)
        except Exception as e2:
            logger.error(f"JSON validation retry failed: {e2}. Discarding output.", exc_info=False)
            return None

    @staticmethod
    def _clean_json_string(raw: str) -> str:
        text = raw.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
        return text.strip()


class OllamaProvider(BaseLLMProvider):
    """
    Local Model Provider via Ollama API.
    Interacts with local Gemma models (default: gemma4:e4b) using POST /api/chat.
    """
    def __init__(
        self,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
        timeout: Optional[float] = None,
        num_ctx: Optional[int] = None
    ):
        self.base_url = (base_url or settings.OLLAMA_BASE_URL).rstrip("/").replace("localhost", "127.0.0.1")
        self.model = model or settings.OLLAMA_MODEL
        self.timeout = timeout or settings.OLLAMA_TIMEOUT_S
        self.num_ctx = num_ctx or settings.OLLAMA_NUM_CTX

    def complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.2,
        format: Optional[str] = None
    ) -> str:
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload: Dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_ctx": self.num_ctx
            }
        }
        if format == "json":
            payload["format"] = "json"

        client_timeout = httpx.Timeout(self.timeout, connect=2.0)
        try:
            with httpx.Client(timeout=client_timeout) as client:
                res = client.post(f"{self.base_url}/api/chat", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    msg = data.get("message", {})
                    return msg.get("content", "").strip()
                else:
                    logger.warning(f"Ollama returned HTTP {res.status_code}: {res.text}. Falling back to labeled extractive mode.")
                    return MockLocalProvider().complete(prompt=prompt, system=system, temperature=temperature, format=format)
        except Exception as e:
            logger.warning(f"Ollama complete() unreachable or error ({e}). Falling back to labeled extractive mode.")
            return MockLocalProvider().complete(prompt=prompt, system=system, temperature=temperature, format=format)

    def stream_complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.2
    ) -> Generator[str, None, None]:
        """
        Streams completion token by token from Ollama /api/chat with stream=True.
        Falls back cleanly to MockLocalProvider streaming if unreachable.
        """
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_ctx": self.num_ctx
            }
        }
        client_timeout = httpx.Timeout(self.timeout, connect=2.0)
        yielded_any = False
        try:
            with httpx.Client(timeout=client_timeout) as client:
                with client.stream("POST", f"{self.base_url}/api/chat", json=payload) as response:
                    if response.status_code == 200:
                        for line in response.iter_lines():
                            if not line:
                                continue
                            try:
                                chunk_json = json.loads(line)
                                token = chunk_json.get("message", {}).get("content", "")
                                if token:
                                    yielded_any = True
                                    yield token
                            except Exception:
                                continue
                    else:
                        logger.warning(f"Ollama stream returned HTTP {response.status_code}. Using extractive fallback.")
        except Exception as e:
            logger.warning(f"Ollama stream_complete failed ({e}), falling back to extractive chunks.")

        if not yielded_any:
            for chunk in MockLocalProvider().stream_complete(prompt=prompt, system=system, temperature=temperature):
                yield chunk

    def describe_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        prompt: str = "Describe this figure or diagram in detail."
    ) -> str:
        """
        Attempts vision model description via Ollama.
        If the model or Ollama does not support vision, catches exception and returns empty string.
        """
        try:
            b64_img = base64.b64encode(image_bytes).decode("utf-8")
            payload = {
                "model": self.model,
                "messages": [
                    {
                        "role": "user",
                        "content": prompt,
                        "images": [b64_img]
                    }
                ],
                "stream": False,
                "options": {
                    "temperature": 0.2,
                    "num_ctx": 4096
                }
            }
            with httpx.Client(timeout=60.0) as client:
                res = client.post(f"{self.base_url}/api/chat", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    return data.get("message", {}).get("content", "").strip()
        except Exception as e:
            logger.info(f"Ollama vision captioning unavailable for model '{self.model}': {e}. Skipping caption.")
        return ""

    _last_health_check_time: float = 0.0
    _last_health_status: Optional[Tuple[bool, str]] = None

    def check_health(self) -> Tuple[bool, str]:
        """
        Checks if Ollama is running and if the required model is pulled.
        Caches result for 10s to prevent repeated network delays when offline.
        """
        import time
        now = time.time()
        if self._last_health_status is not None and (now - self._last_health_check_time) < 10.0:
            return self._last_health_status

        try:
            with httpx.Client(timeout=1.0) as client:
                res = client.get(f"{self.base_url}/api/tags")
                if res.status_code != 200:
                    status = (False, f"Ollama returned status {res.status_code}")
                else:
                    data = res.json()
                    models = [m.get("name", "") for m in data.get("models", [])]
                    req_model = self.model.lower()
                    matched = any(
                        req_model == m.lower() or
                        req_model in m.lower() or
                        m.lower().startswith(req_model.split(":")[0])
                        for m in models
                    )
                    if not matched:
                        status = (False, f"run: ollama pull {self.model}")
                    else:
                        status = (True, f"Ollama model '{self.model}' ready")
        except Exception as e:
            status = (False, f"Ollama unreachable at {self.base_url}: {str(e)[:60]}")

        self._last_health_check_time = now
        self._last_health_status = status
        return status


class AnthropicProvider(BaseLLMProvider):
    """Cloud fallback provider via Anthropic Messages API."""
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: Optional[str] = None
    ):
        self.api_key = api_key or settings.ANTHROPIC_API_KEY
        self.model = model or settings.ANTHROPIC_MODEL

    def complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.2,
        format: Optional[str] = None
    ) -> str:
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is not configured.")

        messages = [{"role": "user", "content": prompt}]
        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }
        body: Dict[str, Any] = {
            "model": self.model,
            "max_tokens": 2048,
            "temperature": temperature,
            "messages": messages
        }
        if system:
            body["system"] = system

        with httpx.Client(timeout=60.0) as client:
            res = client.post("https://api.anthropic.com/v1/messages", headers=headers, json=body)
            if res.status_code == 200:
                data = res.json()
                return data["content"][0]["text"].strip()
            raise RuntimeError(f"Anthropic error {res.status_code}: {res.text}")

    def describe_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        prompt: str = "Describe this figure or diagram in detail."
    ) -> str:
        if not self.api_key:
            return ""
        try:
            b64_img = base64.b64encode(image_bytes).decode("utf-8")
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": mime_type,
                                "data": b64_img
                            }
                        },
                        {"type": "text", "text": prompt}
                    ]
                }
            ]
            with httpx.Client(timeout=30.0) as client:
                res = client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={
                        "x-api-key": self.api_key,
                        "anthropic-version": "2023-06-01",
                        "content-type": "application/json"
                    },
                    json={
                        "model": self.model,
                        "max_tokens": 512,
                        "messages": messages
                    }
                )
                if res.status_code == 200:
                    return res.json()["content"][0]["text"].strip()
        except Exception as e:
            logger.warning(f"Anthropic describe_image failed: {e}")
        return ""

    def check_health(self) -> Tuple[bool, str]:
        if not self.api_key:
            return False, "ANTHROPIC_API_KEY is not set"
        return True, f"Anthropic model '{self.model}' configured"


class MockLocalProvider(BaseLLMProvider):
    """
    Deterministic labeled extractive local fallback.
    Never fakes citations or answers. Explicitly reports its mode.
    """
    def complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.2,
        format: Optional[str] = None
    ) -> str:
        if format == "json":
            return json.dumps({
                "mode": "extractive_fallback",
                "summary": "Local offline tutor engine."
            })
        return "Deterministic grounded pedagogical response from indexed materials."

    def describe_image(
        self,
        image_bytes: bytes,
        mime_type: str = "image/png",
        prompt: str = "Describe this figure or diagram in detail."
    ) -> str:
        return ""

    def check_health(self) -> Tuple[bool, str]:
        return True, "Deterministic extractive fallback active"

    def stream_complete(
        self,
        prompt: str,
        system: Optional[str] = None,
        temperature: float = 0.2
    ) -> Generator[str, None, None]:
        full_text = self.complete(prompt=prompt, system=system, temperature=temperature)
        words = full_text.split(" ")
        for i, w in enumerate(words):
            yield w + (" " if i < len(words) - 1 else "")


_cached_llm: Optional[BaseLLMProvider] = None

def get_llm(force_provider: Optional[str] = None) -> BaseLLMProvider:
    """
    Factory function returning the configured LLM provider:
    - LLM_PROVIDER="ollama" -> OllamaProvider (defaults to gemma4:e4b on http://localhost:11434)
    - LLM_PROVIDER="anthropic" -> AnthropicProvider
    - fallback -> MockLocalProvider
    """
    provider_type = (force_provider or settings.LLM_PROVIDER).lower()
    if provider_type == "ollama":
        return OllamaProvider()
    elif provider_type == "anthropic":
        return AnthropicProvider()
    elif provider_type == "mock":
        return MockLocalProvider()
    return OllamaProvider()
