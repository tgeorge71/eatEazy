import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { fetchSuggestions } from "@/api/suggestions";
import MealOptionCard from "@/components/MealOptionCard";
import { useConstraints } from "@/context/ConstraintsContext";
import { usePlan } from "@/context/PlanContext";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { MealOption, MealSlotRequest } from "@/types/meal";

const MAX_REROLLS = 3;
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type SlotState = {
  label: string;
  options: MealOption[];
  rerollCount: number;
  acceptedMealId?: string;
};

type Props = NativeStackScreenProps<RootStackParamList, "Suggestions">;

function buildSlots(planType: "tonight" | "week"): MealSlotRequest[] {
  if (planType === "tonight") {
    return [{ id: "tonight", label: "Tonight" }];
  }
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    return { id: `day-${i}`, label: `${WEEKDAYS[date.getDay()]} dinner` };
  });
}

export default function SuggestionScreen({ route, navigation }: Props) {
  const { planType } = route.params;
  const { constraints } = useConstraints();
  const { acceptedMeals, acceptMeal } = usePlan();

  const slots = useMemo(() => buildSlots(planType), [planType]);

  const [slotsState, setSlotsState] = useState<Record<string, SlotState>>({});
  const [shownTitles, setShownTitles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [rerollingSlotId, setRerollingSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchSuggestions(constraints, slots, [])
      .then((results) => {
        if (cancelled) return;
        const next: Record<string, SlotState> = {};
        const titles: string[] = [];
        for (const slot of slots) {
          const result = results.find((r) => r.slotId === slot.id);
          const options = result?.options ?? [];
          next[slot.id] = { label: slot.label, options, rerollCount: 0 };
          titles.push(...options.map((o) => o.title));
        }
        setSlotsState(next);
        setShownTitles(titles);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load suggestions.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planType]);

  async function handleReroll(slotId: string) {
    const slot = slotsState[slotId];
    if (!slot || slot.rerollCount >= MAX_REROLLS) return;
    setRerollingSlotId(slotId);
    setError(null);
    try {
      const results = await fetchSuggestions(constraints, [{ id: slotId, label: slot.label }], shownTitles);
      const options = results.find((r) => r.slotId === slotId)?.options ?? [];
      setSlotsState((prev) => ({
        ...prev,
        [slotId]: { ...prev[slotId], options, rerollCount: prev[slotId].rerollCount + 1 },
      }));
      setShownTitles((prev) => [...prev, ...options.map((o) => o.title)]);
    } catch (err: any) {
      setError(err.message ?? "Failed to re-roll.");
    } finally {
      setRerollingSlotId(null);
    }
  }

  function handleAccept(slotId: string, meal: MealOption) {
    const slot = slotsState[slotId];
    if (!slot) return;
    setSlotsState((prev) => ({ ...prev, [slotId]: { ...prev[slotId], acceptedMealId: meal.id } }));
    acceptMeal(slotId, slot.label, meal);
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#2f6f4f" />
        <Text style={styles.loadingText}>Finding meals that fit your preferences…</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        {slots.map((slot) => {
          const state = slotsState[slot.id];
          if (!state) return null;
          const rerollsLeft = MAX_REROLLS - state.rerollCount;
          return (
            <View key={slot.id} style={styles.slotSection}>
              <Text style={styles.slotLabel}>{slot.label}</Text>
              <View style={styles.optionsList}>
                {state.options.map((option) => (
                  <MealOptionCard
                    key={option.id}
                    option={option}
                    isSelected={state.acceptedMealId === option.id}
                    onAccept={() => handleAccept(slot.id, option)}
                  />
                ))}
              </View>
              {!state.acceptedMealId && (
                <Pressable
                  style={[styles.rerollButton, rerollsLeft <= 0 && styles.rerollButtonDisabled]}
                  onPress={() => handleReroll(slot.id)}
                  disabled={rerollsLeft <= 0 || rerollingSlotId === slot.id}
                >
                  <Text style={styles.rerollButtonText}>
                    {rerollingSlotId === slot.id
                      ? "Re-rolling…"
                      : rerollsLeft > 0
                        ? `Re-roll (${rerollsLeft} left)`
                        : "No re-rolls left"}
                  </Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </ScrollView>
      {acceptedMeals.length > 0 && (
        <Pressable style={styles.groceryButton} onPress={() => navigation.navigate("GroceryList")}>
          <Text style={styles.groceryButtonText}>View grocery list ({acceptedMeals.length})</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 28,
    paddingBottom: 100,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: "#666",
  },
  errorText: {
    color: "#b3261e",
    textAlign: "center",
  },
  slotSection: {
    gap: 12,
  },
  slotLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  optionsList: {
    gap: 12,
  },
  rerollButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#2f6f4f",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  rerollButtonDisabled: {
    borderColor: "#ccc",
  },
  rerollButtonText: {
    color: "#2f6f4f",
    fontWeight: "600",
  },
  groceryButton: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: "#2f6f4f",
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: "center",
  },
  groceryButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
