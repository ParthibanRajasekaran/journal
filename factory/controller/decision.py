"""Turns evidence into a verdict. Pure function: the same evidence always gives the same verdict."""

from __future__ import annotations


def decide(evidence: dict, ticket: dict) -> tuple[str, list[str]]:
    """Returns ("ready" | "repair" | "block", reasons).

    - Scope violations and missing independent review block: no amount of repair fixes the process.
    - Failing gates, a requested change, or a review that skipped criteria send the run back for repair.
    - Ready requires every gate green, an approving independent review, and every acceptance id
      checked by the reviewer.
    """
    violations = evidence["scope"]["violations"]
    if violations:
        return "block", [f"scope: {v}" for v in violations]

    failing = [g["id"] for g in evidence["gates"] if not g["passed"]]
    review = evidence.get("review")
    reasons: list[str] = []
    if failing:
        reasons.append(f"gates failed: {', '.join(failing)}")

    if review is None or not review.get("ok", False):
        detail = review.get("detail") if review else "no review was dispatched"
        return "repair", reasons + [f"review did not complete: {detail}"]

    if not review.get("independent", False):
        return "block", ["independent review not performed: this adapter cannot provide an independent reviewer"]

    if review.get("decision") != "approve":
        findings = "; ".join(str(f.get("summary", f)) for f in review.get("findings", [])) or "no details given"
        return "repair", reasons + [f"reviewer requested changes: {findings}"]

    wanted = {a["id"] for a in ticket["acceptance"]}
    unchecked = sorted(wanted - set(review.get("checked_acceptance", [])))
    if unchecked:
        return "repair", reasons + [f"reviewer did not check acceptance: {', '.join(unchecked)}"]

    if reasons:
        return "repair", reasons
    return "ready", []
