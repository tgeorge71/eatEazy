import { useState } from "react";
import { ScrollView, Text, TextInput, Switch, Pressable, StyleSheet, View } from "react-native";
import GoogleHealthConnection from "@/components/GoogleHealthConnection";
import ChipSelector from "@/components/ChipSelector";
import { useFitness } from "@/context/FitnessContext";
import { fetchTargets } from "@/api/targets";
import { convertMeasurements, upcomingDates, nutritionText } from "@/health/fitness";
import type { FitnessProfile, Nutrition, Workout } from "@/health/fitness";
export default function FitnessScreen() {
    const { loaded } = useFitness();
    if (!loaded) return <View style={{ padding: 24 }}><Text>Loading fitness settings…</Text></View>;
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
    return <ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.heading}>Fitness profile</Text>
    <Text>Targets apply to you. Ingredients still cover your household. Estimates support maintenance and workout fueling.</Text>
    {storageError && <Text>{storageError}</Text>}
    <Toggle label="Use inches and pounds" value={imperial} change={changeUnits}/>
    <Input label="Age (years)" value={age} change={setAge}/>
    <Input label={imperial ? "Height (inches)" : "Height (cm)"} value={height} change={setHeight}/>
    <Input label={imperial ? "Weight (lb)" : "Weight (kg)"} value={weight} change={setWeight}/>
    <Text>Sex coefficient for calorie equation</Text>
    <ChipSelector options={["female", "male"]} selected={[sex]} multiple={false} onChange={v => setSex((v[0] ?? sex) as typeof sex)}/>
    <Text>Usual activity (includes usual workouts)</Text>
    <ChipSelector options={["sedentary", "light", "moderate", "high"]} selected={[activity]} multiple={false} onChange={v => setActivity((v[0] ?? activity) as typeof activity)}/>
    <Text>Exercise calories are not added again.</Text>
    <Text>Goal</Text>
    <ChipSelector options={["balanced", "strength", "endurance"]} selected={[goal]} multiple={false} onChange={v => { const g = (v[0] ?? goal) as typeof goal; setGoal(g); setPercentages({ balanced: [50, 20, 30], strength: [45, 30, 25], endurance: [55, 20, 25] }[g].map(String)); }}/>
    <Toggle label="Pregnant or breastfeeding" value={pregnant} change={setPregnant}/>
    <Text>Automatic calculation is for adults who are not pregnant or breastfeeding. Otherwise enter supplied manual targets.</Text>
    <Toggle label="Override daily targets" value={manual} change={setManual}/>
    {manual ? (Object.keys(override) as (keyof Nutrition)[]).map(key => <Input key={key} label={key === "calories" ? "Daily calories (kcal)" : key.replace("_g", " (grams)")} value={override[key]} change={v => setOverride(prev => ({ ...prev, [key]: v }))}/>) : ["Carbohydrates %", "Protein %", "Fat %"].map((label, i) => <Input key={label} label={label} value={percentages[i]} change={v => setPercentages(prev => prev.map((x, j) => i === j ? v : x))}/>)}
    <Text>Macro percentages must total 100. These are editable prototype defaults, not individualized sports prescriptions.</Text>
    <Toggle label="Include daily snack" value={snack} change={setSnack}/>
    <Text style={styles.heading}>Seven-day workout schedule</Text>
    <Text>No entry means no workout information, not inactivity.</Text>
    {dates.map(date => <View key={date} style={styles.day}><Text style={styles.heading}>{date}</Text>
      {workouts.filter(w => w.local_date === date).map(w => <View key={w.id} style={styles.workout}>
        <Input label="Workout type" value={w.type} change={type => editWorkout(w.id, { type })} numeric={false}/>
        <Input label="Duration (minutes)" value={String(w.duration_minutes || "")} change={v => editWorkout(w.id, { duration_minutes: Number(v) })}/>
        <ChipSelector options={date > dates[0] ? ["planned"] : ["planned", "completed"]} selected={[w.status]} multiple={false} onChange={v => editWorkout(w.id, { status: (v[0] ?? w.status) as Workout["status"] })}/>
        <Button label="Remove workout" action={() => setWorkouts(prev => prev.filter(x => x.id !== w.id))}/>
      </View>)}
      <Button label="Add workout" action={() => setWorkouts(prev => [...prev, { id: `manual-${Date.now()}-${Math.random()}`, source: "manual", local_date: date, start_time: new Date(`${date}T12:00:00`).toISOString(), type: "", duration_minutes: 30, status: "planned" }])}/>
    </View>)}
    <Toggle label="Allow workout summaries to be sent to Claude for meal suggestions" value={consent} change={setConsent}/>
    <Text>Only workout date, type, duration and planned/completed status are sent. Turn this off to plan using nutrition targets only.</Text>
    <GoogleHealthConnection />
    <Button label={saving ? "Saving…" : "Save profile and schedule"} action={handleSave} disabled={saving}/>
    <Text accessibilityLiveRegion="polite">{message}</Text>
  </ScrollView>;
}
function Input({ label, value, change, numeric = true }: {
    label: string;
    value: string;
    change: (v: string) => void;
    numeric?: boolean;
}) { return <View><Text>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} value={value} onChangeText={change} keyboardType={numeric ? "decimal-pad" : "default"}/></View>; }
function Toggle({ label, value, change }: {
    label: string;
    value: boolean;
    change: (v: boolean) => void;
}) { return <View style={styles.toggle}><Text style={{ flex: 1 }}>{label}</Text><Switch accessibilityLabel={label} value={value} onValueChange={change}/></View>; }
function Button({ label, action, disabled = false }: {
    label: string;
    action: () => void;
    disabled?: boolean;
}) { return <Pressable style={[styles.button, disabled && { opacity: .5 }]} onPress={action} disabled={disabled}><Text style={{ color: "white" }}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ container: { padding: 20, gap: 14, paddingBottom: 50 }, heading: { fontSize: 18, fontWeight: "700" }, input: { borderWidth: 1, borderColor: "#aaa", borderRadius: 8, padding: 10, marginTop: 5 }, toggle: { flexDirection: "row", alignItems: "center", gap: 12 }, day: { gap: 10, borderTopWidth: 1, borderColor: "#ddd", paddingTop: 12 }, workout: { gap: 8, padding: 12, backgroundColor: "#f1f8f4", borderRadius: 8 }, button: { backgroundColor: "#2f6f4f", padding: 12, borderRadius: 8, alignItems: "center" } });
