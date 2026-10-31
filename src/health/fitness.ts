export type Nutrition = {
    calories: number;
    protein_g: number;
    carbs_g: number;
    fat_g: number;
};
export type Goal = "balanced" | "strength" | "endurance";
export type FitnessProfile = {
    age: number;
    height_cm: number;
    weight_kg: number;
    sex_coefficient: "male" | "female";
    activity: "sedentary" | "light" | "moderate" | "high";
    goal: Goal;
    pregnant_or_breastfeeding: boolean;
    override?: Nutrition;
    macro_percentages?: number[];
};
export type Workout = {
    id: string;
    source: "manual" | "google_health";
    start_time: string;
    local_date: string;
    type: string;
    duration_minutes: number;
    status: "planned" | "completed";
    active_calories?: number;
};
export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type Targets = {
    daily: Nutrition;
    meals: Partial<Record<MealType, Nutrition>>;
    source: string;
};
export type WorkoutProvider = {
    read: (dates: string[]) => Promise<Workout[]>;
};
export function manualWorkoutProvider(workouts: Workout[]): WorkoutProvider {
    return { read: async (dates) => workouts.filter(w => dates.includes(w.local_date)) };
}
export function localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function upcomingDates(count = 7, today = new Date()): string[] {
    return Array.from({ length: count }, (_, i) => {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        return localDate(date);
    });
}
export function convertMeasurements(height: number, weight: number, imperial: boolean) {
    return { height_cm: imperial ? height * 2.54 : height, weight_kg: imperial ? weight * 0.45359237 : weight };
}
export const EMPTY_NUTRITION: Nutrition = { calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 };
export function nutritionText(n: Nutrition) {
    return `${Math.round(n.calories)} kcal · P ${Math.round(n.protein_g)}g · C ${Math.round(n.carbs_g)}g · F ${Math.round(n.fat_g)}g`;
}
