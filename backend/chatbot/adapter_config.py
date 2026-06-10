"""
Adapter Configuration — Central config for the 3-model Ollama system.

Each adapter is a fully merged Qwen2.5-1.5B model served by Ollama
as a separate model. No PEFT runtime swapping — Python selects which
Ollama model name to call.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field


# ── Ollama Model Names ───────────────────────────────
# These correspond to merged GGUF models registered in Ollama.
# Build with: ollama create <name> -f Modelfile.<name>

DEFAULT_OLLAMA_URL = "http://localhost:11434/v1"

ADAPTER_MODELS = {
    "tool-call": os.environ.get("MODEL_TOOL_CALL", "careerintel-tool-call"),
    "hr-coach": os.environ.get("MODEL_HR_COACH", "careerintel-hr-coach"),
    "structured-gen": os.environ.get("MODEL_STRUCTURED_GEN", "careerintel-structured-gen"),
}

# Default adapter when no slash command is detected and Adapter A
# routes to general_response
DEFAULT_ADAPTER = "hr-coach"


@dataclass
class AdapterInfo:
    """Metadata for a single merged Ollama model.

    Attributes:
        name: Adapter identifier (e.g. "tool-call").
        model: Ollama model name (e.g. "careerintel-tool-call").
        description: Human-readable description.
        system_prompt_key: Key into ADAPTER_PROMPTS dict.
    """

    name: str
    model: str
    description: str = ""
    system_prompt_key: str = ""


@dataclass
class AdapterConfig:
    """Configuration for the adapter manager.

    Attributes:
        ollama_url: Ollama API base URL (OpenAI-compatible).
        adapters: Dict of adapter name → AdapterInfo.
        default_adapter: Default adapter for general conversation.
        max_new_tokens: Default max generation tokens.
        temperature: Default sampling temperature.
        top_p: Default nucleus sampling p.
        ts_backend_url: Next.js TS backend URL for internal search.
        request_timeout: HTTP request timeout in seconds.
    """

    ollama_url: str = DEFAULT_OLLAMA_URL
    adapters: dict[str, AdapterInfo] = field(default_factory=dict)
    default_adapter: str = DEFAULT_ADAPTER
    max_new_tokens: int = 2048
    temperature: float = 0.3
    top_p: float = 0.9
    ts_backend_url: str = "http://localhost:3000"
    request_timeout: int = 120

    def __post_init__(self):
        if not self.adapters:
            self.adapters = _default_adapters()

    def get_model(self, adapter_name: str) -> str:
        """Get Ollama model name for an adapter.

        Args:
            adapter_name: One of 'tool-call', 'hr-coach', 'structured-gen'.

        Returns:
            Ollama model name string.

        Raises:
            KeyError: If adapter name is unknown.
        """
        if adapter_name not in self.adapters:
            raise KeyError(
                f"Unknown adapter: '{adapter_name}'. "
                f"Valid: {list(self.adapters.keys())}"
            )
        return self.adapters[adapter_name].model


def _default_adapters() -> dict[str, AdapterInfo]:
    """Build default adapter registry from env vars / defaults."""
    return {
        "tool-call": AdapterInfo(
            name="tool-call",
            model=ADAPTER_MODELS["tool-call"],
            description="Parse natural language → strict JSON tool call",
            system_prompt_key="tool_call",
        ),
        "hr-coach": AdapterInfo(
            name="hr-coach",
            model=ADAPTER_MODELS["hr-coach"],
            description="CV feedback in empathetic Vietnamese (DPO + SFT)",
            system_prompt_key="hr_coach",
        ),
        "structured-gen": AdapterInfo(
            name="structured-gen",
            model=ADAPTER_MODELS["structured-gen"],
            description="Generate Markdown tables, rubrics, study plans",
            system_prompt_key="structured_gen",
        ),
    }


def load_config() -> AdapterConfig:
    """Load adapter config with env var overrides."""
    return AdapterConfig(
        ollama_url=os.environ.get("OLLAMA_URL", DEFAULT_OLLAMA_URL),
        temperature=float(os.environ.get("SLM_TEMPERATURE", "0.3")),
        max_new_tokens=int(os.environ.get("SLM_MAX_TOKENS", "2048")),
        ts_backend_url=os.environ.get("TS_BACKEND_URL", "http://localhost:3000"),
        request_timeout=int(os.environ.get("SLM_TIMEOUT", "120")),
    )
