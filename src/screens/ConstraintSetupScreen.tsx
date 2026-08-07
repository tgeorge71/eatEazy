import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import ChipSelector from "@/components/ChipSelector";
import TagInput from "@/components/TagInput";
import { useConstraints } from "@/context/ConstraintsContext";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { BudgetTier, Constraints } from "@/types/meal";

const BUDGET_TIERS: BudgetTier[] = ["low", "medium", "high"];
const COOK_TIME_OPTIONS = ["15", "30", "45", "60", "90"];
const CUISINE_OPTIONS = [
  "Italian",
  "Mexican",
  "Chinese",
  "Indian",
  "Thai",
  "Japanese",
  "Mediterranean",
  "American",
  "French",
  "Korean",
  "Vietnamese",
  "Middle Eastern",
];

type Props = NativeStackScreenProps<RootStackParamList, "ConstraintSetup">;

export default function ConstraintSetupScreen({ navigation }: Props) {
  const { constraints, saveConstraints } = useConstraints();
  const [form, setForm] = useState<Constraints>(constraints);

  function update<K extends keyof Constraints>(key: K, value: Constraints[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    await saveConstraints(form);
    navigation.navigate("Home");
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Field label="Dietary restrictions">
        <TagInput
          tags={form.dietaryRestrictions}
          onChange={(v) => update("dietaryRestrictions", v)}
          placeholder="e.g. vegetarian, gluten-free"
        />
      </Field>

      <Field label="Allergies">
        <TagInput
          tags={form.allergies}
          onChange={(v) => update("allergies", v)}
          placeholder="e.g. peanuts, shellfish"
        />
      </Field>

      <Field label="Disliked ingredients">
        <TagInput
          tags={form.dislikedIngredients}
          onChange={(v) => update("dislikedIngredients", v)}
          placeholder="e.g. cilantro, mushrooms"
        />
      </Field>

      <Field label="Budget tier">
        <ChipSelector
          options={BUDGET_TIERS}
          selected={[form.budgetTier]}
          multiple={false}
          onChange={(v) => update("budgetTier", (v[0] as BudgetTier) ?? form.budgetTier)}
        />
      </Field>

      <Field label="Max cook time (minutes)">
        <ChipSelector
          options={COOK_TIME_OPTIONS}
          selected={[String(form.maxCookTimeMinutes)]}
          multiple={false}
          onChange={(v) => update("maxCookTimeMinutes", Number(v[0] ?? form.maxCookTimeMinutes))}
        />
      </Field>

      <Field label="Household size">
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepperButton}
            onPress={() => update("householdSize", Math.max(1, form.householdSize - 1))}
          >
            <Text style={styles.stepperButtonText}>−</Text>
          </Pressable>
          <Text style={styles.stepperValue}>{form.householdSize}</Text>
          <Pressable
            style={styles.stepperButton}
            onPress={() => update("householdSize", form.householdSize + 1)}
          >
            <Text style={styles.stepperButtonText}>+</Text>
          </Pressable>
        </View>
      </Field>

      <Field label="Preferred cuisines">
        <ChipSelector
          options={CUISINE_OPTIONS}
          selected={form.preferredCuisines}
          onChange={(v) => update("preferredCuisines", v)}
        />
      </Field>

      <Field label="Cuisines to avoid">
        <ChipSelector
          options={CUISINE_OPTIONS}
          selected={form.avoidedCuisines}
          onChange={(v) => update("avoidedCuisines", v)}
        />
      </Field>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    fontWeight: "600",
    color: "#333",
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  stepperButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#eee",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperButtonText: {
    fontSize: 20,
    fontWeight: "600",
  },
  stepperValue: {
    fontSize: 18,
    fontWeight: "600",
    minWidth: 24,
    textAlign: "center",
  },
  saveButton: {
    backgroundColor: "#2f6f4f",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 12,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
});
