# Authorization for meal resources (ADR-006, layer a).
# Deny by default. Only the owner of a meal may act on it.
#
# Input, built by the API for every guarded route:
# {
#   "user":     {"id": "<internal user id>"},
#   "session":  {"active": true},                 # ADR-004 session family check
#   "action":   "create | read | update | delete | list",
#   "resource": {"type": "meal", "owner_id": "<owner of the row>"},
#   "query":    {"owner_id": "<filter the handler applies>"}   # list only
# }
package journal.authz.meals

import rego.v1

default allow := false

item_actions := {"create", "read", "update", "delete"}

# No admin or role bypass exists in the MVP. Add one only through a reviewed policy change.

allow if {
	input.user.id != ""
	input.session.active == true
	input.resource.type == "meal"
	item_actions[input.action]
	input.resource.owner_id == input.user.id
}

# A list is allowed only when the handler filters by the caller's own id.
allow if {
	input.user.id != ""
	input.session.active == true
	input.action == "list"
	input.query.owner_id == input.user.id
}
