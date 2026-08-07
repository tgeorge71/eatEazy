import type { AcceptedMeal, GroceryItem } from "@/types/meal";

export function buildGroceryList(meals: AcceptedMeal[]): GroceryItem[] {
  const byName = new Map<string, GroceryItem>();

  for (const { slotLabel, meal } of meals) {
    for (const ingredient of meal.ingredients) {
      const key = ingredient.name.trim().toLowerCase();
      const existing = byName.get(key);
      const entry = { quantity: ingredient.quantity, slotLabel };
      if (existing) {
        existing.entries.push(entry);
      } else {
        byName.set(key, { name: ingredient.name.trim(), entries: [entry] });
      }
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatGroceryListAsText(items: GroceryItem[]): string {
  return items
    .map((item) => {
      const details = item.entries.map((e) => `${e.quantity} (${e.slotLabel})`).join(", ");
      return `- ${item.name}: ${details}`;
    })
    .join("\n");
}
