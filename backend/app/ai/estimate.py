"""Meal estimates from a text description, using the user's own provider key.

The model returns one JSON object: the meal split into items, each with its own numbers, plus
any questions whose answer changes the numbers (for example wheat or refined flour). A reply
is checked before use. Values are refused when out of range, never clamped. Totals are the sum
of the items, and must roughly match the macros' energy. A second request carries the user's
answers. "Unsure" or a missing answer means the question's default is used, and we say so.
"""

import json
from dataclasses import dataclass, field

import httpx
from pydantic import BaseModel, Field, ValidationError

from app.ai.providers import Provider, ProviderUnavailable

INSTRUCTIONS = (
    "You estimate the nutrition of a meal from a short description. "
    "Use standard reference values (for example USDA FoodData Central, and the Indian Food "
    "Composition Tables for Indian dishes). "
    "Split the meal into items, each with its own numbers for the amount described. "
    "If a detail changes the numbers a lot and is not given (for example wheat or refined flour "
    "in a bread, or oil in a fried dish), add a question with two to four options and name the "
    "most typical option as default. Ask at most two questions. "
    "Reply with only a JSON object with keys: "
    '"is_food" (boolean), "name" (short name), "items" (list of objects with "name", "calories", '
    '"protein_g", "carbs_g", "fat_g"), "questions" (list of objects with "id", "question", '
    '"options", "default"), "confidence" (0 to 1). If the description is not food, set is_food '
    "to false."
)

ENERGY_TOLERANCE_KCAL = 80
ENERGY_TOLERANCE_RATIO = 0.35
MIN_CONFIDENCE = 0.4
MAX_QUESTIONS = 2


class EstimateInvalid(Exception):
    """The reply could not be used. The message is safe to show the user."""


class Item(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    calories: float = Field(ge=0, le=3000)
    protein_g: float = Field(ge=0, le=200)
    carbs_g: float = Field(ge=0, le=300)
    fat_g: float = Field(ge=0, le=200)


class Question(BaseModel):
    id: str = Field(min_length=1, max_length=32, pattern=r"^[a-z_]+$")
    question: str = Field(min_length=3, max_length=160)
    options: list[str] = Field(min_length=2, max_length=4)
    default: str


class Reply(BaseModel):
    is_food: bool
    name: str = Field(min_length=1, max_length=120)
    items: list[Item] = Field(min_length=1, max_length=12)
    questions: list[Question] = Field(default_factory=list, max_length=MAX_QUESTIONS)
    confidence: float = Field(ge=0, le=1)


@dataclass
class Estimate:
    name: str
    items: list[Item]
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    confidence: float
    assumptions: list[str] = field(default_factory=list)


@dataclass
class Pending:
    questions: list[Question]


class SuppliedAnswer(BaseModel):
    """A question the user was asked, with their reply. The client sends these back unchanged."""

    id: str = Field(min_length=1, max_length=32, pattern=r"^[a-z_]+$")
    question: str = Field(min_length=3, max_length=160)
    options: list[str] = Field(min_length=2, max_length=4)
    default: str = Field(min_length=1, max_length=60)
    answer: str = Field(min_length=1, max_length=60)


UNSURE = "unsure"


def _is_unsure(supplied: SuppliedAnswer) -> bool:
    return supplied.answer == UNSURE or supplied.answer not in supplied.options


def parse_reply(text: str, supplied: list[SuppliedAnswer] | None = None) -> Estimate | Pending:
    """Return the estimate, or the questions to ask.

    With answers supplied, the model is not asked again: anything unanswered or "unsure" takes
    the default, and that is listed as an assumption.
    """
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1:
        raise EstimateInvalid("The estimate could not be read. Try describing the meal again.")
    try:
        reply = Reply.model_validate(json.loads(text[start : end + 1]))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise EstimateInvalid(
            "The estimate was incomplete. Try describing the meal again."
        ) from exc

    if not reply.is_food:
        raise EstimateInvalid("That does not look like food. Describe what you ate.")
    if reply.confidence < MIN_CONFIDENCE:
        raise EstimateInvalid(
            "Not confident enough to estimate this. Add more detail, or enter the values yourself."
        )

    if supplied is None and reply.questions:
        return Pending(questions=reply.questions)

    assumptions = [
        f"{a.question.rstrip('?')}: assumed {a.default}" for a in (supplied or []) if _is_unsure(a)
    ]

    totals = {
        f: round(sum(getattr(i, f) for i in reply.items), 1)
        for f in ("calories", "protein_g", "carbs_g", "fat_g")
    }
    if not (
        0 <= totals["calories"] <= 5000
        and 0 <= totals["protein_g"] <= 300
        and 0 <= totals["carbs_g"] <= 500
        and 0 <= totals["fat_g"] <= 300
    ):
        raise EstimateInvalid(
            "The total was out of range. Try again, or enter the values yourself."
        )
    from_macros = 4 * totals["protein_g"] + 4 * totals["carbs_g"] + 9 * totals["fat_g"]
    allowed = max(ENERGY_TOLERANCE_KCAL, ENERGY_TOLERANCE_RATIO * totals["calories"])
    if abs(from_macros - totals["calories"]) > allowed:
        raise EstimateInvalid(
            "The numbers did not add up. Try again, or enter the values yourself."
        )

    return Estimate(
        name=reply.name,
        items=reply.items,
        calories=totals["calories"],
        protein_g=totals["protein_g"],
        carbs_g=totals["carbs_g"],
        fat_g=totals["fat_g"],
        confidence=reply.confidence,
        assumptions=assumptions,
    )


def describe_answers(supplied: list[SuppliedAnswer]) -> str:
    lines = []
    for a in supplied:
        if _is_unsure(a):
            lines.append(f"- {a.question} The user did not know; use the default: {a.default}.")
        else:
            lines.append(f"- {a.question} The user answered: {a.answer}.")
    return "\n".join(lines)


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
                    "max_tokens": 800,
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
