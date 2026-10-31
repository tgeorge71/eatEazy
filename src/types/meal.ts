import type { Nutrition, MealType } from "@/health/fitness";
export type BudgetTier = "low" | "medium" | "high";
export type Constraints = {
    dietaryRestrictions: string[];
    allergies: string[];
    budgetTier: BudgetTier;
    maxCookTimeMinutes: number;
    householdSize: number;
    dislikedIngredients: string[];
    preferredCuisines: string[];
    avoidedCuisines: string[];
};
export const DEFAULT_CONSTRAINTS: Constraints = {
    dietaryRestrictions: [],
    allergies: [],
    budgetTier: "medium",
    maxCookTimeMinutes: 45,
    householdSize: 2,
    dislikedIngredients: [],
    preferredCuisines: [],
    avoidedCuisines: [],
};
export type MealSlotRequest = {
    id: string;
    label: string;
    local_date?: string;
    meal_type?: MealType;
    target?: Nutrition;
};
export type Ingredient = {
    name: string;
    quantity: string;
};
export type MealOption = {
    id: string;
    title: string;
    description: string;
    cookTimeMinutes: number;
    cuisine: string;
    tags: string[];
    ingredients: Ingredient[];
    nutrition?: Nutrition;
    workoutRationale?: string;
};
export type SlotSuggestions = {
    slotId: string;
    options: MealOption[];
};
export type AcceptedMeal = {
    slotId: string;
    slotLabel: string;
    meal: MealOption;
};
export type GroceryItem = {
    name: string;
    entries: {
        quantity: string;
        slotLabel: string;
    }[];
};
