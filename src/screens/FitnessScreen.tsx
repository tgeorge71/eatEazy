import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import GoogleHealthConnection from "@/components/GoogleHealthConnection";
import ChipSelector from "@/components/ChipSelector";
import { Body, Card, Field, Heading, PillButton, ThemedInput, Toggle, ui } from "@/components/ui";
import { useFitness } from "@/context/FitnessContext";
import { fetchTargets } from "@/api/targets";
import { convertMeasurements, upcomingDates, nutritionText } from "@/health/fitness";
import type { FitnessProfile, Nutrition, Workout } from "@/health/fitness";
export default function FitnessScreen() {
    const { loaded } = useFitness();
    if (!loaded) return <View style={ui.screen}><Body>Loading fitness settings…</Body></View>;
    return <FitnessForm />;
}
function FitnessForm() {
    const { settings, save, storageError } = useFitness();
    const p = settings.profile;
    const [imperial, setImperial] = useState(false);
    const [age, setAge] = useState(String(p?.age ?? ""));
    const [height, setHeight] = useState(String(p?.height_cm ?? ""));
    const [weight, setWeight] = useState(String(p?.weight_kg ?? ""));
    const [sex, setSex] = useState<FitnessProfile["sex_coefficient"]>(p?.sex_coefficient ?? "female");
    const [activity, setActivity] = useState<FitnessProfile["activity"]>(p?.activity ?? "light");
    const [goal, setGoal] = useState<FitnessProfile["goal"]>(p?.goal ?? "balanced");
    const [pregnant, setPregnant] = useState(p?.pregnant_or_breastfeeding ?? false);
    const [manual, setManual] = useState(Boolean(p?.override));
    const [override, setOverride] = useState<Record<keyof Nutrition, string>>({ calories: String(p?.override?.calories ?? ""), protein_g: String(p?.override?.protein_g ?? ""), carbs_g: String(p?.override?.carbs_g ?? ""), fat_g: String(p?.override?.fat_g ?? "") });
    const [percentages, setPercentages] = useState((p?.macro_percentages ?? { balanced: [50, 20, 30], strength: [45, 30, 25], endurance: [55, 20, 25] }[goal]).map(String));
    const [snack, setSnack] = useState(settings.includeSnack);
    const [consent, setConsent] = useState(settings.workoutConsent);
    const [workouts, setWorkouts] = useState(settings.workouts);
    const [message, setMessage] = useState("");
    const [saving, setSaving] = useState(false);
    const dates = upcomingDates();
    function changeUnits(next: boolean) {
        if (height)
            setHeight(String(Number((Number(height) * (next ? 1 / 2.54 : 2.54)).toFixed(2))));
        if (weight)
            setWeight(String(Number((Number(weight) * (next ? 1 / 0.45359237 : 0.45359237)).toFixed(2))));
        setImperial(next);
    }
    async function handleSave() {
        setSaving(true);
        setMessage("");
        try {
            const profile: FitnessProfile = { age: Number(age), ...convertMeasurements(Number(height), Number(weight), imperial), sex_coefficient: sex, activity, goal, pregnant_or_breastfeeding: pregnant, macro_percentages: percentages.map(Number) };
            if (manual)
                profile.override = Object.fromEntries(Object.entries(override).map(([k, v]) => [k, Number(v)])) as Nutrition;
            if (workouts.some(w => !w.type.trim() || w.type.trim().length > 80 || !Number.isFinite(w.duration_minutes) || w.duration_minutes <= 0 || w.duration_minutes > 1440))
                throw new Error("Each workout needs a type of up to 80 characters and duration from 1 to 1440 minutes.");
            if (workouts.some(w => w.status === "completed" && w.local_date > dates[0]))
                throw new Error("Future workouts must be marked planned.");
            const targets = await fetchTargets(profile, snack);
            await save({ profile, workouts, includeSnack: snack, workoutConsent: consent });
            setMessage(`Saved. Daily target: ${nutritionText(targets.daily)}`);
        }
        catch (e: any) {
            setMessage(e.message ?? "Could not save.");
        }
        finally {
            setSaving(false);
        }
    }
    function editWorkout(id: string, update: Partial<Workout>) { setWorkouts(prev => prev.map(w => w.id === id ? { ...w, ...update } : w)); }
    const macroDefaults = { balanced: [50, 20, 30], strength: [45, 30, 25], endurance: [55, 20, 25] };
    return <ScrollView contentContainerStyle={ui.screen}>
    <Body fine>Targets apply to you. Ingredients still cover your household. Estimates support maintenance and workout fueling.</Body>
    {storageError && <Body error>{storageError}</Body>}

    <Card>
      <Heading>Fitness profile</Heading>
      <Toggle label="Use inches and pounds" value={imperial} change={changeUnits}/>
      <Input label="Age (years)" value={age} change={setAge}/>
      <Input label={imperial ? "Height (inches)" : "Height (cm)"} value={height} change={setHeight}/>
      <Input label={imperial ? "Weight (lb)" : "Weight (kg)"} value={weight} change={setWeight}/>
      <Field label="Sex coefficient for calorie equation">
        <ChipSelector options={["female", "male"]} selected={[sex]} multiple={false} onChange={v => setSex((v[0] ?? sex) as typeof sex)}/>
      </Field>
      <Field label="Usual activity (includes usual workouts)">
        <ChipSelector options={["sedentary", "light", "moderate", "high"]} selected={[activity]} multiple={false} onChange={v => setActivity((v[0] ?? activity) as typeof activity)}/>
        <Body fine>Exercise calories are not added again.</Body>
      </Field>
      <Field label="Goal">
        <ChipSelector options={["balanced", "strength", "endurance"]} selected={[goal]} multiple={false} onChange={v => { const g = (v[0] ?? goal) as typeof goal; setGoal(g); setPercentages(macroDefaults[g].map(String)); }}/>
      </Field>
      <Toggle label="Pregnant or breastfeeding" value={pregnant} change={setPregnant}/>
      <Body fine>Automatic calculation is for adults who are not pregnant or breastfeeding. Otherwise enter supplied manual targets.</Body>
    </Card>

    <Card>
      <Heading>Daily targets</Heading>
      <Toggle label="Override daily targets" value={manual} change={setManual}/>
      {manual ? (Object.keys(override) as (keyof Nutrition)[]).map(key => <Input key={key} label={key === "calories" ? "Daily calories (kcal)" : key.replace("_g", " (grams)")} value={override[key]} change={v => setOverride(prev => ({ ...prev, [key]: v }))}/>) : <View style={styles.macroRow}>{["Carbohydrates %", "Protein %", "Fat %"].map((label, i) => <View key={label} style={{ flex: 1 }}><Input label={label} value={percentages[i]} change={v => setPercentages(prev => prev.map((x, j) => i === j ? v : x))}/></View>)}</View>}
      <Body fine>Macro percentages must total 100. These are editable prototype defaults, not individualized sports prescriptions.</Body>
      <Toggle label="Include daily snack" value={snack} change={setSnack}/>
    </Card>

    <Card>
      <Heading>Seven-day workout schedule</Heading>
      <Body fine>No entry means no workout information, not inactivity.</Body>
      {dates.map(date => <View key={date} style={styles.day}>
        <Text style={ui.label}>{date}</Text>
        {workouts.filter(w => w.local_date === date).map(w => <View key={w.id} style={styles.workout}>
          <Input label="Workout type" value={w.type} change={type => editWorkout(w.id, { type })} numeric={false}/>
          <Input label="Duration (minutes)" value={String(w.duration_minutes || "")} change={v => editWorkout(w.id, { duration_minutes: Number(v) })}/>
          <ChipSelector options={date > dates[0] ? ["planned"] : ["planned", "completed"]} selected={[w.status]} multiple={false} onChange={v => editWorkout(w.id, { status: (v[0] ?? w.status) as Workout["status"] })}/>
          <PillButton secondary label="Remove workout" onPress={() => setWorkouts(prev => prev.filter(x => x.id !== w.id))}/>
        </View>)}
        <PillButton secondary label="+ Add workout" onPress={() => setWorkouts(prev => [...prev, { id: `manual-${Date.now()}-${Math.random()}`, source: "manual", local_date: date, start_time: new Date(`${date}T12:00:00`).toISOString(), type: "", duration_minutes: 30, status: "planned" }])}/>
      </View>)}
    </Card>

    <Card>
      <Heading>Sharing with Claude</Heading>
      <Toggle label="Allow workout summaries to be sent to Claude for meal suggestions" value={consent} change={setConsent}/>
      <Body fine>Only workout date, type, duration and planned/completed status are sent. Turn this off to plan using nutrition targets only.</Body>
    </Card>

    <GoogleHealthConnection />
    <PillButton label={saving ? "Saving…" : "Save profile and schedule"} onPress={handleSave} disabled={saving}/>
    <Text accessibilityLiveRegion="polite" style={[ui.body, { textAlign: "center" }]}>{message}</Text>
  </ScrollView>;
}
function Input({ label, value, change, numeric = true }: {
    label: string;
    value: string;
    change: (v: string) => void;
    numeric?: boolean;
}) { return <Field label={label}><ThemedInput accessibilityLabel={label} value={value} onChangeText={change} keyboardType={numeric ? "decimal-pad" : "default"}/></Field>; }
const styles = StyleSheet.create({
    macroRow: { flexDirection: "row", gap: 10 },
    day: { gap: 10, borderTopWidth: 1, borderColor: "rgba(43,29,20,0.1)", paddingTop: 12 },
    workout: { gap: 10, padding: 14, backgroundColor: "rgba(94,158,110,0.12)", borderRadius: 16 },
});
