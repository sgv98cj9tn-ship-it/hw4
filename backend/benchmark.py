"""Measure the chat agent's speed and cost on a fixed set of questions.

Run from the backend folder:
    ../.venv/bin/python benchmark.py before    # or: after

Writes output/benchmark_<label>.json with, for each question: response time,
model calls, and tokens. Questions are asked as a guest on the home page, in
order; the last question repeats the first, to show the effect of caching.
"""

import asyncio
import json
import os
import sys
import time

from dotenv import load_dotenv

from db import PROJECT_DIR

# Bypass Portkey's response cache so every run measures real model calls.
os.environ["PORTKEY_FORCE_REFRESH"] = "1"

load_dotenv(PROJECT_DIR / ".env")
load_dotenv(PROJECT_DIR.parent / ".env")

from agent import run_agent_measured, model_name  # noqa: E402
from models import ChatDeps  # noqa: E402

QUESTIONS = [
    "What hoodies do you have?",
    "Do you have the Basic Hoodie Big Yale in medium?",
    "Anything for Saybrook?",
    "How much is the Yale Dad Crewneck?",
    "What are your store hours?",
    "What hoodies do you have?",  # repeat of the first question
]


async def main(label: str) -> None:
    rows = []
    for q in QUESTIONS:
        start = time.perf_counter()
        reply, usage = await run_agent_measured(q, ChatDeps(page_path="/"), [], audit_log=False)
        seconds = time.perf_counter() - start
        rows.append(
            {
                "question": q,
                "seconds": round(seconds, 2),
                "model_calls": usage["requests"],
                "input_tokens": usage["input_tokens"],
                "output_tokens": usage["output_tokens"],
                "cached": usage.get("cached", False),
                "reply_start": reply.reply[:90],
            }
        )
        print(f"{seconds:6.2f}s  calls={usage['requests']}  in={usage['input_tokens']:>6}  out={usage['output_tokens']:>5}  {q}")
    totals = {
        "seconds": round(sum(r["seconds"] for r in rows), 2),
        "model_calls": sum(r["model_calls"] for r in rows),
        "input_tokens": sum(r["input_tokens"] for r in rows),
        "output_tokens": sum(r["output_tokens"] for r in rows),
    }
    print("TOTAL", totals)
    out = PROJECT_DIR / "output" / f"benchmark_{label}.json"
    out.write_text(json.dumps({"label": label, "model": model_name(), "questions": rows, "totals": totals}, indent=2))
    print("saved", out.relative_to(PROJECT_DIR))


if __name__ == "__main__":
    asyncio.run(main(sys.argv[1] if len(sys.argv) > 1 else "run"))
