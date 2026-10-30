"""Meal estimates from a text description, using the user's own provider key.

The model is asked for one JSON object. Its reply is parsed and checked before anything is
returned: each value must be in range (rejected, never clamped), the macros must roughly
add up to the calories, and low-confidence or non-food answers are refused.
"""

import json
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.ai.providers import Provider, ProviderUnavailable

INSTRUCTIONS = (
    "You estimate the nutrition of a meal from a short description. Reply with only a JSON object "
    'with keys: "is_food" (boolean), "name" (short name), "calories" (kcal), "protein_g", '
    '"carbs_g", "fat_g" (grams), "confidence" (0 to 1). Values are for the whole amount described. '
    "If the description is not food, set is_food to false and the numbers to 0."
)

ENERGY_TOLERANCE_KCAL = 80
ENERGY_TOLERANCE_RATIO = 0.35
MIN_CONFIDENCE = 0.4


class EstimateInvalid(Exception):
    """The reply could not be used. The message is safe to show the user."""


class Estimate(BaseModel):
    is_food: bool
    name: str = Field(min_length=1, max_length=120)
    calories: float = Field(ge=0, le=5000)
    protein_g: float = Field(ge=0, le=300)
    carbs_g: float = Field(ge=0, le=500)
    fat_g: float = Field(ge=0, le=300)
    confidence: float = Field(ge=0, le=1)


def parse_reply(text: str) -> Estimate:
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise EstimateInvalid("The estimate could not be read. Try describing the meal again.")
    try:
        raw: Any = json.loads(text[start : end + 1])
        estimate = Estimate.model_validate(raw)
    except (json.JSONDecodeError, ValueError) as exc:
        raise EstimateInvalid(
            "The estimate was incomplete. Try describing the meal again."
        ) from exc

    if not estimate.is_food:
        raise EstimateInvalid("That does not look like food. Describe what you ate.")
    if estimate.confidence < MIN_CONFIDENCE:
        raise EstimateInvalid(
            "Not confident enough to estimate this. Add more detail, or enter the values yourself."
        )
    # Protein and carbs give 4 kcal per gram, fat gives 9. Allow for rounding and cooking losses.
    from_macros = 4 * estimate.protein_g + 4 * estimate.carbs_g + 9 * estimate.fat_g
    allowed = max(ENERGY_TOLERANCE_KCAL, ENERGY_TOLERANCE_RATIO * estimate.calories)
    if abs(from_macros - estimate.calories) > allowed:
        raise EstimateInvalid(
            "The numbers did not add up. Try again, or enter the values yourself."
        )
    return estimate


async def ask_provider(
    http: httpx.AsyncClient, provider: Provider, model: str, api_key: str, description: str
) -> str:
    """One request to the provider. The key goes in a header, never in the URL."""
    try:
        if provider == "openai":
            response = await http.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": INSTRUCTIONS},
                        {"role": "user", "content": description},
                    ],
                    "response_format": {"type": "json_object"},
                },
                timeout=30,
            )
            content = response.json()["choices"][0]["message"]["content"]
        elif provider == "anthropic":
            response = await http.post(
                "https://api.anthropic.com/v1/messages",
                headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                json={
                    "model": model,
                    "max_tokens": 300,
                    "system": INSTRUCTIONS,
                    "messages": [{"role": "user", "content": description}],
                },
                timeout=30,
            )
            content = response.json()["content"][0]["text"]
        else:
            response = await http.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                headers={"x-goog-api-key": api_key},
                json={
                    "systemInstruction": {"parts": [{"text": INSTRUCTIONS}]},
                    "contents": [{"parts": [{"text": description}]}],
                    "generationConfig": {"responseMimeType": "application/json"},
                },
                timeout=30,
            )
            content = response.json()["candidates"][0]["content"]["parts"][0]["text"]
    except httpx.HTTPError as exc:
        raise ProviderUnavailable("provider unreachable") from exc
    except (KeyError, IndexError, ValueError, TypeError) as exc:
        raise ProviderUnavailable("provider reply was not understood") from exc
    if response.status_code != 200:
        raise ProviderUnavailable(f"provider answered {response.status_code}")
    return str(content)
