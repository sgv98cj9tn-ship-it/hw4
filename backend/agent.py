"""The Campus Customs shopping agent (PydanticAI, routed through Portkey).

main.py calls `run_agent(message, deps, history)` for each chat message.
`deps` (a ChatDeps) tells the agent who is chatting and which page they're on;
`history` is the recent conversation so follow-up questions make sense.
"""

import os
import time

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from openai import AsyncOpenAI
from pydantic_ai import Agent, RunContext, UsageLimits
from pydantic_ai.exceptions import ModelHTTPError, UsageLimitExceeded
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, UserPromptPart
from pydantic_ai.models.openai import OpenAIResponsesModel, OpenAIResponsesModelSettings
from pydantic_ai.providers.openai import OpenAIProvider

import audit
from db import BACKEND_DIR
from models import AgentReply, ChatDeps, HistoryMessage
from tools import TOOLS

PROMPT_PATH = BACKEND_DIR / "prompts" / "prompt.md"
PORTKEY_BASE_URL = "https://api.portkey.ai/v1"
DEFAULT_MODEL = "gpt-5.6-luna"
REQUEST_LIMIT = 6  # max model calls per message, so a confused agent can't loop forever
# Shopping answers don't need deep reasoning; "low" makes replies faster and uses fewer tokens.
REASONING_EFFORT = os.getenv("OPENAI_REASONING_EFFORT", "low")
ANSWER_CACHE_SECONDS = 600  # repeat guest questions within 10 minutes reuse the answer
ANSWER_CACHE_MAX = 500


class AgentConfigError(RuntimeError):
    """The agent can't run because configuration (like the API key) is missing."""


def model_name() -> str:
    return os.getenv("OPENAI_MODEL", DEFAULT_MODEL)


def session_context(ctx: RunContext[ChatDeps]) -> str:
    """Instructions built fresh from the deps on every run: who is chatting and what's on their screen."""
    deps = ctx.deps
    lines = ["## This conversation"]
    if deps.customer:
        c = deps.customer
        lines.append(
            f"- The shopper is logged in as {c.first_name} {c.last_name} ({c.email}). "
            f"You may greet them by first name. Only mention their email if they ask what account they're using."
        )
    else:
        lines.append("- The shopper is a guest (not logged in). You don't know their name.")
    lines.append(f"- They are on the page `{deps.page_path}`.")
    if deps.current_product:
        p = deps.current_product
        lines.append(
            f"- The product open on their screen is **{p.name}** (product_id `{p.product_id}`, "
            f"{p.garment_type}, ${p.price:g}, colors: {', '.join(p.colors) or 'not listed'}). "
            "When they say \"this\", \"it\", or \"this one\" without naming another item, they mean this product. "
            "Still call `get_product_details` or `check_stock` with this product_id for stock and details."
        )
    else:
        lines.append("- No single product is open on their screen.")
    return "\n".join(lines)


def _build_agent() -> tuple[Agent[ChatDeps, AgentReply], AsyncOpenAI]:
    key = os.getenv("PORTKEY_API_KEY")
    if not key:
        raise AgentConfigError("PORTKEY_API_KEY is missing. Add it to .env.")
    # A fresh client per run: its HTTP connection pool belongs to the event loop that uses it.
    client = AsyncOpenAI(
        api_key="portkey",
        base_url=PORTKEY_BASE_URL,
        default_headers={
            "x-portkey-api-key": key,
            "x-portkey-provider": "openai",
            # The benchmark sets this so Portkey's own response cache doesn't hide real timings.
            **({"x-portkey-cache-force-refresh": "true"} if os.getenv("PORTKEY_FORCE_REFRESH") == "1" else {}),
        },
    )
    model = OpenAIResponsesModel(model_name(), provider=OpenAIProvider(openai_client=client))
    agent = Agent(
        model,
        # Read on every run, so edits to prompt.md take effect without a restart.
        instructions=[PROMPT_PATH.read_text(encoding="utf-8"), session_context],
        deps_type=ChatDeps,
        output_type=AgentReply,
        tools=TOOLS,
        retries=2,
        model_settings=OpenAIResponsesModelSettings(
            openai_reasoning_effort=REASONING_EFFORT,
            # Short summaries of the model's reasoning, recorded as "thoughts" in the audit trail.
            openai_reasoning_summary="concise",
        ),
    )
    return agent, client


# Stopping rule: if the agent hasn't finished within REQUEST_LIMIT model calls, the run is
# cut off and the shopper gets this instead of an error.
LIMIT_REPLY = AgentReply(
    reply=(
        "Woof, that one has me chasing my tail! Could you ask it a simpler way, "
        "like naming one product or one size?"
    )
)

