import { API_BASE_URL } from "@/config";
import type { Constraints, MealSlotRequest, SlotSuggestions } from "@/types/meal";

export async function fetchSuggestions(
  constraints: Constraints,
  slots: MealSlotRequest[],
  excludeTitles: string[] = []
): Promise<SlotSuggestions[]> {
  const response = await fetch(`${API_BASE_URL}/suggestions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      constraints: {
        dietary_restrictions: constraints.dietaryRestrictions,
        allergies: constraints.allergies,
        budget_tier: constraints.budgetTier,
        max_cook_time_minutes: constraints.maxCookTimeMinutes,
        household_size: constraints.householdSize,
        disliked_ingredients: constraints.dislikedIngredients,
        preferred_cuisines: constraints.preferredCuisines,
        avoided_cuisines: constraints.avoidedCuisines,
      },
      slots,
      exclude_titles: excludeTitles,
    }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with status ${response.status}`);
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
    })),
  }));
}
