import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchSuggestions } from "@/api/suggestions";
import { fetchTargets } from "@/api/targets";
import MealOptionCard from "@/components/MealOptionCard";
import { useConstraints } from "@/context/ConstraintsContext";
import { usePlan } from "@/context/PlanContext";
import { useGoogleHealth } from "@/context/GoogleHealthContext";
import { useFitness } from "@/context/FitnessContext";
import { manualWorkoutProvider, nutritionText } from "@/health/fitness";
import { buildPlanSlots, sumSelectedNutrition } from "@/health/planning";
import type { Targets } from "@/health/fitness";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import type { MealOption, MealSlotRequest } from "@/types/meal";
type Day = {
    date: string;
    slots: MealSlotRequest[];
    loading: boolean;
    error?: string;
};
type SlotState = {
    options: MealOption[];
    rerolls: number;
    acceptedId?: string;
    error?: string;
};
type Props = NativeStackScreenProps<RootStackParamList, "Suggestions">;
const MAX_REROLLS = 3;
export default function SuggestionScreen({ route, navigation }: Props) {
    const { planType } = route.params;
    const { constraints } = useConstraints();
    const { settings, loaded } = useFitness();
    const { workouts: googleWorkouts } = useGoogleHealth();
    const { acceptedMeals, acceptMeal, clearPlan } = usePlan();
    const [days, setDays] = useState<Day[]>([]);
    const [states, setStates] = useState<Record<string, SlotState>>({});
    const [targets, setTargets] = useState<Targets>();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string>();
    const [reload, setReload] = useState(0);
    const [busy, setBusy] = useState<string[]>([]);
    const seen = useRef<string[]>([]);
    const generation = useRef(0);
    const busyRef = useRef(new Set<string>());
    async function request(slots: MealSlotRequest[], currentTargets?: Targets) {
        const workouts = settings.workoutConsent ? await manualWorkoutProvider([...settings.workouts, ...googleWorkouts]).read(slots.map(s => s.local_date!)) : [];
        return fetchSuggestions(constraints, slots, seen.current, settings.profile && currentTargets ? { goal: settings.profile.goal, daily_target: currentTargets.daily, workouts, consent: settings.workoutConsent } : undefined);
    }
    async function loadDay(day: Day, currentTargets: Targets | undefined, token: number) {
        if (busyRef.current.has(day.date))
            return;
        busyRef.current.add(day.date);
        setDays(prev => prev.map(d => d.date === day.date ? { ...d, loading: true, error: undefined } : d));
        try {
            const results = await request(day.slots, currentTargets);
            if (generation.current !== token)
                return;
            const additions: Record<string, SlotState> = {};
            for (const slot of day.slots) {
                const options = results.find(r => r.slotId === slot.id)?.options;
                if (!options || options.length !== 3)
                    throw new Error("The AI returned an incomplete day. Retry this day.");
                additions[slot.id] = { options, rerolls: 0 };
            }
            seen.current.push(...Object.values(additions).flatMap(s => s.options.map(o => o.title)));
            setStates(prev => ({ ...prev, ...additions }));
        }
        catch (e: any) {
            if (generation.current === token)
                setDays(prev => prev.map(d => d.date === day.date ? { ...d, error: e.message ?? "Could not load meals." } : d));
        }
        finally {
            if (generation.current === token) {
                busyRef.current.delete(day.date);
                setDays(prev => prev.map(d => d.date === day.date ? { ...d, loading: false } : d));
            }
        }
    }
    useEffect(() => {
        if (!loaded)
            return;
        const token = ++generation.current;
        clearPlan();
        busyRef.current.clear();
        seen.current = [];
        setBusy([]);
        setLoading(true);
        setError(undefined);
        setStates({});
        setDays([]);
        setTargets(undefined);
        (async () => {
            try {
                if (!settings.profile && planType !== "tonight")
                    throw new Error("Save your fitness profile before planning a full day.");
                const currentTargets = settings.profile ? await fetchTargets(settings.profile, settings.includeSnack) : undefined;
                if (generation.current !== token)
                    return;
                setTargets(currentTargets);
                const slots = buildPlanSlots(planType, currentTargets, settings.includeSnack);
                const next = Array.from(new Set(slots.map(s => s.local_date!))).map(date => ({ date, slots: slots.filter(s => s.local_date === date), loading: true }));
                setDays(next);
                setLoading(false);
                for (const day of next) {
                    if (generation.current !== token)
                        return;
                    await loadDay(day, currentTargets, token);
                }
            }
            catch (e: any) {
                if (generation.current === token) {
                    setError(e.message ?? "Could not plan meals.");
                    setLoading(false);
                }
            }
        })();
        return () => { generation.current++; };
    }, [planType, loaded, settings, constraints, reload, googleWorkouts]);
    async function reroll(slot: MealSlotRequest) {
        const current = states[slot.id];
        if (!current || current.rerolls >= MAX_REROLLS || busyRef.current.has(slot.id))
            return;
        const token = generation.current;
        busyRef.current.add(slot.id);
        setBusy(prev => [...prev, slot.id]);
        setStates(prev => ({ ...prev, [slot.id]: { ...prev[slot.id], error: undefined } }));
        try {
            const results = await request([slot], targets);
            if (generation.current !== token)
                return;
            const options = results.find(r => r.slotId === slot.id)?.options;
            if (!options || options.length !== 3)
                throw new Error("Incomplete suggestions. Try again.");
            seen.current.push(...options.map(o => o.title));
            setStates(prev => ({ ...prev, [slot.id]: { options, rerolls: prev[slot.id].rerolls + 1 } }));
        }
        catch (e: any) {
            if (generation.current === token)
                setStates(prev => ({ ...prev, [slot.id]: { ...prev[slot.id], error: e.message } }));
        }
        finally {
            if (generation.current === token) {
                busyRef.current.delete(slot.id);
                setBusy(prev => prev.filter(id => id !== slot.id));
            }
        }
    }
    if (loading)
        return <View style={styles.center}><ActivityIndicator /><Text>Calculating targets…</Text></View>;
    if (error)
        return <View style={styles.center}><Text style={styles.error}>{error}</Text><Button label="Retry" action={() => setReload(n => n + 1)}/><Button label="Edit fitness profile" action={() => navigation.navigate("Fitness")}/></View>;
    const finished = days.filter(d => !d.loading).length;
    return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={styles.container}>
    <Text style={styles.heading}>{planType === "week" ? `Weekly progress: ${finished}/${days.length} days processed` : "Choose your meals"}</Text>
    <Text>Nutrition is AI-estimated per serving. Totals describe planned food, not recorded consumption.</Text>
    {targets && <Text>Daily target: {nutritionText(targets.daily)} ({targets.source})</Text>}
    {settings.profile && <Text>{settings.workoutConsent ? "Using available manual and synced Google workout summaries." : "Workout sharing is off; using nutrition targets only."}</Text>}
    {days.map(day => {
            const selected = acceptedMeals.filter(m => day.slots.some(s => s.id === m.slotId));
            const total = sumSelectedNutrition(day.slots, acceptedMeals);
            return <View key={day.date} style={styles.day}>
        <Text style={styles.heading}>{day.date}</Text>
        <Text>{selected.length}/{day.slots.length} meals selected · {selected.length === day.slots.length ? "Complete" : "Incomplete"}</Text>
        <Text>Selected totals: {nutritionText(total)}</Text>
        {targets && <Text>Difference from daily target: {Math.round(total.calories - targets.daily.calories)} kcal · P {Math.round(total.protein_g - targets.daily.protein_g)}g · C {Math.round(total.carbs_g - targets.daily.carbs_g)}g · F {Math.round(total.fat_g - targets.daily.fat_g)}g{planType === "tonight" ? " (dinner only; other meals are not included)" : ""}</Text>}
        {day.loading && <View><ActivityIndicator /><Text>Finding meals for this day…</Text></View>}
        {day.error && <><Text style={styles.error}>{day.error}</Text><Button label="Retry this day" action={() => loadDay(day, targets, generation.current)}/></>}
        {!day.loading && !day.error && day.slots.map(slot => {
                    const state = states[slot.id];
                    if (!state)
                        return null;
                    return <View key={slot.id} style={styles.slot}>
            <Text style={styles.heading}>{slot.label}</Text>
            {slot.target && <Text>Meal target: {nutritionText(slot.target)}</Text>}
            {state.options.map(option => <MealOptionCard key={option.id} option={option} isSelected={state.acceptedId === option.id} disabled={busy.includes(slot.id)} onAccept={() => {
                                if (busyRef.current.has(slot.id)) return; setStates(prev => ({ ...prev, [slot.id]: { ...prev[slot.id], acceptedId: option.id } })); acceptMeal(slot.id, slot.label, option); }}/>)}
            {state.error && <Text style={styles.error}>{state.error}</Text>}
            {!state.acceptedId && <Button label={busy.includes(slot.id) ? "Re-rolling…" : `Re-roll (${MAX_REROLLS - state.rerolls} left)`} disabled={busy.includes(slot.id) || state.rerolls >= MAX_REROLLS} action={() => reroll(slot)}/>}
          </View>;
                })}
      </View>;
        })}
  </ScrollView>{acceptedMeals.length > 0 && <View style={{ padding: 16 }}><Button label={`View grocery list (${acceptedMeals.length} meals)`} action={() => navigation.navigate("GroceryList")}/></View>}</View>;
}
function Button({ label, action, disabled = false }: {
    label: string;
    action: () => void;
    disabled?: boolean;
}) { return <Pressable onPress={action} disabled={disabled} style={[styles.button, disabled && { opacity: .5 }]}><Text style={{ color: "white", textAlign: "center" }}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ container: { padding: 20, gap: 16, paddingBottom: 40 }, center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 }, heading: { fontSize: 18, fontWeight: "700" }, day: { gap: 10, borderTopWidth: 1, borderColor: "#ddd", paddingTop: 14 }, slot: { gap: 12, marginVertical: 12 }, error: { color: "#b3261e" }, button: { backgroundColor: "#2f6f4f", padding: 12, borderRadius: 8 } });
