import type { MealSlotRequest, AcceptedMeal } from "@/types/meal";
import { upcomingDates, EMPTY_NUTRITION } from "./fitness";
import type { Targets, MealType, Nutrition } from "./fitness";
export function buildPlanSlots(planType: "tonight" | "today" | "week", targets?: Targets, includeSnack = true, today = new Date()): MealSlotRequest[] {
    return upcomingDates(planType === "week" ? 7 : 1, today).flatMap(date => {
        const types: MealType[] = planType === "tonight" ? ["dinner"] : includeSnack ? ["breakfast", "lunch", "dinner", "snack"] : ["breakfast", "lunch", "dinner"];
        return types.map(type => ({ id: `${date}-${type}`, label: planType === "tonight" ? "Tonight's dinner" : `${date} ${type}`, local_date: date, meal_type: type, target: targets?.meals[type] }));
    });
}
export function sumSelectedNutrition(slots: MealSlotRequest[], accepted: AcceptedMeal[]): Nutrition {
    const ids = new Set(slots.map(s => s.id));
    return accepted.filter(m => ids.has(m.slotId)).reduce((sum, m) => {
        const n = m.meal.nutrition;
        if (n)
            for (const key of Object.keys(sum) as (keyof Nutrition)[])
                sum[key] += n[key];
        return sum;
    }, { ...EMPTY_NUTRITION });
}
