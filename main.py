import os
from typing import List, Literal

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

MODEL = "claude-sonnet-5"

app = FastAPI(title="eatEazy backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class Constraints(BaseModel):
    dietary_restrictions: List[str] = []
    allergies: List[str] = []
    budget_tier: Literal["low", "medium", "high"] = "medium"
    max_cook_time_minutes: int = 45
    household_size: int = 2
    disliked_ingredients: List[str] = []
    preferred_cuisines: List[str] = []
    avoided_cuisines: List[str] = []


class MealSlotRequest(BaseModel):
    id: str
    label: str


class SuggestionsRequest(BaseModel):
    constraints: Constraints
    slots: List[MealSlotRequest]
    exclude_titles: List[str] = []


class Ingredient(BaseModel):
    name: str
    quantity: str


class MealOption(BaseModel):
    id: str
    title: str
    description: str
    cook_time_minutes: int
    cuisine: str
    tags: List[str]
    ingredients: List[Ingredient]


class SlotSuggestions(BaseModel):
    slot_id: str
    options: List[MealOption]


class SuggestionsResponse(BaseModel):
    slots: List[SlotSuggestions]


SUGGESTIONS_TOOL = {
    "name": "return_meal_suggestions",
    "description": "Return exactly 3 meal options for each requested meal slot.",
    "input_schema": {
        "type": "object",
        "properties": {
            "slots": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "slot_id": {"type": "string"},
                        "options": {
                            "type": "array",
                            "minItems": 3,
                            "maxItems": 3,
                            "items": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "title": {"type": "string"},
                                    "description": {"type": "string"},
                                    "cook_time_minutes": {"type": "integer"},
                                    "cuisine": {"type": "string"},
                                    "tags": {"type": "array", "items": {"type": "string"}},
                                    "ingredients": {
                                        "type": "array",
                                        "items": {
                                            "type": "object",
                                            "properties": {
                                                "name": {"type": "string"},
                                                "quantity": {"type": "string"},
                                            },
                                            "required": ["name", "quantity"],
                                        },
                                    },
                                },
                                "required": [
                                    "id",
                                    "title",
                                    "description",
                                    "cook_time_minutes",
                                    "cuisine",
                                    "tags",
                                    "ingredients",
                                ],
                            },
                        },
                    },
                    "required": ["slot_id", "options"],
                },
            }
        },
        "required": ["slots"],
    },
}


def build_prompt(req: SuggestionsRequest) -> str:
    c = req.constraints
    slot_lines = "\n".join(f"- {s.id}: {s.label}" for s in req.slots)
    lines = [
        "Suggest home-cooked dinner options for the following meal slots:",
        slot_lines,
        "",
        "Hard constraints (must never be violated):",
        f"- Allergies: {', '.join(c.allergies) or 'none'}",
        f"- Dietary restrictions: {', '.join(c.dietary_restrictions) or 'none'}",
        f"- Disliked ingredients (do not include): {', '.join(c.disliked_ingredients) or 'none'}",
        f"- Max cook time: {c.max_cook_time_minutes} minutes",
        "",
        "Soft preferences (bias toward, don't need to be perfectly satisfied):",
        f"- Budget tier: {c.budget_tier}",
        f"- Household size: {c.household_size}",
        f"- Preferred cuisines: {', '.join(c.preferred_cuisines) or 'no strong preference'}",
        f"- Avoided cuisines: {', '.join(c.avoided_cuisines) or 'none'}",
    ]
    if req.exclude_titles:
        lines += ["", f"Do not suggest any of these (already shown/rejected): {', '.join(req.exclude_titles)}"]
    lines += [
        "",
        "For each slot, return exactly 3 distinct options via the return_meal_suggestions tool. "
        "Each option needs a short description, a realistic cook time, cuisine, a few tags, "
        "and a practical ingredient list with quantities scaled to the household size.",
    ]
    return "\n".join(lines)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/suggestions", response_model=SuggestionsResponse)
def suggestions(req: SuggestionsRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not set. Copy .env.example to .env and add your key.",
        )

    client = anthropic.Anthropic(api_key=api_key)

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=4096,
            tools=[SUGGESTIONS_TOOL],
            tool_choice={"type": "tool", "name": "return_meal_suggestions"},
            messages=[{"role": "user", "content": build_prompt(req)}],
        )
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e}")

    tool_use = next((block for block in message.content if block.type == "tool_use"), None)
    if tool_use is None:
        raise HTTPException(status_code=502, detail="Model did not return structured suggestions.")

    return SuggestionsResponse(**tool_use.input)
