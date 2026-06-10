"""
Tool Dispatcher — Routes parsed tool calls to execution backends.

Receives a validated tool call (from Adapter A or slash command) and
dispatches to the appropriate backend:

    search_jobs    → TS Backend → Elasticsearch
    match_jobs     → TS Backend → Adapter B analysis
    assess_resume  → Adapter B (hr-coach)
    interview_prep → Adapter C (structured-gen)
    general_response → Adapter B (hr-coach)
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from adapter_manager import AdapterManager
from adapter_prompts import ADAPTER_PROMPTS
from ts_search_client import TSSearchClient
from tool_schemas import ToolCallResult

logger = logging.getLogger(__name__)


class ToolDispatcher:
    """Dispatch validated tool calls to execution backends.

    Connects:
    - AdapterManager (Ollama inference for hr-coach + structured-gen)
    - TSSearchClient (TS backend proxy for ES search)
    """

    def __init__(
        self,
        adapter_mgr: AdapterManager,
        search_client: TSSearchClient,
    ):
        self.adapter_mgr = adapter_mgr
        self.search_client = search_client

    def dispatch(
        self,
        tool_call: dict,
        cv_json: Optional[dict] = None,
        session_context: Optional[dict] = None,
    ) -> dict:
        """Execute a tool call and return results.

        Args:
            tool_call: Parsed tool call dict: {"tool": "...", "params": {...}}.
                       Special tool "_route_via_adapter_a" triggers Adapter A
                       intent classification first.
            cv_json: User's CV JSON from session (if available).
            session_context: Additional session metadata.

        Returns:
            Dict with keys: "success" (bool), "response" (str),
            "tool" (str), "adapter" (str|None), "metadata" (dict).
        """
        tool = tool_call.get("tool", "general_response")
        params = tool_call.get("params", {})

        # Special case: route through Adapter A first
        if tool == "_route_via_adapter_a":
            return self._route_via_adapter_a(params, cv_json, session_context)

        logger.info(f"Dispatching tool: {tool} with params: {params}")

        try:
            # Validate
            tc = ToolCallResult(tool=tool, params=params)
            validated = tc.validated_params()

            handler = self._get_handler(tool)
            return handler(validated.model_dump(), cv_json, session_context)

        except Exception as e:
            logger.exception(f"Tool dispatch failed for '{tool}': {e}")
            return {
                "success": False,
                "response": f"❌ Lỗi khi xử lý lệnh: {e}",
                "tool": tool,
                "adapter": None,
                "metadata": {"error": str(e)},
            }

    def _route_via_adapter_a(
        self,
        params: dict,
        cv_json: Optional[dict],
        session_context: Optional[dict],
    ) -> dict:
        """Route message through Adapter A for intent classification.

        1. Send user message to the tool-call model
        2. Parse the JSON tool call output
        3. Re-dispatch to the actual tool handler
        """
        message = params.get("message", "")
        if not message and session_context:
            message = session_context.get("original_message", "")

        if not message:
            return {
                "success": False,
                "response": "❌ Không có tin nhắn để xử lý.",
                "tool": "general_response",
                "adapter": None,
                "metadata": {},
            }

        logger.info(f"Routing via Adapter A: '{message[:80]}...'")

        try:
            # Step 1: Adapter A produces JSON tool call
            actual_tool_call = self.adapter_mgr.infer_tool_call(message)
            logger.info(f"Adapter A routed to: {actual_tool_call.get('tool')}")

            # Step 2: Re-dispatch the actual tool call
            return self.dispatch(
                tool_call=actual_tool_call,
                cv_json=cv_json,
                session_context=session_context,
            )

        except (ValueError, RuntimeError) as e:
            # If Adapter A fails, fall back to general response
            logger.warning(f"Adapter A routing failed: {e}. Falling back to hr-coach.")
            return self._handle_general_response(
                params={},
                cv_json=cv_json,
                ctx=session_context,
            )

    def _get_handler(self, tool: str):
        """Get the handler function for a tool."""
        handlers = {
            "search_jobs": self._handle_search_jobs,
            "match_jobs": self._handle_match_jobs,
            "assess_resume": self._handle_assess_resume,
            "interview_prep": self._handle_interview_prep,
            "general_response": self._handle_general_response,
        }
        handler = handlers.get(tool)
        if not handler:
            raise ValueError(f"No handler for tool: '{tool}'")
        return handler

    # ── Tool Handlers ────────────────────────────────

    def _handle_search_jobs(
        self,
        params: dict,
        cv_json: Optional[dict],
        ctx: Optional[dict],
    ) -> dict:
        """search_jobs → TS Backend → Elasticsearch.

        Python sends params to TS backend, which runs helpers.ts
        and returns job listings from Elasticsearch.
        """
        try:
            results = self.search_client.search_jobs(params)
            jobs = results.get("jobs", [])
            total = results.get("total", 0)

            if not jobs:
                response = (
                    "🔍 **Không tìm thấy kết quả**\n\n"
                    "Thử mở rộng tiêu chí tìm kiếm:\n"
                    "- Bỏ bớt bộ lọc địa điểm hoặc mức lương\n"
                    "- Dùng từ khóa khác\n"
                    '- VD: `/search Backend Developer`'
                )
            else:
                response = self._format_search_results(jobs, total, params)

            return {
                "success": True,
                "response": response,
                "tool": "search_jobs",
                "adapter": None,  # No adapter needed, just ES
                "metadata": {
                    "total": total,
                    "returned": len(jobs),
                    "params": params,
                },
            }

        except RuntimeError as e:
            return {
                "success": False,
                "response": f"❌ Lỗi tìm kiếm: {e}",
                "tool": "search_jobs",
                "adapter": None,
                "metadata": {"error": str(e)},
            }

    def _handle_match_jobs(
        self,
        params: dict,
        cv_json: Optional[dict],
        ctx: Optional[dict],
    ) -> dict:
        """match_jobs → TS Backend + Adapter B for analysis.

        1. Search relevant jobs via TS backend
        2. Feed CV + job results to Adapter B for fit analysis
        """
        if not cv_json:
            return {
                "success": False,
                "response": (
                    "📎 **Cần tải lên CV trước!**\n\n"
                    "Vui lòng tải lên CV (PDF hoặc DOCX) trước khi dùng `/match`."
                ),
                "tool": "match_jobs",
                "adapter": None,
                "metadata": {},
            }

        # Step 1: Search for relevant jobs
        target_role = params.get("target_role", "")
        search_params = {"keyword": target_role} if target_role else {}

        try:
            search_results = self.search_client.search_jobs(search_params)
            jobs = search_results.get("jobs", [])[:5]  # Top 5 for analysis
        except RuntimeError:
            jobs = []

        # Step 2: Build prompt for Adapter B
        cv_summary = json.dumps(cv_json, ensure_ascii=False, indent=2)[:3000]
        jobs_summary = json.dumps(jobs, ensure_ascii=False, indent=2)[:2000]

        user_prompt = (
            f"Phân tích độ phù hợp của CV ứng viên với các vị trí sau.\n\n"
            f"=== CV ===\n{cv_summary}\n\n"
            f"=== VIỆC LÀM ===\n{jobs_summary}\n\n"
            f"Cho điểm phù hợp (0-100) cho mỗi vị trí, "
            f"liệt kê kỹ năng khớp và thiếu, đề xuất vị trí phù hợp nhất."
        )

        result = self.adapter_mgr.infer(
            system_prompt=ADAPTER_PROMPTS["hr_coach"],
            user_prompt=user_prompt,
            adapter_name="hr-coach",
        )

        return {
            "success": True,
            "response": result["raw"],
            "tool": "match_jobs",
            "adapter": "hr-coach",
            "metadata": {
                "jobs_searched": len(jobs),
                "latency_s": result.get("latency_s"),
            },
        }

    def _handle_assess_resume(
        self,
        params: dict,
        cv_json: Optional[dict],
        ctx: Optional[dict],
    ) -> dict:
        """assess_resume → Adapter B (hr-coach).

        Sends CV JSON to the coaching model for empathetic feedback.
        """
        if not cv_json:
            return {
                "success": False,
                "response": (
                    "📎 **Cần tải lên CV trước!**\n\n"
                    "Vui lòng tải lên CV trước khi yêu cầu đánh giá.\n"
                    "Nhấn nút **+** bên trái ô nhập tin nhắn."
                ),
                "tool": "assess_resume",
                "adapter": None,
                "metadata": {},
            }

        cv_text = json.dumps(cv_json, ensure_ascii=False, indent=2)[:4000]
        focus = params.get("focus_areas", [])
        focus_text = f"\nTập trung vào: {', '.join(focus)}" if focus else ""

        user_prompt = (
            f"Đánh giá chi tiết CV sau. Chỉ ra điểm mạnh, điểm yếu, "
            f"và viết lại các mô tả mơ hồ với số liệu cụ thể.{focus_text}\n\n"
            f"=== CV ===\n{cv_text}"
        )

        result = self.adapter_mgr.infer(
            system_prompt=ADAPTER_PROMPTS["hr_coach"],
            user_prompt=user_prompt,
            adapter_name="hr-coach",
        )

        return {
            "success": True,
            "response": result["raw"],
            "tool": "assess_resume",
            "adapter": "hr-coach",
            "metadata": {"latency_s": result.get("latency_s")},
        }

    def _handle_interview_prep(
        self,
        params: dict,
        cv_json: Optional[dict],
        ctx: Optional[dict],
    ) -> dict:
        """interview_prep → Adapter C (structured-gen).

        Generates either interview questions (Markdown nested lists with rubrics)
        or a study roadmap (Markdown tables with timeline).
        """
        generate_roadmap = params.get("generate_roadmap", False)
        target_role = params.get("target_role", "Software Engineer")

        if generate_roadmap:
            # Roadmap mode
            prompt_key = "structured_gen_roadmap"
            cv_text = json.dumps(cv_json, ensure_ascii=False, indent=2)[:3000] if cv_json else "Không có CV"
            user_prompt = (
                f"Tạo lộ trình học chi tiết cho vị trí: {target_role}\n\n"
                f"=== THÔNG TIN ỨNG VIÊN ===\n{cv_text}\n\n"
                f"Tạo Markdown table với timeline, tài liệu, và mức ưu tiên."
            )
        else:
            # Interview questions mode
            prompt_key = "structured_gen_interview"
            cv_text = json.dumps(cv_json, ensure_ascii=False, indent=2)[:3000] if cv_json else "Không có CV"
            user_prompt = (
                f"Tạo câu hỏi phỏng vấn kỹ thuật cho vị trí: {target_role}\n\n"
                f"=== CV ỨNG VIÊN ===\n{cv_text}\n\n"
                f"Tạo 3-5 câu hỏi kỹ thuật sát với dự án và tech stack, "
                f"kèm rubric chấm điểm 5 sao."
            )

        result = self.adapter_mgr.infer(
            system_prompt=ADAPTER_PROMPTS[prompt_key],
            user_prompt=user_prompt,
            adapter_name="structured-gen",
        )

        return {
            "success": True,
            "response": result["raw"],
            "tool": "interview_prep",
            "adapter": "structured-gen",
            "metadata": {
                "mode": "roadmap" if generate_roadmap else "interview",
                "target_role": target_role,
                "latency_s": result.get("latency_s"),
            },
        }

    def _handle_general_response(
        self,
        params: dict,
        cv_json: Optional[dict],
        ctx: Optional[dict],
    ) -> dict:
        """general_response → Adapter B (hr-coach) for conversation.

        Default mode: empathetic career coaching in Vietnamese.
        """
        # Extract original user message from context
        user_msg = ""
        if ctx and "original_message" in ctx:
            user_msg = ctx["original_message"]
        elif ctx and "message" in ctx:
            user_msg = ctx["message"]
        else:
            user_msg = "Xin chào! Bạn cần tư vấn gì?"

        result = self.adapter_mgr.infer(
            system_prompt=ADAPTER_PROMPTS["hr_coach"],
            user_prompt=user_msg,
            adapter_name="hr-coach",
        )

        return {
            "success": True,
            "response": result["raw"],
            "tool": "general_response",
            "adapter": "hr-coach",
            "metadata": {"latency_s": result.get("latency_s")},
        }

    # ── Formatting Helpers ───────────────────────────

    @staticmethod
    def _format_search_results(jobs: list, total: int, params: dict) -> str:
        """Format ES job results as conversational Vietnamese markdown."""
        keyword = params.get("keyword", "")
        location = params.get("location", "")

        header_parts = ["## 🔍 Kết quả tìm kiếm"]
        if keyword:
            header_parts.append(f'"{keyword}"')
        if location:
            header_parts.append(f"tại {location}")
        header = " ".join(header_parts)

        lines = [
            f"{header}\n",
            f"_Tìm thấy **{total}** vị trí._\n",
        ]

        for i, job in enumerate(jobs[:10], 1):
            title = job.get("tieu_de", job.get("title", "Không rõ"))
            company = job.get("cong_ty", job.get("company", ""))
            location_str = job.get("dia_diem", job.get("location", ""))
            salary = job.get("muc_luong", job.get("salary", ""))
            link = job.get("url", job.get("link", ""))

            lines.append(f"### {i}. {title}")
            if company:
                lines.append(f"🏢 **{company}**")
            details = []
            if location_str:
                details.append(f"📍 {location_str}")
            if salary:
                details.append(f"💰 {salary}")
            if details:
                lines.append(" | ".join(details))
            if link:
                lines.append(f"🔗 [Xem chi tiết]({link})")
            lines.append("")

        if total > 10:
            lines.append(
                f"_...và {total - 10} vị trí khác. "
                f"Dùng bộ lọc để thu hẹp kết quả._"
            )

        return "\n".join(lines)
