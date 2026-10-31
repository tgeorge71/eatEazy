import { sessionHeaders } from "@/api/googleHealth";
import { toApiConstraints } from "@/api/suggestions";
import { API_BASE_URL } from "@/config";
import type { Constraints, Recipe } from "@/types/meal";
export async function searchRecipes(query: string, constraints: Constraints): Promise<Recipe[]> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/recipes/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...await sessionHeaders() },
            body: JSON.stringify({ query, constraints: toApiConstraints(constraints) }),
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
    return data.recipes.map((recipe: any) => ({
        id: recipe.id,
        title: recipe.title,
        description: recipe.description,
        cookTimeMinutes: recipe.cook_time_minutes,
        cuisine: recipe.cuisine,
        servings: recipe.servings,
        tags: recipe.tags,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        nutrition: recipe.nutrition ?? undefined,
    }));
}
