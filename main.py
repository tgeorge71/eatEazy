import os
import math
from typing import List, Literal

import anthropic
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, model_validator
from datetime import date, datetime
import json

load_dotenv()

MODEL = "claude-sonnet-5"

from google_health import signed_owner

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
    max_cook_time_minutes: int = Field(default=45, ge=1, le=1440)
    household_size: int = Field(default=2, ge=1, le=50)
    disliked_ingredients: List[str] = []
    preferred_cuisines: List[str] = []
    avoided_cuisines: List[str] = []


class Nutrition(BaseModel):
    calories: float = Field(gt=0, allow_inf_nan=False)
    protein_g: float = Field(ge=0, allow_inf_nan=False)
    carbs_g: float = Field(ge=0, allow_inf_nan=False)
    fat_g: float = Field(ge=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def consistent(self):
        macro_calories = 4 * (self.protein_g + self.carbs_g) + 9 * self.fat_g
        if abs(self.calories - macro_calories) > max(50, self.calories * 0.15):
            raise ValueError("Calories must agree with macros within 15% or 50 kcal.")
        return self


class FitnessProfile(BaseModel):
    age: int = Field(ge=1, le=120)
    height_cm: float = Field(ge=50, le=250, allow_inf_nan=False)
    weight_kg: float = Field(ge=20, le=400, allow_inf_nan=False)
    sex_coefficient: Literal["male", "female"]
    activity: Literal["sedentary", "light", "moderate", "high"]
    goal: Literal["balanced", "strength", "endurance"] = "balanced"
    pregnant_or_breastfeeding: bool = False
    override: Nutrition | None = None
    # Percentages of calories: carbohydrates, protein, fat.
    macro_percentages: list[float] | None = None  # carbs, protein, fat

    @model_validator(mode="after")
    def valid_percentages(self):
        if self.macro_percentages is not None:
            values = self.macro_percentages
            if len(values) != 3 or any(not math.isfinite(v) or v <= 0 for v in values) or abs(sum(values) - 100) > 0.01:
                raise ValueError("Carbohydrate, protein and fat percentages must be positive and sum to 100.")
        return self


class TargetRequest(BaseModel):
    profile: FitnessProfile
    include_snack: bool = True


def calculate_targets(req: TargetRequest):
    p = req.profile
    if p.override:
        daily = p.override
        source = "manual"
    else:
        if p.age < 18 or p.pregnant_or_breastfeeding:
            raise HTTPException(status_code=422, detail="Automatic targets are for adults who are not pregnant or breastfeeding. Enter manual targets.")
        resting = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + (5 if p.sex_coefficient == "male" else -161)
        calories = round(resting * {"sedentary": 1.2, "light": 1.375, "moderate": 1.55, "high": 1.725}[p.activity])
        if calories <= 0:
            raise HTTPException(status_code=422, detail="This profile does not produce a valid energy estimate. Check your measurements or enter manual targets.")
        carbs, protein, fat = p.macro_percentages or {"balanced": [50, 20, 30], "strength": [45, 30, 25], "endurance": [55, 20, 25]}[p.goal]
        daily = Nutrition(calories=calories, protein_g=round(calories * protein / 400, 1), carbs_g=round(calories * carbs / 400, 1), fat_g=round(calories * fat / 900, 1))
        source = "estimated"
    allocations = {"breakfast": .25, "lunch": .30, "dinner": .35, "snack": .10} if req.include_snack else {"breakfast": .30, "lunch": .35, "dinner": .35}
    return {"daily": daily.model_dump(), "meals": {meal: {key: round(value * share, 1) for key, value in daily.model_dump().items()} for meal, share in allocations.items()}, "source": source}


@app.post("/nutrition/targets", dependencies=[Depends(signed_owner)])
def nutrition_targets(req: TargetRequest):
    return calculate_targets(req)


class Workout(BaseModel):
    id: str
    source: Literal["manual", "google_health"] = "manual"
    start_time: datetime
    local_date: date
    type: str = Field(min_length=1, max_length=80)
    duration_minutes: float = Field(gt=0, le=1440, allow_inf_nan=False)
    status: Literal["planned", "completed"]
    active_calories: float | None = Field(default=None, ge=0, allow_inf_nan=False)


class FitnessContext(BaseModel):
    goal: Literal["balanced", "strength", "endurance"]
    daily_target: Nutrition


class MealSlotRequest(BaseModel):
    id: str
    label: str
    local_date: date | None = None
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"] = "dinner"
    target: Nutrition | None = None


class SuggestionsRequest(BaseModel):
    constraints: Constraints
    slots: List[MealSlotRequest] = Field(min_length=1, max_length=7)
    exclude_titles: List[str] = []
    fitness_context: FitnessContext | None = None
    workouts: list[Workout] = []
    workout_consent: bool = False

    @model_validator(mode="after")
    def consent_and_ids(self):
        if self.workouts and not self.workout_consent:
            raise ValueError("Consent is required to send workout summaries to Claude.")
        if len({slot.id for slot in self.slots}) != len(self.slots):
            raise ValueError("Slot IDs must be unique.")
        return self


class Ingredient(BaseModel):
    name: str
    quantity: str


class MealOption(BaseModel):
    id: str
    title: str
    description: str
    cook_time_minutes: int = Field(ge=0)
    cuisine: str
    tags: List[str]
    ingredients: List[Ingredient]
    nutrition: Nutrition | None = None
    workout_rationale: str | None = None


class SlotSuggestions(BaseModel):
    slot_id: str
    options: List[MealOption] = Field(min_length=3, max_length=3)


class SuggestionsResponse(BaseModel):
    slots: List[SlotSuggestions]


SUGGESTIONS_TOOL = {
    "name": "return_meal_suggestions",
    "description": "Return exactly 3 meal options per requested slot, with estimated per-serving nutrition and workout rationale.",
    "input_schema": SuggestionsResponse.model_json_schema(),
}


def build_prompt(req: SuggestionsRequest) -> str:
    c = req.constraints
    slot_lines = "\n".join(f"- {s.id}: {s.label}" for s in req.slots)
    lines = [
        "Suggest home-cooked meal options for the following meal slots:",
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
    lines += [
        "Nutrition must be estimated per serving for the profile owner; ingredient quantities cover the household size.",
        "Provide nutrition and workout_rationale for every option. Calories must match 4*protein_g + 4*carbs_g + 9*fat_g.",
        "Respect slot meal types and approximate each slot target. Explain differences without claiming exact accuracy.",
        "Use workout type and duration to inform meal composition. Do not add exercise calories to the targets.",
        "Do not claim future workouts were completed or treat missing workouts as inactivity.",
        "Slot details: " + json.dumps([slot.model_dump(mode="json") for slot in req.slots]),
    ]
    if req.fitness_context:
        lines.append("Fitness context: " + req.fitness_context.model_dump_json())
    dates = {slot.local_date for slot in req.slots}
    relevant = [w for w in req.workouts if w.local_date in dates]
    if relevant and req.workout_consent:
        lines.append("Workout summaries: " + json.dumps([w.model_dump(mode="json", exclude={"id", "active_calories", "source", "start_time"}) for w in relevant]))
    return "\n".join(lines)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/suggestions", response_model=SuggestionsResponse, dependencies=[Depends(signed_owner)])
def suggestions(req: SuggestionsRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="ANTHROPIC_API_KEY is not set. Add your key to the backend .env file.",
        )

    client = anthropic.Anthropic(api_key=api_key, timeout=90.0, max_retries=1)

    try:
        message = client.messages.create(
            model=MODEL,
            max_tokens=12000,
            tools=[SUGGESTIONS_TOOL],
            tool_choice={"type": "tool", "name": "return_meal_suggestions"},
            messages=[{"role": "user", "content": build_prompt(req)}],
        )
    except anthropic.APIError as e:
        raise HTTPException(status_code=502, detail="The AI service could not generate meals. Check your backend API key, model access and connection, then retry.") from e

    tool_use = next((block for block in message.content if block.type == "tool_use"), None)
    if tool_use is None:
        raise HTTPException(status_code=502, detail="Model did not return structured suggestions.")

    try:
        result = SuggestionsResponse(**tool_use.input)
        if len(result.slots) != len(req.slots) or {s.slot_id for s in result.slots} != {s.id for s in req.slots}:
            raise ValueError("Returned slots do not match requested slots.")
        for slot in result.slots:
            if len({o.id for o in slot.options}) != 3:
                raise ValueError("Meal IDs must be unique within each slot.")
            for option in slot.options:
                if option.nutrition is None or not option.workout_rationale:
                    raise ValueError("Missing nutrition or rationale.")
                if option.cook_time_minutes > req.constraints.max_cook_time_minutes:
                    raise ValueError("Meal exceeds maximum cook time.")
        return result
    except (ValidationError, ValueError, TypeError) as e:
        raise HTTPException(status_code=502, detail="AI returned an invalid meal plan. Please retry.") from e

# Load after dotenv so configuration stays exclusively on the backend.
from google_health import router as google_health_router
app.include_router(google_health_router)


@app.middleware("http")
async def protect_health_responses(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/google-health"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["X-Content-Type-Options"] = "nosniff"
        if request.url.path == "/google-health/callback":
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
    return response
