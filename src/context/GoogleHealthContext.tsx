import React, { createContext, useContext, useState } from "react";
import { syncGoogleWorkouts, disconnectGoogleHealth } from "@/api/googleHealth";
import { upcomingDates } from "@/health/fitness";
import type { Workout } from "@/health/fitness";
const Context = createContext<{ workouts: Workout[]; sync: () => Promise<number>; disconnect: () => Promise<void>; clear: () => void } | null>(null);
export function GoogleHealthProvider({ children }: { children: React.ReactNode }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  async function sync() {
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - 6);
    const result = await syncGoogleWorkouts(upcomingDates(1, start)[0], upcomingDates(1,today)[0]);
    setWorkouts(result.workouts);
    return result.workouts.length;
  }
  async function disconnect() { await disconnectGoogleHealth(); setWorkouts([]); }
  return <Context.Provider value={{ workouts, sync, disconnect, clear: () => setWorkouts(previous => previous.length ? [] : previous) }}>{children}</Context.Provider>;
}
export function useGoogleHealth() { const value = useContext(Context); if (!value) throw new Error("Missing GoogleHealthProvider"); return value; }
