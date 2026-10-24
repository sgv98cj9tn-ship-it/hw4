"""Append-only audit trail of the agent loop: output/audit_trail.json.

Every chat turn adds one JSON object as a single line at the end of the file
(the JSON Lines format), so earlier entries are never rewritten, edited, or
deleted. Read it with: [json.loads(line) for line in open(path)].

Privacy: the file is public on GitHub, so it stores the user id only (never
names, emails, or passwords). Email addresses and long digit runs (card or
phone numbers) that shoppers type are masked, and tool results are shortened.
"""

import json
import re
import threading
from datetime import datetime, timezone
from typing import Any

from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    ThinkingPart,
    ToolCallPart,
    ToolReturnPart,
)

from db import PROJECT_DIR

AUDIT_PATH = PROJECT_DIR / "output" / "audit_trail.json"
PREVIEW_CHARS = 300  # tool results are cut to this length
TEXT_CHARS = 1000  # shopper messages and replies are cut to this length
THOUGHT_CHARS = 500  # each recorded thought is cut to this length
OUTPUT_TOOL = "final_result"  # PydanticAI's structured-output tool; recorded as the reply, not a tool call

_lock = threading.Lock()
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
_LONG_DIGITS = re.compile(r"\b(?:\d[ -]?){9,}\d\b")


def redact(text: str) -> str:
    """Mask emails and long digit runs (card, phone, or account numbers)."""
    text = _EMAIL.sub("[email removed]", text)
    return _LONG_DIGITS.sub("[number removed]", text)


def _short(value: Any, limit: int) -> str:
    if hasattr(value, "model_dump_json"):
        text = value.model_dump_json()
    elif isinstance(value, str):
        text = value
    else:
        text = json.dumps(value, default=str, ensure_ascii=False)
    text = redact(text)
    return text if len(text) <= limit else text[:limit] + "…"


def thoughts_from(messages: list[ModelMessage]) -> list[str]:
    """The model's reasoning summaries, plus any text it wrote alongside a tool call
    (e.g. "Let me check stock first"), in order. These show *why* it called each tool."""
    thoughts: list[str] = []
    for msg in messages:
        if not isinstance(msg, ModelResponse):
            continue
        calls_a_tool = any(isinstance(p, ToolCallPart) and p.tool_name != OUTPUT_TOOL for p in msg.parts)
        for part in msg.parts:
            if isinstance(part, ThinkingPart) and part.content.strip():
                thoughts.append(_short(part.content.strip(), THOUGHT_CHARS))
            elif isinstance(part, TextPart) and calls_a_tool and part.content.strip():
                thoughts.append(_short(part.content.strip(), THOUGHT_CHARS))
    return thoughts


def tool_calls_from(messages: list[ModelMessage]) -> list[dict]:
    """Pair each tool call in a run with its result, in the order they happened."""
    calls: dict[str, dict] = {}
    order: list[str] = []
    for msg in messages:
        if isinstance(msg, ModelResponse):
            for part in msg.parts:
                if isinstance(part, ToolCallPart) and part.tool_name != OUTPUT_TOOL:
                    calls[part.tool_call_id] = {
                        "tool": part.tool_name,
                        "inputs": part.args_as_dict(),
                        "result_preview": None,
                    }
                    order.append(part.tool_call_id)
        elif isinstance(msg, ModelRequest):
            for part in msg.parts:
                if isinstance(part, ToolReturnPart) and part.tool_call_id in calls:
                    calls[part.tool_call_id]["result_preview"] = _short(part.content, PREVIEW_CHARS)
    return [calls[i] for i in order]


def record(
    *,
    message: str,
    user_id: int | None,
    page_path: str,
    product_on_screen: str | None,
    history_messages: int,
    outcome: str,
    thoughts: list[str] | None = None,
    reply: str | None = None,
    product_ids: list[str] | None = None,
    show_on_page: bool | None = None,
    tool_calls: list[dict] | None = None,
    model: str | None = None,
    model_calls: int = 0,
    input_tokens: int = 0,
    output_tokens: int = 0,
    duration_ms: int = 0,
    error: str | None = None,
) -> None:
    """Append one agent-loop entry. Never raises: a logging problem must not break the chat."""
    entry = {
        "time": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "user_id": user_id,  # None for guests; never a name or email
        "page": page_path,
        "product_on_screen": product_on_screen,
        "message": _short(message, TEXT_CHARS),
        "history_messages": history_messages,
        "outcome": outcome,  # answered | cached | blocked_by_safety_filter | stopped_at_limit | error
        "thoughts": thoughts or [],
        "tool_calls": tool_calls or [],
        "reply": _short(reply, TEXT_CHARS) if reply is not None else None,
        "product_ids": product_ids or [],
        "show_on_page": show_on_page,
        "model": model,
        "model_calls": model_calls,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "duration_ms": duration_ms,
        "error": error,
    }
    try:
        line = json.dumps(entry, ensure_ascii=False)
        with _lock:
            AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
            with AUDIT_PATH.open("a", encoding="utf-8") as f:  # "a" = append only
                f.write(line + "\n")
    except OSError:
        pass
