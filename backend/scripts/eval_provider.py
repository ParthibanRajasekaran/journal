"""Owner-authorized real-provider evaluation of the meal fixture set.

Spends the owner's own provider credit, so it refuses to run unless all three are given:
  JOURNAL_EVAL_AUTHORIZED=1
  JOURNAL_EVAL_PROVIDER=<openai|anthropic|gemini>
  JOURNAL_EVAL_API_KEY=<key>
Optional: JOURNAL_EVAL_MODEL (default: the Settings default for that provider), JOURNAL_EVAL_LIMIT.

Writes docs/evals/<date>-<provider>.md with, per fixture: outcome, estimate versus reference,
error, and a correction-burden note. Never run by hooks, CI or make. Mocked results live in
tests/test_eval_meals_mock.py.

    cd backend && JOURNAL_EVAL_AUTHORIZED=1 JOURNAL_EVAL_PROVIDER=openai \
        JOURNAL_EVAL_API_KEY=... uv run python scripts/eval_provider.py
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai.estimate import Estimate, EstimateInvalid, Pending, ask_provider, parse_reply  # noqa: E402
from app.ai.providers import PROVIDERS, Provider, ProviderUnavailable  # noqa: E402
from app.config import Settings  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "backend" / "tests" / "evals" / "meals.jsonl"
REPORTS = ROOT / "docs" / "evals"


def require_env() -> tuple[Provider, str]:
    if os.environ.get("JOURNAL_EVAL_AUTHORIZED") != "1":
        sys.exit(
            "Refusing: set JOURNAL_EVAL_AUTHORIZED=1 only when the owner authorizes a paid run."
        )
    provider = os.environ.get("JOURNAL_EVAL_PROVIDER", "")
    key = os.environ.get("JOURNAL_EVAL_API_KEY", "")
    if provider not in PROVIDERS or not key:
        sys.exit(
            "Refusing: JOURNAL_EVAL_PROVIDER must be openai|anthropic|gemini and "
            "JOURNAL_EVAL_API_KEY must be set."
        )
    return cast(Provider, provider), key


def model_for(provider: Provider) -> str:
    override = os.environ.get("JOURNAL_EVAL_MODEL")
    if override:
        return override
    settings = Settings(_env_file=None)  # type: ignore[call-arg]
    return {
        "openai": settings.estimate_model_openai,
        "anthropic": settings.estimate_model_anthropic,
        "gemini": settings.estimate_model_gemini,
    }[provider]


def load_fixtures() -> list[dict[str, Any]]:
    text = FIXTURES.read_text(encoding="utf-8")
    rows = [json.loads(line) for line in text.splitlines() if line]
    limit = int(os.environ.get("JOURNAL_EVAL_LIMIT", str(len(rows))))
    return rows[:limit]


def pct_error(actual: float, reference: float) -> str:
    if reference == 0:
        return "0%" if actual == 0 else "n/a"
    return f"{(actual - reference) / reference * 100:+.0f}%"


def row_line(fixture: dict[str, Any], outcome: str, kcal: str, protein: str, burden: str) -> str:
    return (
        f"| {fixture['id']} | {fixture['category']} | {outcome} | {kcal} | {protein} | {burden} |"
    )


async def evaluate_one(
    http: httpx.AsyncClient, provider: Provider, model: str, key: str, fixture: dict[str, Any]
) -> tuple[str, bool | None]:
    """Returns the report line and whether it was within tolerance (None when not scored)."""
    expected = fixture.get("expected", {})
    try:
        text = await ask_provider(http, provider, model, key, fixture["input_text"])
        result = parse_reply(text)
    except ProviderUnavailable as exc:
        return row_line(fixture, f"provider error: {exc}", "", "", "retry later"), None
    except EstimateInvalid as exc:
        refusal_ok = bool(expected.get("refusal")) or fixture.get("mock_expect") == "refuse"
        burden = "expected" if refusal_ok else "unexpected: manual entry needed"
        return row_line(fixture, f"refused ({exc})", "", "", burden), None
    if isinstance(result, Pending):
        outcome = f"asked {len(result.questions)} question(s)"
        return row_line(fixture, outcome, "", "", "one answer round"), None
    if not isinstance(result, Estimate):  # pragma: no cover - parse_reply returns one of the two
        return row_line(fixture, "unknown result", "", "", "investigate"), None
    ref_kcal, ref_prot = expected.get("calories"), expected.get("protein_g")
    if ref_kcal is None or ref_prot is None:
        kcal = f"{result.calories:.0f} / n/a"
        protein = f"{result.protein_g:.0f} / n/a"
        return row_line(fixture, "estimated", kcal, protein, "review"), None
    tol = float(expected.get("tolerance_pct", 30)) / 100
    ok = abs(result.calories - ref_kcal) <= max(ref_kcal * tol, 2) and abs(
        result.protein_g - ref_prot
    ) <= max(ref_prot * tol, 2)
    kcal = f"{result.calories:.0f} / {ref_kcal} / {pct_error(result.calories, ref_kcal)}"
    protein = f"{result.protein_g:.0f} / {ref_prot} / {pct_error(result.protein_g, ref_prot)}"
    return row_line(fixture, "estimated", kcal, protein, "none" if ok else "edit totals"), ok


async def run() -> int:
    provider, key = require_env()
    model = model_for(provider)
    rows = load_fixtures()
    stamp = datetime.now(UTC)
    lines = [
        f"# Real-provider evaluation: {provider} ({model})",
        "",
        f"Run on {stamp.strftime('%Y-%m-%d %H:%M UTC')} against {len(rows)} fixtures from "
        "`backend/tests/evals/meals.jsonl`. Kind of evidence: real-provider run, text input only. "
        "Reference values are approximate and the set is small; this is a regression and sanity "
        "check, not an accuracy claim.",
        "",
        "| id | category | outcome | kcal (est / ref / err) | protein g (est / ref / err) "
        "| correction burden |",
        "|---|---|---|---|---|---|",
    ]
    within = scored = 0
    async with httpx.AsyncClient() as http:
        for fixture in rows:
            line, ok = await evaluate_one(http, provider, model, key, fixture)
            lines.append(line)
            if ok is not None:
                scored += 1
                within += int(ok)
    lines += ["", f"Within tolerance: {within} of {scored} scored fixtures."]
    REPORTS.mkdir(parents=True, exist_ok=True)
    out = REPORTS / f"{stamp.strftime('%Y-%m-%d')}-{provider}.md"
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)}; within tolerance {within}/{scored}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(run()))
