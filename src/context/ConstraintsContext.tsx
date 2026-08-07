import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

import { DEFAULT_CONSTRAINTS } from "@/types/meal";
import type { Constraints } from "@/types/meal";

const STORAGE_KEY = "eateazy.constraints";

type ConstraintsContextValue = {
  constraints: Constraints;
  hasConstraints: boolean;
  isLoaded: boolean;
  saveConstraints: (next: Constraints) => Promise<void>;
};

const ConstraintsContext = createContext<ConstraintsContextValue | null>(null);

export function ConstraintsProvider({ children }: { children: ReactNode }) {
  const [constraints, setConstraints] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [hasConstraints, setHasConstraints] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        setConstraints(JSON.parse(raw));
        setHasConstraints(true);
      }
      setIsLoaded(true);
    });
  }, []);

  async function saveConstraints(next: Constraints) {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setConstraints(next);
    setHasConstraints(true);
  }

  return (
    <ConstraintsContext.Provider value={{ constraints, hasConstraints, isLoaded, saveConstraints }}>
      {children}
    </ConstraintsContext.Provider>
  );
}

export function useConstraints() {
  const ctx = useContext(ConstraintsContext);
  if (!ctx) throw new Error("useConstraints must be used within a ConstraintsProvider");
  return ctx;
}
