"""Machine-validated ticket contract. A ticket that fails validation never reaches dispatch."""

from __future__ import annotations

import re

from factory.common import FactoryError, read_json

RISK_CLASSES = {"low", "medium", "high"}
REQUIRED = {
    "id": str,
    "title": str,
    "outcome": str,
    "risk_class": str,
    "allowed_paths": list,
    "acceptance": list,
    "verification": list,
    "budget_usd": (int, float),
    "max_repairs": int,
}
ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")


def load_ticket(path) -> dict:
    return read_json(path)


def validate_ticket(ticket: dict, project: dict, max_ticket_usd: float, max_repairs_limit: int) -> list[str]:
    errors: list[str] = []
    for key, kind in REQUIRED.items():
        if key not in ticket:
            errors.append(f"missing field: {key}")
        elif not isinstance(ticket[key], kind) or isinstance(ticket[key], bool):
            errors.append(f"field {key} has the wrong type")
    if errors:
        return errors
    if not ID_PATTERN.match(ticket["id"]):
        errors.append("id may contain letters, digits, dot, dash and underscore only")
    if ticket["risk_class"] not in RISK_CLASSES:
        errors.append(f"risk_class must be one of {sorted(RISK_CLASSES)}")
    if not ticket["allowed_paths"]:
        errors.append("allowed_paths must list at least one pattern")
    if not ticket["acceptance"]:
        errors.append("acceptance must list at least one criterion")
    acceptance_ids = []
    for item in ticket["acceptance"]:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str) or not isinstance(item.get("text"), str):
            errors.append("each acceptance entry needs string id and text")
        else:
            acceptance_ids.append(item["id"])
    if len(set(acceptance_ids)) != len(acceptance_ids):
        errors.append("acceptance ids must be unique")
    if not ticket["verification"]:
        errors.append("verification must name at least one gate")
    gates = project.get("gates", {})
    for gate in ticket["verification"]:
        if gate not in gates:
            errors.append(f"verification gate '{gate}' is not defined in the protected project file")
    if not 0 < ticket["budget_usd"] <= max_ticket_usd:
        errors.append(f"budget_usd must be above 0 and at most {max_ticket_usd}")
    if not 0 <= ticket["max_repairs"] <= max_repairs_limit:
        errors.append(f"max_repairs must be between 0 and {max_repairs_limit}")
    if ticket.get("base_commit") is not None and not isinstance(ticket["base_commit"], str):
        errors.append("base_commit must be a string when given")
    return errors


def require_valid(ticket: dict, project: dict, max_ticket_usd: float, max_repairs_limit: int) -> None:
    errors = validate_ticket(ticket, project, max_ticket_usd, max_repairs_limit)
    if errors:
        raise FactoryError("ticket is invalid: " + "; ".join(errors))
