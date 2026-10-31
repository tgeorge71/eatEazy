import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import ChipSelector from "@/components/ChipSelector";
import TagInput from "@/components/TagInput";
import { Body, Card, Field, Heading, PillButton, ui } from "@/components/ui";
import { INK } from "@/theme";
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
    <ScrollView contentContainerStyle={ui.screen}>
      <Body fine>Set these once. Recipes and meal plans always respect your allergies, diet and cook time.</Body>

      <Card>
        <Heading>Diet & allergies</Heading>
        <Field label="Dietary restrictions">
          <TagInput tags={form.dietaryRestrictions} onChange={(v) => update("dietaryRestrictions", v)} placeholder="e.g. vegetarian, gluten-free" />
        </Field>
        <Field label="Allergies">
          <TagInput tags={form.allergies} onChange={(v) => update("allergies", v)} placeholder="e.g. peanuts, shellfish" />
        </Field>
        <Field label="Disliked ingredients">
          <TagInput tags={form.dislikedIngredients} onChange={(v) => update("dislikedIngredients", v)} placeholder="e.g. cilantro, mushrooms" />
        </Field>
      </Card>

      <Card>
        <Heading>Budget & time</Heading>
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
              accessibilityRole="button"
              accessibilityLabel="Fewer people"
              style={({ pressed }) => [styles.stepperButton, pressed && ui.pressed]}
              onPress={() => update("householdSize", Math.max(1, form.householdSize - 1))}
            >
              <Text style={styles.stepperButtonText}>−</Text>
            </Pressable>
            <Text accessibilityLiveRegion="polite" style={styles.stepperValue}>{form.householdSize}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="More people"
              style={({ pressed }) => [styles.stepperButton, pressed && ui.pressed]}
              onPress={() => update("householdSize", form.householdSize + 1)}
            >
              <Text style={styles.stepperButtonText}>+</Text>
            </Pressable>
          </View>
        </Field>
      </Card>

      <Card>
        <Heading>Cuisines</Heading>
        <Field label="Preferred cuisines">
          <ChipSelector options={CUISINE_OPTIONS} selected={form.preferredCuisines} onChange={(v) => update("preferredCuisines", v)} />
        </Field>
        <Field label="Cuisines to avoid">
          <ChipSelector options={CUISINE_OPTIONS} selected={form.avoidedCuisines} onChange={(v) => update("avoidedCuisines", v)} />
        </Field>
      </Card>

      <PillButton label="Save preferences" onPress={handleSave} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  stepper: { flexDirection: "row", alignItems: "center", gap: 18 },
  stepperButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
  stepperButtonText: { fontSize: 22, fontWeight: "700", color: "white" },
  stepperValue: { fontSize: 22, fontWeight: "800", minWidth: 28, textAlign: "center", color: INK },
});
