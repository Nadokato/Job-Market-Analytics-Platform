"""
Adapter Manager — Ollama multi-model inference client.

Manages 3 merged Qwen2.5-1.5B Ollama models. Each "adapter" is a
fully merged model served by Ollama under a different model name.
Adapter swapping = changing the model name in the API call.

Fails hard if Ollama or any required model is unavailable.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Optional

import requests

from adapter_config import AdapterConfig, load_config
from adapter_prompts import ADAPTER_PROMPTS

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BASE_DELAY = 1.0


class AdapterManager:
    """Ollama-backed multi-model inference manager.

    Each adapter corresponds to a separate merged Ollama model.
    Selecting an adapter = picking the correct model name for the
    OpenAI-compatible API call.

    This class fails hard if Ollama or the requested model is not
    available — no fallback to a different model.
    """

    _instance: Optional[AdapterManager] = None

    def __init__(self, config: Optional[AdapterConfig] = None):
        self.config = config or load_config()
        self._session = requests.Session()
        self._verified_models: set[str] = set()

    @classmethod
    def get_instance(cls, config: Optional[AdapterConfig] = None) -> AdapterManager:
        """Get or create singleton instance."""
        if cls._instance is None:
            cls._instance = cls(config)
        return cls._instance

    def verify_models(self) -> dict[str, bool]:
        """Verify all required Ollama models are available.

        Returns:
            Dict mapping adapter name → availability.

        Raises:
            RuntimeError: If any model is not available.
        """
        results = {}
        url = f"{self.config.ollama_url}/models"

        try:
            resp = self._session.get(url, timeout=10)
            if resp.status_code != 200:
                raise RuntimeError(
                    f"Cannot connect to Ollama at {self.config.ollama_url}. "
                    f"Status: {resp.status_code}"
                )

            available = resp.json()
            available_ids = set()
            for m in available.get("data", []):
                model_id = m.get("id", "")
                available_ids.add(model_id)
                # Ollama also returns model names with :latest suffix
                if ":" in model_id:
                    available_ids.add(model_id.split(":")[0])

            missing = []
            for name, info in self.config.adapters.items():
                is_available = (
                    info.model in available_ids
                    or f"{info.model}:latest" in available_ids
                )
                results[name] = is_available
                if is_available:
                    self._verified_models.add(name)
                else:
                    missing.append(f"{name} ({info.model})")

            if missing:
                raise RuntimeError(
                    f"Missing Ollama models: {', '.join(missing)}. "
                    f"Available: {sorted(available_ids)}. "
                    f"Create with: ollama create <model-name> -f Modelfile"
                )

            logger.info(f"All adapter models verified: {list(results.keys())}")
            return results

        except requests.exceptions.ConnectionError as e:
            raise RuntimeError(
                f"Cannot connect to Ollama at {self.config.ollama_url}. "
                "Is Ollama running? Start with: ollama serve"
            ) from e

    def infer(
        self,
        system_prompt: str,
        user_prompt: str,
        adapter_name: str,
        max_new_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
        json_mode: bool = False,
    ) -> dict:
        """Run inference using a specific adapter (Ollama model).

        Args:
            system_prompt: System message for the model.
            user_prompt: User message (the main prompt).
            adapter_name: One of 'tool-call', 'hr-coach', 'structured-gen'.
            max_new_tokens: Override default max tokens.
            temperature: Override default temperature.
            json_mode: If True, request JSON output format.

        Returns:
            Dict with keys: "content" (str or parsed dict), "raw" (str),
            "usage" (dict), "latency_s" (float), "adapter" (str), "model" (str).

        Raises:
            RuntimeError: If model is unavailable or inference fails.
        """
        model = self.config.get_model(adapter_name)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        payload = {
            "model": model,
            "messages": messages,
            "temperature": temperature or self.config.temperature,
            "max_tokens": max_new_tokens or self.config.max_new_tokens,
            "stream": False,
            "options": {"num_ctx": 4096},
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        url = f"{self.config.ollama_url}/chat/completions"

        for attempt in range(MAX_RETRIES):
            try:
                t0 = time.time()
                resp = self._session.post(
                    url,
                    json=payload,
                    timeout=self.config.request_timeout,
                )

                if resp.status_code != 200:
                    logger.warning(
                        f"Ollama error (attempt {attempt + 1}, adapter={adapter_name}): "
                        f"{resp.status_code} {resp.text[:200]}"
                    )
                    if attempt < MAX_RETRIES - 1:
                        time.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                        continue
                    raise RuntimeError(
                        f"Ollama API failed for adapter '{adapter_name}' "
                        f"(model={model}): {resp.status_code} {resp.text[:200]}"
                    )

                latency = time.time() - t0
                data = resp.json()
                raw_content = data["choices"][0]["message"]["content"]
                usage = data.get("usage", {})

                # Parse JSON if json_mode
                content = raw_content
                if json_mode:
                    try:
                        content = json.loads(raw_content)
                    except json.JSONDecodeError:
                        content = self._extract_json(raw_content)

                logger.info(
                    f"Adapter '{adapter_name}' (model={model}): "
                    f"{len(raw_content)} chars, {latency:.1f}s, "
                    f"tokens={usage.get('total_tokens', '?')}"
                )

                return {
                    "content": content,
                    "raw": raw_content,
                    "usage": usage,
                    "latency_s": round(latency, 2),
                    "adapter": adapter_name,
                    "model": model,
                }

            except requests.exceptions.ConnectionError as e:
                logger.error(
                    f"Cannot connect to Ollama for adapter '{adapter_name}'. "
                    f"Error: {e}"
                )
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                    continue
                raise RuntimeError(
                    f"Cannot connect to Ollama at {url}. "
                    "Is Ollama running? Start with: ollama serve"
                ) from e

            except requests.exceptions.Timeout:
                logger.warning(
                    f"Ollama timeout for adapter '{adapter_name}' "
                    f"(attempt {attempt + 1})"
                )
                if attempt < MAX_RETRIES - 1:
                    time.sleep(RETRY_BASE_DELAY * (2 ** attempt))
                    continue
                raise RuntimeError(
                    f"Ollama request timed out for adapter '{adapter_name}' "
                    f"after {MAX_RETRIES} attempts"
                )

    def infer_tool_call(self, user_message: str) -> dict:
        """Convenience: Route through Adapter A (tool-call) for intent detection.

        Args:
            user_message: Raw user message.

        Returns:
            Parsed tool call dict: {"tool": "...", "params": {...}}.

        Raises:
            RuntimeError: If inference fails.
            ValueError: If output is not valid JSON tool call.
        """
        result = self.infer(
            system_prompt=ADAPTER_PROMPTS["tool_call"],
            user_prompt=user_message,
            adapter_name="tool-call",
            json_mode=True,
        )

        content = result["content"]
        if isinstance(content, dict) and "tool" in content:
            return content

        # Try to parse from raw string
        if isinstance(content, str):
            try:
                parsed = json.loads(content)
                if "tool" in parsed:
                    return parsed
            except json.JSONDecodeError:
                pass

        raise ValueError(
            f"Adapter A did not produce valid tool call JSON. "
            f"Output: {result['raw'][:200]}"
        )

    def check_health(self) -> dict:
        """Check if Ollama and all models are reachable.

        Returns:
            Dict with health status per adapter model.
        """
        try:
            models = self.verify_models()
            return {
                "ollama_available": True,
                "ollama_url": self.config.ollama_url,
                "models": models,
            }
        except RuntimeError as e:
            return {
                "ollama_available": False,
                "ollama_url": self.config.ollama_url,
                "error": str(e),
            }

    @staticmethod
    def _extract_json(text: str) -> dict:
        """Try to extract JSON from text with markdown fences or mixed content."""
        import re

        # Try ```json ... ``` blocks
        match = re.search(r"```(?:json)?\s*\n(.*?)\n```", text, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

        # Try to find first JSON object
        for start in range(len(text)):
            if text[start] == "{":
                brace_count = 0
                for end in range(start, len(text)):
                    if text[end] == "{":
                        brace_count += 1
                    elif text[end] == "}":
                        brace_count -= 1
                    if brace_count == 0:
                        try:
                            return json.loads(text[start:end + 1])
                        except json.JSONDecodeError:
                            break
                break

        logger.warning("Could not parse JSON from model output")
        return {"raw_text": text}


def get_adapter_manager(config: Optional[AdapterConfig] = None) -> AdapterManager:
    """Module-level convenience to get the singleton AdapterManager."""
    return AdapterManager.get_instance(config)
