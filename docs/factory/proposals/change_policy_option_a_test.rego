# Tests for the option A proposal. Run: opa test docs/factory/proposals -v
package journal.agents.change_option_a_test

import rego.v1

import data.journal.agents.change

agent_change(path) := {
	"actor": {"type": "agent", "id": "coding-agent"},
	"changes": [{"path": path, "op": "modify"}],
	"approvals": [],
}

test_client_source_is_allowed_for_agents if {
	change.allow with input as agent_change("web/src/offline.ts")
}

test_client_e2e_is_allowed_for_agents if {
	change.allow with input as agent_change("web/e2e/save-moment.spec.ts")
}

test_native_shell_stays_human_only if {
	not change.allow with input as agent_change("web/android/app/src/main/AndroidManifest.xml")
}

test_ios_stays_human_only if {
	not change.allow with input as agent_change("ios/App/App/Info.plist")
}

test_factory_control_stays_human_only if {
	not change.allow with input as agent_change("factory/config.json")
}

test_approvals_file_stays_human_only if {
	not change.allow with input as agent_change("docs/factory/policy-exceptions.json")
}

test_auth_code_stays_human_only if {
	not change.allow with input as agent_change("web/src/auth/token.ts")
}

test_policy_directory_stays_human_only if {
	not change.allow with input as agent_change("policy/agents/change_policy.rego")
}

test_agents_cannot_approve if {
	not change.allow with input as {
		"actor": {"type": "agent", "id": "coding-agent"},
		"changes": [{"path": "web/src/offline.ts", "op": "modify"}],
		"approvals": [{"type": "agent", "id": "reviewer-agent"}],
	}
}
