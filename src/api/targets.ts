import { sessionHeaders } from "@/api/googleHealth";
import { API_BASE_URL } from "@/config";
import type { FitnessProfile, Targets } from "@/health/fitness";
export async function fetchTargets(profile: FitnessProfile, includeSnack: boolean): Promise<Targets> {
    let response: Response;
    try {
        response = await fetch(`${API_BASE_URL}/nutrition/targets`, { method: "POST", headers: { "Content-Type": "application/json", ...await sessionHeaders() }, body: JSON.stringify({ profile, include_snack: includeSnack }) });
    }
    catch {
        throw new Error(`Cannot reach the backend at ${API_BASE_URL}. Start the Python server; on a phone use your computer's LAN address.`);
    }
    const data = await response.json();
    if (!response.ok)
        throw new Error(typeof data.detail === "string" ? data.detail : "Check your fitness profile and target values.");
    return data;
}
