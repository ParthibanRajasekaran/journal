"""Repository-local AI software factory for Journal.

The controller owns state, budgets, scope, gates and evidence. Claude Code is one adapter behind
it; a dry-run adapter exercises the same paths without model calls.
"""

__version__ = "0.1.0"
