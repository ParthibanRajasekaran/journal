# AI evaluation sets

Two small fixture sets drive the validators and, when the owner authorizes it, a real-provider run. They are an initial
set for catching regressions and gross errors. They are not population validation and never justify an accuracy claim.

| File | Size | Used by |
|---|---|---|
| `backend/tests/evals/meals.jsonl` | 20 meals: simple, mixed, packaged, ambiguous, shakes, non-food, malformed replies | `backend/tests/test_eval_meals_mock.py` on every gate; `backend/scripts/eval_provider.py` when authorized |
| `backend/tests/evals/workouts.jsonl` | 12 workout scenarios: time, location, equipment, readiness, pain, missing history, bad model output | M4 tests (`pytest -m m4`) |

## Meal fixture shape

`id`, `category`, `input_text`, `expected` (`calories`, `protein_g`, `tolerance_pct`, or `refusal: true`, plus a `note`),
`mock_expect` (`accept`, `questions`, `refuse`) and either `fake_reply` (a provider JSON object) or `fake_reply_text`
(raw text, for malformed replies). The mocked test asserts the validator's outcome and, for accepted replies, that the
reply's totals sit within tolerance of the reference.

## Real-provider run

`backend/scripts/eval_provider.py` sends each `input_text` to one provider with the owner's key, runs the reply through
the validator, and writes `docs/evals/<date>-<provider>.md` with per-fixture error against the reference and a
correction-burden column. It refuses to run without `JOURNAL_EVAL_AUTHORIZED=1`, a provider and a key on the command
line. It is never run by hooks, CI or `make`. Report mocked and real results separately; never let a model's own
confidence number stand in for accuracy.

## Adding fixtures

Add consented, weighed or labelled meals only. Keep the reference values traceable (label, scale, or a named food table).
Reset nothing: new fixtures get new ids. Keep the set small enough that an authorized run stays cheap.
