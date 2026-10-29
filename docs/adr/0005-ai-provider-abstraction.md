# ADR-005: Model-agnostic AI provider abstraction

Status: Proposed · Date: 2026-10-29 · Relates to: PRD FR-4, FR-5, FR-7, FR-10, Section 7

## Context

The PRD requires meal estimates from a photo or text, from one of three providers: Google Gemini (free tier, default), OpenAI, or Anthropic. Users choose the provider, may bring their own key (stored encrypted), and can switch at any time. Core logic must not depend on a vendor SDK. Every provider returns one validated schema, and failures reach the user.

Research, checked 2026-10-29:

- **Structured output:** all three support JSON-schema output. Anthropic rejects numeric and length bounds. Gemini silently strips them. OpenAI uses `strict: true`. Range checks therefore run in application code.
- **Vision:** all three accept JPEG, PNG, and WebP. Anthropic allows 600 images per request. Gemini inline requests are capped at 20 MB. Image plus JSON output is documented for Gemini. For OpenAI and Anthropic, verify with a spike.
- **Gemini free tier:** the pricing page (updated 2026-10-28) lists Gemini 2.5 Flash, 2.5 Flash-Lite, and 3 Flash Preview as free. It publishes no fixed RPM figures. Free-tier content is marked "used to improve our products."
- **LiteLLM:** MIT core, with `enterprise/` under a commercial license. Very active (about 55k commits). The fetched page showed no release date; verify before pinning.

## Decision

Write our own thin port and three adapters. Do not put a gateway library in the request path.

Core code depends only on the port. Adapters call vendor REST APIs directly through `httpx`. Vendor SDKs are imported only inside `adapters/`.

```python
class MealType(str, Enum):
    breakfast = "breakfast"; lunch = "lunch"; dinner = "dinner"; snack = "snack"

class MealEstimate(BaseModel):   # the one schema, validated after every provider reply
    name: str = Field(min_length=1, max_length=120)
    meal_type: MealType
    calories_kcal: int = Field(ge=0, le=5000)
    protein_g: float = Field(ge=0, le=500)
    carbs_g: float = Field(ge=0, le=800)
    fat_g: float = Field(ge=0, le=500)
    confidence: Literal["low", "medium", "high"]

class MealInput(BaseModel):
    text: str | None = None
    image: bytes | None = None
    image_mime: Literal["image/jpeg", "image/png", "image/webp"] | None = None

class EstimateError(Exception):  # shown to the user (FR-5); never replaced by defaults
    code: str                    # timeout | rate_limited | auth | invalid_output | out_of_range | unavailable
    provider: str

class NutritionEstimator(Protocol):
    provider_id: str             # "gemini" | "openai" | "anthropic"
    model_id: str                # pinned model ID, stored with each estimate
    async def estimate(self, meal: MealInput, api_key: str) -> MealEstimate: ...
```

The schema sent to providers is generated from `MealEstimate` with unsupported keywords stripped. Pydantic validates the reply. Failure raises `EstimateError`. Out-of-range values are rejected, not clamped.

**Adapters:** `GeminiAdapter` (default), `OpenAIAdapter` (Responses API, `json_schema` with `strict`), `AnthropicAdapter` (Messages API, `output_config.format`), and `FakeAdapter` for tests. Keys are decrypted only for the call and never logged.

**No silent cross-provider fallback.** On failure the user sees the error and can retry, switch provider, or enter values manually. Silently sending a photo to a second provider would bypass the consent gate.

**Key storage:** envelope encryption (data key wrapped by a KMS or secret-manager key).

## Alternatives considered

| Option | Trade-off | Verdict |
|---|---|---|
| LiteLLM proxy or SDK | Broad coverage. But it handles every prompt and user key, adds a split-license dependency, and does not remove our need for validation. | Rejected for now; revisit if providers grow past three. |
| Vercel AI SDK / Gateway | TypeScript-first; our backend is Python. Hosted dependency. | Rejected. |
| Vendor SDKs in core | Fast start, but leaks vendor types and breaks portability. | Rejected. |
| Single vendor | Simplest, but contradicts the PRD. | Rejected. |