FILTERED_REPLY = AgentReply(
    reply=(
        "Woof, sorry, I can't help with that. I'm Handsome Dan, the Campus Customs helper, "
        "so ask me about Yale gear, prices, or the store!"
    )
)


def to_model_messages(history: list[HistoryMessage]) -> list[ModelMessage]:
    """Turn saved chat text into PydanticAI message history (oldest first)."""
    messages: list[ModelMessage] = []
    for m in history:
        if m.role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=m.content)]))
        elif messages:  # history must start with a user message
            messages.append(ModelResponse(parts=[TextPart(content=m.content)]))
    return messages


# Answer cache for "fresh" guest questions: same words, same page, no earlier conversation.
# Logged-in shoppers and follow-up questions always get a new answer, since they depend on context.
_answer_cache: dict[tuple, tuple[float, AgentReply]] = {}


def _answer_cache_key(message: str, deps: ChatDeps, history: list[HistoryMessage] | None) -> tuple | None:
    if deps.customer is not None or history:
        return None
    product = deps.current_product.product_id if deps.current_product else None
    return (" ".join(message.lower().split()), deps.page_path, product)


async def run_agent_measured(
    message: str,
    deps: ChatDeps,
    history: list[HistoryMessage] | None = None,
    *,
    audit_log: bool = True,
) -> tuple[AgentReply, dict]:
    """Run the agent and also return usage: model calls (requests) and tokens.
    Every run is recorded in output/audit_trail.json unless audit_log is False (the benchmark)."""
    started = time.perf_counter()
    context = {
        "message": message,
        "user_id": deps.customer.user_id if deps.customer else None,
        "page_path": deps.page_path,
        "product_on_screen": deps.current_product.product_id if deps.current_product else None,
        "history_messages": len(history or []),
    }

    def log(**fields) -> None:
        if audit_log:
            audit.record(**context, duration_ms=round((time.perf_counter() - started) * 1000), **fields)

    key = _answer_cache_key(message, deps, history)
    if key is not None:
        hit = _answer_cache.get(key)
        if hit and time.monotonic() - hit[0] < ANSWER_CACHE_SECONDS:
            reply = hit[1]
            log(outcome="cached", reply=reply.reply, product_ids=reply.product_ids, show_on_page=reply.show_on_page)
            return reply, {"requests": 0, "input_tokens": 0, "output_tokens": 0, "cached": True}

    agent, client = _build_agent()
    try:
        result = await agent.run(
            message,
            deps=deps,
            message_history=to_model_messages(history or []),
            usage_limits=UsageLimits(request_limit=REQUEST_LIMIT),
        )
    except UsageLimitExceeded:
        log(outcome="stopped_at_limit", reply=LIMIT_REPLY.reply, model=model_name(), model_calls=REQUEST_LIMIT)
        return LIMIT_REPLY, {"requests": REQUEST_LIMIT, "input_tokens": 0, "output_tokens": 0}
    except ModelHTTPError as e:
        # The model provider's safety filter blocked the message (e.g. a jailbreak attempt).
        if e.status_code == 400 and "content_filter" in str(e.body):
            log(outcome="blocked_by_safety_filter", reply=FILTERED_REPLY.reply, model=model_name(), model_calls=1)
            return FILTERED_REPLY, {"requests": 1, "input_tokens": 0, "output_tokens": 0}
        log(outcome="error", model=model_name(), error=f"ModelHTTPError {e.status_code}")
        raise
    except Exception as e:
        log(outcome="error", model=model_name(), error=type(e).__name__)
        raise
    finally:
        await client.close()  # release this run's HTTP connections
    usage = result.usage
    output = result.output
    log(
        outcome="answered",
        reply=output.reply,
        product_ids=output.product_ids,
        show_on_page=output.show_on_page,
        thoughts=audit.thoughts_from(result.all_messages()),
        tool_calls=audit.tool_calls_from(result.all_messages()),
        model=model_name(),
        model_calls=usage.requests,
        input_tokens=usage.input_tokens,
        output_tokens=usage.output_tokens,
    )
    if key is not None:
        if len(_answer_cache) >= ANSWER_CACHE_MAX:
            _answer_cache.pop(next(iter(_answer_cache)))  # drop the oldest entry
        _answer_cache[key] = (time.monotonic(), output)
    return output, {
        "requests": usage.requests,
        "input_tokens": usage.input_tokens,
        "output_tokens": usage.output_tokens,
    }


async def run_agent(message: str, deps: ChatDeps, history: list[HistoryMessage] | None = None) -> AgentReply:
    reply, _ = await run_agent_measured(message, deps, history)
    return reply
