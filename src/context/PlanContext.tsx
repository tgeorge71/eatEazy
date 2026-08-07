import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";

import type { AcceptedMeal, MealOption } from "@/types/meal";

type PlanContextValue = {
  acceptedMeals: AcceptedMeal[];
  acceptMeal: (slotId: string, slotLabel: string, meal: MealOption) => void;
  clearPlan: () => void;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [acceptedMeals, setAcceptedMeals] = useState<AcceptedMeal[]>([]);

  function acceptMeal(slotId: string, slotLabel: string, meal: MealOption) {
    setAcceptedMeals((prev) => [...prev.filter((m) => m.slotId !== slotId), { slotId, slotLabel, meal }]);
  }

  function clearPlan() {
    setAcceptedMeals([]);
  }

  return (
    <PlanContext.Provider value={{ acceptedMeals, acceptMeal, clearPlan }}>{children}</PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within a PlanProvider");
  return ctx;
}
