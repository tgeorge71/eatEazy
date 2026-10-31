import { sessionHeaders } from "@/api/googleHealth";
import type { Goal, Nutrition, Workout } from "@/health/fitness";
import { API_BASE_URL } from "@/config";
import type { Constraints, MealSlotRequest, SlotSuggestions } from "@/types/meal";
export function toApiConstraints(constraints: Constraints) {
    return {
        dietary_restrictions: constraints.dietaryRestrictions,
        allergies: constraints.allergies,
        budget_tier: constraints.budgetTier,
        max_cook_time_minutes: constraints.maxCookTimeMinutes,
        household_size: constraints.householdSize,
        disliked_ingredients: constraints.dislikedIngredients,
        preferred_cuisines: constraints.preferredCuisines,
        avoided_cuisines: constraints.avoidedCuisines,
    };
}
export async function fetchSuggestions(constraints: Constraints, slots: MealSlotRequest[], excludeTitles: string[] = [], context?: {
    goal: Goal;
    daily_target: Nutrition;
    workouts: Workout[];
    consent: boolean;
}): Promise<SlotSuggestions[]> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/suggestions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...await sessionHeaders() },
            body: JSON.stringify({
                constraints: toApiConstraints(constraints),
                slots,
                exclude_titles: excludeTitles,
                fitness_context: context ? { goal: context.goal, daily_target: context.daily_target } : undefined,
                workouts: context?.consent ? context.workouts : [],
                workout_consent: context?.consent ?? false,
            }),
        });
    }
    catch {
        throw new Error(`Cannot reach the backend at ${API_BASE_URL}. Start the Python server; on a phone use your computer's LAN address.`);
    }
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error((typeof body?.detail === "string" ? body.detail : undefined) ?? `Request failed with status ${response.status}`);
    }
    const data = await response.json();
    return data.slots.map((slot: any) => ({
        slotId: slot.slot_id,
        options: slot.options.map((option: any) => ({
            id: option.id,
            title: option.title,
            description: option.description,
            cookTimeMinutes: option.cook_time_minutes,
            cuisine: option.cuisine,
            tags: option.tags,
            ingredients: option.ingredients,
            nutrition: option.nutrition,
            workoutRationale: option.workout_rationale,
        })),
    }));
}
