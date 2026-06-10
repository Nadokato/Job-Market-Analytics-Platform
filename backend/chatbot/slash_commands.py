"""
Slash Command Parser — Intercepts /commands and routes directly to adapters.

Supported commands:
    /search <query>      → Adapter A (tool-call) → search_jobs
    /match <args>        → Adapter A (tool-call) → match_jobs
    /interview [role]    → Adapter C (structured-gen) → interview questions
    /roadmap [role]      → Adapter C (structured-gen) → study roadmap
    /coach               → Adapter B (hr-coach) → CV assessment
    /review              → Adapter B (hr-coach) → CV review

No slash → default to Adapter A for intent classification, then
           Adapter B (hr-coach) for general conversation.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class SlashCommandResult:
    """Parsed slash command.

    Attributes:
        command: The slash command name (e.g. "/search").
        adapter: Target adapter name (e.g. "tool-call").
        tool: Tool name to force (e.g. "search_jobs").
        args: Remaining text after the command.
        params: Pre-built tool params (for commands with known mappings).
        description: Human-readable description for help text.
    """

    command: str = ""
    adapter: str = ""
    tool: str = ""
    args: str = ""
    params: dict = field(default_factory=dict)
    description: str = ""


# ── Command Registry ─────────────────────────────────

SLASH_COMMANDS: dict[str, dict] = {
    "/search": {
        "adapter": "tool-call",
        "tool": "search_jobs",
        "description": "🔍 Tìm kiếm việc làm — VD: /search Backend Developer Hà Nội",
    },
    "/match": {
        "adapter": "tool-call",
        "tool": "match_jobs",
        "description": "🎯 So khớp CV với JD — VD: /match Frontend React",
    },
    "/interview": {
        "adapter": "structured-gen",
        "tool": "interview_prep",
        "description": "🎤 Tạo câu hỏi phỏng vấn — VD: /interview Backend Developer",
    },
    "/roadmap": {
        "adapter": "structured-gen",
        "tool": "interview_prep",
        "description": "🗺️ Lộ trình học tập — VD: /roadmap Data Engineer",
    },
    "/coach": {
        "adapter": "hr-coach",
        "tool": "assess_resume",
        "description": "💼 Đánh giá và coaching CV",
    },
    "/review": {
        "adapter": "hr-coach",
        "tool": "assess_resume",
        "description": "📝 Nhận xét chi tiết CV",
    },
}

# Pattern: /command followed by optional whitespace + args
_SLASH_PATTERN = re.compile(r"^(/\w+)\s*(.*)", re.DOTALL)


class SlashCommandParser:
    """Parse user messages for slash commands.

    Usage:
        parser = SlashCommandParser()
        result = parser.parse("/search Backend Developer Hà Nội")
        if result:
            print(result.adapter)  # "tool-call"
            print(result.tool)     # "search_jobs"
            print(result.args)     # "Backend Developer Hà Nội"
    """

    def parse(self, message: str) -> Optional[SlashCommandResult]:
        """Parse a slash command from a user message.

        Args:
            message: Raw user message text.

        Returns:
            SlashCommandResult if a valid command was found, None otherwise.
        """
        message = message.strip()
        if not message.startswith("/"):
            return None

        match = _SLASH_PATTERN.match(message)
        if not match:
            return None

        command = match.group(1).lower()
        args = match.group(2).strip()

        if command not in SLASH_COMMANDS:
            return None

        cmd_info = SLASH_COMMANDS[command]

        # Build pre-parsed params for known command patterns
        params = self._build_params(command, args)

        return SlashCommandResult(
            command=command,
            adapter=cmd_info["adapter"],
            tool=cmd_info["tool"],
            args=args,
            params=params,
            description=cmd_info["description"],
        )

    def _build_params(self, command: str, args: str) -> dict:
        """Build tool params from slash command args.

        For /search and /match, the args are passed as the full
        user query to Adapter A for JSON extraction.
        For /interview and /roadmap, the args become target_role.
        For /coach and /review, no extra params needed.
        """
        if command == "/search":
            # Args are the search query — Adapter A will extract params
            return {"keyword": args} if args else {}

        elif command == "/match":
            # Args become target_role
            return {"target_role": args} if args else {}

        elif command == "/interview":
            return {
                "target_role": args or "Software Engineer",
                "generate_roadmap": False,
            }

        elif command == "/roadmap":
            return {
                "target_role": args or "Software Engineer",
                "generate_roadmap": True,
            }

        elif command in ("/coach", "/review"):
            return {"focus_areas": []}

        return {}

    @staticmethod
    def is_slash_command(message: str) -> bool:
        """Quick check if message starts with a known slash command."""
        if not message or not message.strip().startswith("/"):
            return False
        first_word = message.strip().split()[0].lower()
        return first_word in SLASH_COMMANDS

    @staticmethod
    def get_help_text() -> str:
        """Generate help text listing all available commands."""
        lines = ["## 📋 Các lệnh có sẵn\n"]
        for cmd, info in SLASH_COMMANDS.items():
            lines.append(f"- **`{cmd}`** — {info['description']}")
        lines.append(
            "\n_Gõ lệnh bất kỳ hoặc chat bình thường để được tư vấn nghề nghiệp._"
        )
        return "\n".join(lines)
