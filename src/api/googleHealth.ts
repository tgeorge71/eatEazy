import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "@/config";
import type { Workout } from "@/health/fitness";

// This is an app device credential, never a Google access/refresh token.
const KEY = "eateazy.google-health-device.v1";
export type GoogleUser = { sub: string; email: string; name: string };
export type GoogleHealthStatus = { signed_in?: boolean; user?: GoogleUser | null; connected: boolean; has_grant: boolean; pending: boolean; error?: string | null; last_synced?: string | null };
export const DISCONNECTED: GoogleHealthStatus = { connected: false, has_grant: false, pending: false };
let creating: Promise<string> | null = null;
async function readToken(): Promise<string | null> {
  return Platform.OS === "web" ? window.sessionStorage.getItem(KEY) : SecureStore.getItemAsync(KEY);
}
async function writeToken(token: string | null) {
  if (Platform.OS === "web") {
    if (token) window.sessionStorage.setItem(KEY, token); else window.sessionStorage.removeItem(KEY);
  } else {
    if (token) await SecureStore.setItemAsync(KEY, token); else await SecureStore.deleteItemAsync(KEY);
  }
}
async function request<T>(path: string, method = "GET", token?: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 120000);
  try {
    const response = await fetch(`${API_BASE_URL}/google-health${path}`, {
      method, signal: controller.signal, headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(typeof data.detail === "string" ? data.detail : "Google Health request failed.");
      Object.assign(error, { status: response.status });
      throw error;
    }
    return data;
  } catch (error: any) {
    if (error.status) throw error;
    throw new Error("Could not reach Google Health through your backend. Check the server and connection.");
  } finally { clearTimeout(timer); }
}
export async function googleHealthConfig() {
  return request<{ available: boolean; message: string }>("/config");
}
async function deviceToken() {
  const current = await readToken();
  if (current) return current;
  if (!creating) creating = (async () => {
    const device = await request<{ token: string }>("/device", "POST");
    await writeToken(device.token);
    return device.token;
  })().finally(() => { creating = null; });
  return creating;
}
export async function googleHealthStatus(): Promise<GoogleHealthStatus> {
  const token = await readToken();
  if (!token) return DISCONNECTED;
  try { return await request<GoogleHealthStatus>("/status", "GET", token); }
  catch (error: any) { if (error.status === 401) { await writeToken(null); return DISCONNECTED; } throw error; }
}
export async function authorizeGoogleHealth() {
  const token = await readToken();
  if (!token) throw new Error("Sign in with Google first.");
  return request<{ url: string }>("/authorize", "POST", token);
}
export async function syncGoogleWorkouts(start: string, end: string) {
  const token = await readToken();
  if (!token) throw new Error("Connect Google Health first.");
  return request<{ workouts: Workout[]; synced_at: string }>(`/workouts?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, "GET", token);
}
export async function disconnectGoogleHealth() {
  const token = await readToken();
  if (token) await request("/connection", "DELETE", token);
}

export async function authorizeGoogleLogin() {
  try { return await request<{ url: string }>("/login", "POST", await deviceToken()); }
  catch (error: any) {
    if (error.status !== 401) throw error;
    await writeToken(null);
    return request<{ url: string }>("/login", "POST", await deviceToken());
  }
}
export async function signOutGoogle() {
  const token = await readToken();
  if (token) {
    try { await request("/session", "DELETE", token); }
    catch (error: any) { if (error.status !== 401) throw error; }
  }
  await writeToken(null);
}
export async function sessionHeaders(): Promise<Record<string, string>> {
  const token = await readToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
