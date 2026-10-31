import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import type { FitnessProfile, Workout } from "@/health/fitness";
export type FitnessSettings = {
    profile: FitnessProfile | null;
    workouts: Workout[];
    includeSnack: boolean;
    workoutConsent: boolean;
};
const defaults: FitnessSettings = { profile: null, workouts: [], includeSnack: true, workoutConsent: false };
const KEY = "eateazy.fitness.v1";
const Context = createContext<{
    settings: FitnessSettings;
    loaded: boolean;
    storageError: string | null;
    save: (s: FitnessSettings) => Promise<void>;
} | null>(null);
export function FitnessProvider({ children, accountId }: {
    accountId: string;
    children: React.ReactNode;
}) {
    const storageKey = `${KEY}.${accountId}`;
    const [settings, setSettings] = useState(defaults);
    const [loaded, setLoaded] = useState(false);
    const [storageError, setStorageError] = useState<string | null>(null);
    useEffect(() => {
        AsyncStorage.getItem(storageKey).then(raw => {
            if (raw) {
                const parsed = JSON.parse(raw);
                if (!Array.isArray(parsed.workouts))
                    throw new Error();
                setSettings({ ...defaults, ...parsed });
            }
        }).catch(() => setStorageError("Could not load your fitness settings. Save them again to recover."))
            .finally(() => setLoaded(true));
    }, [storageKey]);
    async function save(s: FitnessSettings) { await AsyncStorage.setItem(storageKey, JSON.stringify(s)); setSettings(s); setStorageError(null); }
    return <Context.Provider value={{ settings, loaded, storageError, save }}>{children}</Context.Provider>;
}
export function useFitness() { const value = useContext(Context); if (!value)
    throw new Error("Missing FitnessProvider"); return value; }
