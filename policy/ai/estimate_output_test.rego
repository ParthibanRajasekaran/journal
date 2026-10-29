# Unit tests for policy/ai/estimate_output.rego. Run with: opa test policy/ -v
package journal.ai.estimate_test

import rego.v1

import data.journal.ai.estimate

valid_reply := {
	"name": "Oatmeal with banana",
	"meal_type": "breakfast",
	"calories_kcal": 352,
	"protein_g": 11.8,
	"carbs_g": 61.0,
	"fat_g": 6.2,
	"confidence": "high",
	"is_food": true,
}

# Valid

test_valid_reply_is_accepted if {
	r := estimate.result with input as {"estimate": valid_reply}
	r.decision == "accept"
	count(r.violations) == 0
}

# Out of range: rejected, never clamped

test_calories_above_max_is_rejected_not_clamped if {
	r := estimate.result with input as {"estimate": object.union(valid_reply, {"calories_kcal": 6000})}
	r.decision == "reject"
	"out_of_range:calories_kcal" in r.violations
}

test_negative_protein_is_rejected if {
	r := estimate.result with input as {"estimate": object.union(valid_reply, {"protein_g": -1.0})}
	r.decision == "reject"
	"out_of_range:protein_g" in r.violations
}

# Missing field

test_missing_field_is_rejected if {
	r := estimate.result with input as {"estimate": object.remove(valid_reply, ["protein_g"])}
	r.decision == "reject"
	"missing:protein_g" in r.violations
}

test_missing_estimate_object_is_rejected if {
	r := estimate.result with input as {}
	r.decision == "reject"
}

test_missing_is_food_is_rejected if {
	r := estimate.result with input as {"estimate": object.remove(valid_reply, ["is_food"])}
	r.decision == "reject"
	"missing:is_food" in r.violations
}

# Non-food: refusal path

test_non_food_is_refused if {
	r := estimate.result with input as {"estimate": object.union(valid_reply, {"is_food": false})}
	r.decision == "refuse"
}

# Other guards

test_low_confidence_is_rejected if {
	r := estimate.result with input as {"estimate": object.union(valid_reply, {"confidence": "low"})}
	r.decision == "reject"
	"low_confidence" in r.violations
}

test_energy_mismatch_is_rejected if {
	r := estimate.result with input as {"estimate": object.union(valid_reply, {"calories_kcal": 900})}
	r.decision == "reject"
	"energy_mismatch" in r.violations
}

test_unknown_field_is_rejected if {
	r := estimate.result with input as {"estimate": object.union(valid_reply, {"notes": "free text"})}
	r.decision == "reject"
	"unknown_field:notes" in r.violations
}
