# Provider consent gate (ADR-006, layer d; PRD FR-7 and section 4 item 9).
# A provider call is allowed only with a recorded, non-revoked consent for that
# provider, at the current consent copy version. Providers that train on API
# data also need an explicit acknowledgement.
#
# Input:
# {
#   "user":     {"id": "<internal user id>"},
#   "provider": "gemini | openai | anthropic",
#   "consents": [
#     {"user_id": "...", "provider": "...", "copy_version": "...",
#      "acknowledged_training": true, "revoked": false}
#   ]
# }
package journal.ai.consent

import rego.v1

default allow := false

# Data-handling terms per provider. Re-check before each release (ADR-005).
# "gemini" means the free tier. Paid Gemini terms are not verified and must
# get their own key before paid mode is offered.
provider_terms := {
	"gemini": {"trains_on_data": true, "copy_version": "gemini-free-2026-10"},
	"openai": {"trains_on_data": false, "copy_version": "openai-2026-10"},
	"anthropic": {"trains_on_data": false, "copy_version": "anthropic-2026-10"},
}

allow if {
	count(deny_reasons) == 0
}

deny_reasons contains "unknown_provider" if {
	not provider_terms[input.provider]
}

deny_reasons contains "no_valid_consent" if {
	not has_valid_consent
}

has_valid_consent if {
	some c in input.consents
	c.user_id == input.user.id
	c.provider == input.provider
	c.revoked == false
	c.copy_version == provider_terms[input.provider].copy_version
	not training_unacknowledged(c)
}

training_unacknowledged(c) if {
	provider_terms[input.provider].trains_on_data == true
	c.acknowledged_training != true
}
