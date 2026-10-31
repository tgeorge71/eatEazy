import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { googleHealthStatus, signOutGoogle } from "@/api/googleHealth";
import type { GoogleUser } from "@/api/googleHealth";

const Context = createContext<{
  user: GoogleUser | null; loaded: boolean; error: string | null;
  refresh: () => Promise<void>; signOut: () => Promise<void>;
} | null>(null);
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checking = useRef(false);
  const active = useRef(true);
  const generation = useRef(0);
  async function refresh() {
    if (checking.current) return;
    checking.current = true;
    const requestGeneration = generation.current;
    try {
      const status = await googleHealthStatus();
      if (active.current && requestGeneration === generation.current) { setUser(status.signed_in ? status.user ?? null : null); setError(status.error ?? null); }
    } catch (e: any) { if (active.current) setError(e.message); }
    finally { checking.current = false; if (active.current) setLoaded(true); }
  }
  useEffect(() => {
    active.current = true; refresh();
    const timer = setInterval(refresh, user ? 30000 : 3000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => { active.current = false; clearInterval(timer); subscription.remove(); };
  }, [user?.sub]);
  async function signOut() { await signOutGoogle(); generation.current++; setUser(null); setError(null); }
  return <Context.Provider value={{ user, loaded, error, refresh, signOut }}>{children}</Context.Provider>;
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error("Missing AuthProvider");
  return value;
}
