"""The 20-meal evaluation set, run through the estimate validator with the fixtures' fake replies.

No provider is called. Each fixture says what the validator must do with its reply: accept, ask
questions, or refuse. Accepted fixtures also check the reply's totals against the reference values,
so a fixture cannot drift away from its own expectation. The real-provider run is a separate,
owner-authorized script (backend/scripts/eval_provider.py).
"""

import json
from pathlib import Path
from typing import Any

import pytest

from app.ai.estimate import Estimate, EstimateInvalid, Pending, parse_reply

FIXTURES = Path(__file__).parent / "evals" / "meals.jsonl"


def load() -> list[dict[str, Any]]:
    rows = [json.loads(line) for line in FIXTURES.read_text(encoding="utf-8").splitlines() if line]
    assert len(rows) == 20
    assert len({r["id"] for r in rows}) == 20
    return rows


def reply_text(row: dict[str, Any]) -> str:
    return (
        str(row["fake_reply_text"]) if "fake_reply_text" in row else json.dumps(row["fake_reply"])
    )


def outcome(text: str) -> str:
    try:
        result = parse_reply(text)
    except EstimateInvalid:
        return "refuse"
    if isinstance(result, Pending):
        return "questions"
    assert isinstance(result, Estimate)
    return "accept"


def _outcome_cases() -> list[Any]:
    cases: list[Any] = []
    for row in load():
        if row["id"] == "m18":
            # Hidden identity fields are not yet refused by parse_reply (Phase 0 follow-up);
            # strict xfail so the marker must be removed when the check lands.
            cases.append(
                pytest.param(
                    row,
                    id=row["id"],
                    marks=pytest.mark.xfail(
                        strict=True, reason="identity-field refusal pending in app/ai/estimate.py"
                    ),
                )
            )
        else:
            cases.append(pytest.param(row, id=row["id"]))
    return cases


@pytest.mark.eval
@pytest.mark.parametrize("row", _outcome_cases())
def test_validator_outcome_matches_fixture(row: dict[str, Any]) -> None:
    assert outcome(reply_text(row)) == row["mock_expect"], row.get("expected", {}).get("note", "")


@pytest.mark.eval
@pytest.mark.parametrize(
    "row", [r for r in load() if r["mock_expect"] == "accept"], ids=lambda r: str(r["id"])
)
def test_accepted_fixture_totals_match_reference(row: dict[str, Any]) -> None:
    estimate = parse_reply(reply_text(row))
    assert isinstance(estimate, Estimate)
    expected = row["expected"]
    tolerance = expected["tolerance_pct"] / 100
    for field in ("calories", "protein_g"):
        reference = float(expected[field])
        allowed = max(reference * tolerance, 2.0)
        assert abs(getattr(estimate, field) - reference) <= allowed, (field, reference, estimate)


@pytest.mark.eval
def test_categories_cover_the_spec() -> None:
    categories = {r["category"] for r in load()}
    assert {
        "simple",
        "mixed",
        "packaged",
        "ambiguous",
        "shake",
        "non_food",
        "malformed",
    } <= categories