## Consequences

- Three adapters to maintain; vendor API changes stay inside one file each.
- We own retries, timeouts, and error mapping (about a week of initial work).
- A new provider means one adapter plus passing the evaluation gate.
- Schema validation is ours on every provider, which is what the model-swap acceptance test in PRD Section 9 checks.

## Data handling per provider

Dates refer to the sources below. Re-check before each release.

| Provider | Training on API data | Retention | Consent copy must say |
|---|---|---|---|
| Gemini free | **Yes.** Pricing page (2026-10-28) marks free models "used to improve our products." Terms (2026-04-28): human reviewers may read input and output. | No general period; grounding data 30 days. | Content may improve Google products and may be read by human reviewers. |
| Gemini paid | Terms differ; not verified here. | Not verified. | Verify before offering paid mode. |
| OpenAI API | Not used by default (page undated). | Abuse-monitoring logs up to 30 days. Zero retention by approval. | Sent to OpenAI; kept up to 30 days for abuse monitoring. |
| Anthropic API | No training on API Customer Content (Commercial Terms, effective 2025-06-17). | Typically 30 days per privacy center (one blog says 7; unverified). Files API copies persist until deleted, so do not use it for photos. Zero retention by approval. | Sent to Anthropic; not used for training; kept up to 30 days. |

Our rules apply to all providers: photos are discarded after estimation unless the meal is saved (PRD Section 6), and logs hold no photos or personal text (FR-10).

## Model-quality drift: evaluation set

- **Set:** 150 labeled meals, half photos and half text, with reference values from weighed or database-verified data. Synthetic or consented images only.
- **Run:** every release candidate, every adapter, pinned model IDs.
- **Metrics:** schema-valid rate, meal-type accuracy, calorie error (median absolute percentage), protein MAE.
- **Gate:** fail if schema-valid rate is below 100%, or any provider's calorie error rises more than 5 points over its last baseline. Record provider model IDs and scores each run.
- **Between releases:** a nightly run against the default provider alerts on regression, since providers can change models behind stable aliases.

## Open risks

1. **The default provider may train on user data.** The PRD defaults to Gemini free tier, whose terms allow training and human review. The consent screen must say so, or the default changes. This is a product decision.
2. **Free-tier limits are unpublished** and may change. Show 429s as errors.
3. **Image plus structured output** is unverified for OpenAI and Anthropic.
4. **Anthropic retention** figures conflict across sources. Confirm before consent copy ships.
5. **Silent model changes** are caught only if the evaluation set runs regularly.

## Sources

Checked 2026-10-29.

- Gemini pricing (updated 2026-10-28): https://ai.google.dev/gemini-api/docs/pricing
- Gemini API terms (updated 2026-04-28): https://ai.google.dev/gemini-api/terms
- Gemini structured output (updated 2026-10-21): https://ai.google.dev/gemini-api/docs/structured-output
- Gemini rate limits (updated 2026-10-28): https://ai.google.dev/gemini-api/docs/rate-limits
- Gemini image understanding (updated 2026-09-23): https://ai.google.dev/gemini-api/docs/image-understanding
- OpenAI data controls: https://developers.openai.com/api/docs/guides/your-data
- OpenAI structured outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- Anthropic structured outputs: https://platform.claude.com/docs/en/docs/build-with-claude/structured-outputs
- Anthropic vision: https://platform.claude.com/docs/en/build-with-claude/vision
- Anthropic commercial terms: https://www.anthropic.com/legal/commercial-terms
- Anthropic zero data retention: https://privacy.claude.com/en/articles/8956058-zero-data-retention
- LiteLLM repository and license: https://github.com/BerriAI/litellm
