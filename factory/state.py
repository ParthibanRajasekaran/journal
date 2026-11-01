"""Run state machine. Transitions are enforced here, not by convention."""

CREATED = "created"
PLANNED = "planned"
IMPLEMENTING = "implementing"
VERIFYING = "verifying"
READY = "ready"
BLOCKED = "blocked"
PAUSED = "paused"

STATES = {CREATED, PLANNED, IMPLEMENTING, VERIFYING, READY, BLOCKED, PAUSED}
TERMINAL = {READY, BLOCKED}

TRANSITIONS: dict[str, set[str]] = {
    CREATED: {PLANNED, BLOCKED},
    PLANNED: {IMPLEMENTING, VERIFYING, BLOCKED, PAUSED},
    IMPLEMENTING: {VERIFYING, BLOCKED, PAUSED},
    VERIFYING: {IMPLEMENTING, READY, BLOCKED, PAUSED},
    PAUSED: {PLANNED, IMPLEMENTING, VERIFYING, BLOCKED},
    READY: set(),
    BLOCKED: set(),
}


class IllegalTransition(Exception):
    pass


def check_transition(current: str, nxt: str) -> None:
    if nxt not in TRANSITIONS.get(current, set()):
        raise IllegalTransition(f"cannot move a run from {current} to {nxt}")
