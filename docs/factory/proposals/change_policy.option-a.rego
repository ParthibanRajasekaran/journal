# PROPOSAL (option A, review R4). Not in force. The live policy is policy/agents/change_policy.rego,
# which is human-review-only. This file is for owner review and CODEOWNERS merge; it changes only the
# allowed roots (adds web/src/** and web/e2e/**) and tightens the protected globs.
# Which paths an automated agent (coding or orchestrator) may change (ADR-006, layer e).
# Human-review-only paths are denied to agents. Humans are governed by CODEOWNERS and
# branch protection, not by this file.
#
# Input:
# {
#   "actor":    {"type": "agent | human", "id": "..."},
#   "changes":  [{"path": "src/App.tsx", "op": "create | modify | delete"}],
#   "approvals": [{"type": "agent | human", "id": "..."}]
# }
package journal.agents.change

import rego.v1

default allow := false

actor_types := {"agent", "human"}

op_types := {"create", "modify", "delete"}

# Agents may write only under these roots. Anything else is denied.
allowed_globs := [
	"src/**",
	"backend/**",
	"tests/**",
	"docs/**",
	"web/src/**",
	"web/e2e/**",
]

# Human-review-only for agents, even where an allowed glob also matches.
protected_globs := [
	"policy/**",
	"docs/adr/**",
	"docs/prd.md",
	"evals/**",
	"**/auth/**",
	"**/authz/**",
	"src/services/biometricAuth.ts",
	".github/**",
	".env",
	".env*",
	"**/.env*",
	"factory/**",
	"web/android/**",
	"ios/**",
	"docs/factory/policy-exceptions.json",
	"**/package-lock.json",
	"**/*.lock",
	".claude/**",
	"CLAUDE.md",
	"AGENTS.md",
]

allow if {
	count(deny) == 0
}

# Shape checks: fail closed on any malformed input, for every actor.

deny contains "unknown_actor" if {
	not actor_types[input.actor.type]
}

deny contains "missing_changes" if {
	not is_array(input.changes)
}

deny contains "change_without_path" if {
	some c in input.changes
	not is_string(c.path)
}

deny contains "invalid_op" if {
	some c in input.changes
	not op_types[c.op]
}

deny contains "path_traversal_or_absolute" if {
	some c in input.changes
	is_string(c.path)
	contains(c.path, "..")
}

deny contains "path_traversal_or_absolute" if {
	some c in input.changes
	is_string(c.path)
	startswith(c.path, "/")
}

# Agent-specific rules

deny contains sprintf("protected_path:%s", [c.path]) if {
	input.actor.type == "agent"
	some c in input.changes
	is_string(c.path)
	path_matches(c.path, protected_globs)
}

deny contains sprintf("path_not_allowed:%s", [c.path]) if {
	input.actor.type == "agent"
	some c in input.changes
	is_string(c.path)
	not path_matches(c.path, allowed_globs)
}

# An agent may never approve a change, whoever made it.
deny contains "agent_approval_not_allowed" if {
	some a in input.approvals
	a.type == "agent"
}

path_matches(path, globs) if {
	some g in globs
	glob.match(g, ["/"], path)
}
