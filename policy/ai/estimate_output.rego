# Output guardrail for AI meal estimates (ADR-006, layer c; PRD FR-4, FR-5).
# Validates one provider reply after JSON parsing. Pydantic has already checked
# the JSON types. This policy is authoritative for ranges, plausibility,
# confidence and the non-food refusal path.
#
# Input:  {"estimate": { name, meal_type, calories_kcal, protein_g, carbs_g,
#                        fat_g, confidence, is_food }}
# Output: result := {"decision": "accept" | "reject" | "refuse",
#                    "violations": [ ... ]}
#
# Rules: reject, never clamp. A reject sends the user to manual entry.
# No fixed fallback numbers are ever produced here.
package journal.ai.estimate

import rego.v1

default decision := "reject"

required_fields := {"name", "meal_type", "calories_kcal", "protein_g", "carbs_g", "fat_g", "confidence", "is_food"}

allowed_fields := required_fields

numeric_fields := {"calories_kcal", "protein_g", "carbs_g", "fat_g"}

meal_types := {"breakfast", "lunch", "dinner", "snack"}

confidence_rank := {"low": 0, "medium": 1, "high": 2}

# Confidence floor: "medium" or better is accepted. "low" is rejected.
confidence_floor := 1

# Plausible ranges (ADR-005 MealEstimate limits).
ranges := {
	"calories_kcal": {"min": 0, "max": 5000},
	"protein_g": {"min": 0, "max": 500},
	"carbs_g": {"min": 0, "max": 800},
	"fat_g": {"min": 0, "max": 500},
}

# Energy plausibility: calories must sit within max(50 kcal, 25%) of
# 4*protein + 4*carbs + 9*fat. Starting values; calibrate on the labelled set.
energy_abs_tolerance := 50
energy_rel_tolerance := 0.25

reply := input.estimate

result := {"decision": decision, "violations": violations}

decision := "refuse" if {
	is_object(reply)
	reply.is_food == false
}

decision := "accept" if {
	is_object(reply)
	reply.is_food == true
	count(violations) == 0
}

# Structure

violations contains "not_an_object" if not is_object(reply)

violations contains sprintf("missing:%s", [f]) if {
	is_object(reply)
	some f in required_fields
	not f in object.keys(reply)
}

violations contains sprintf("unknown_field:%s", [k]) if {
	is_object(reply)
	some k in object.keys(reply)
	not allowed_fields[k]
}

violations contains sprintf("wrong_type:%s", [f]) if {
	is_object(reply)
	some f in numeric_fields
	f in object.keys(reply)
	not is_number(reply[f])
}

violations contains "not_integer:calories_kcal" if {
	is_number(reply.calories_kcal)
	round(reply.calories_kcal) != reply.calories_kcal
}

violations contains "invalid:name" if {
	is_object(reply)
	not valid_name
}

violations contains "invalid:meal_type" if {
	is_object(reply)
	not meal_types[reply.meal_type]
}

violations contains "invalid:confidence" if {
	is_object(reply)
	not confidence_rank[reply.confidence]
}

valid_name if {
	is_string(reply.name)
	count(reply.name) >= 1
	count(reply.name) <= 120
}

# Ranges: reject, never clamp

violations contains sprintf("out_of_range:%s", [f]) if {
	is_object(reply)
	some f, r in ranges
	v := reply[f]
	is_number(v)
	v < r.min
}

violations contains sprintf("out_of_range:%s", [f]) if {
	is_object(reply)
	some f, r in ranges
	v := reply[f]
	is_number(v)
	v > r.max
}

# Confidence floor

violations contains "low_confidence" if {
	is_object(reply)
	confidence_rank[reply.confidence] < confidence_floor
}

# Plausibility: stated calories against macros

violations contains "energy_mismatch" if {
	is_object(reply)
	is_number(reply.calories_kcal)
	is_number(reply.protein_g)
	is_number(reply.carbs_g)
	is_number(reply.fat_g)
	atwater := 4 * reply.protein_g + 4 * reply.carbs_g + 9 * reply.fat_g
	tol := max([energy_abs_tolerance, energy_rel_tolerance * reply.calories_kcal])
	atwater - reply.calories_kcal > tol
}

violations contains "energy_mismatch" if {
	is_object(reply)
	is_number(reply.calories_kcal)
	is_number(reply.protein_g)
	is_number(reply.carbs_g)
	is_number(reply.fat_g)
	atwater := 4 * reply.protein_g + 4 * reply.carbs_g + 9 * reply.fat_g
	tol := max([energy_abs_tolerance, energy_rel_tolerance * reply.calories_kcal])
	reply.calories_kcal - atwater > tol
}
