import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { fetchSuggestions } from "@/api/suggestions";
import { fetchTargets } from "@/api/targets";
import MealOptionCard from "@/components/MealOptionCard";
import { Body, Card, Heading, PillButton, ui } from "@/components/ui";
import { CREAM, INK } from "@/theme";
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
        return <View style={styles.center}><ActivityIndicator color={INK}/><Body>Calculating targets…</Body></View>;
    if (error)
        return <View style={styles.center}><Body error style={{ textAlign: "center" }}>{error}</Body><PillButton label="Retry" onPress={() => setReload(n => n + 1)} style={styles.centerButton}/><PillButton secondary label="Edit fitness profile" onPress={() => navigation.navigate("Fitness")} style={styles.centerButton}/></View>;
    const finished = days.filter(d => !d.loading).length;
    return <View style={{ flex: 1 }}><ScrollView contentContainerStyle={ui.screen}>
    <Heading size={30}>{planType === "week" ? `Your week · ${finished}/${days.length} days ready` : planType === "today" ? "Plan your day" : "Pick tonight's dinner"}</Heading>
    <Card style={styles.summary}>
      {targets && <Body><Text style={ui.label}>Daily target </Text>{nutritionText(targets.daily)} ({targets.source})</Body>}
      {settings.profile && <Body fine>{settings.workoutConsent ? "Using available manual and synced Google workout summaries." : "Workout sharing is off; using nutrition targets only."}</Body>}
      <Body fine>Nutrition is AI-estimated per serving. Totals describe planned food, not recorded consumption.</Body>
    </Card>
    {days.map(day => {
            const selected = acceptedMeals.filter(m => day.slots.some(s => s.id === m.slotId));
            const total = sumSelectedNutrition(day.slots, acceptedMeals);
            const complete = selected.length === day.slots.length;
            return <View key={day.date} style={styles.day}>
        <View style={styles.dayHeader}>
          <Heading>{day.date}</Heading>
          <Text style={[styles.badge, complete && styles.badgeDone]}>{selected.length}/{day.slots.length} · {complete ? "Complete" : "Incomplete"}</Text>
        </View>
        <Body fine>Selected totals: {nutritionText(total)}</Body>
        {targets && <Body fine>Difference from daily target: {Math.round(total.calories - targets.daily.calories)} kcal · P {Math.round(total.protein_g - targets.daily.protein_g)}g · C {Math.round(total.carbs_g - targets.daily.carbs_g)}g · F {Math.round(total.fat_g - targets.daily.fat_g)}g{planType === "tonight" ? " (dinner only; other meals are not included)" : ""}</Body>}
        {day.loading && <View style={styles.loadingRow}><ActivityIndicator color={INK}/><Body>Finding meals for this day…</Body></View>}
        {day.error && <><Body error>{day.error}</Body><PillButton secondary label="Retry this day" onPress={() => loadDay(day, targets, generation.current)}/></>}
        {!day.loading && !day.error && day.slots.map(slot => {
                    const state = states[slot.id];
                    if (!state)
                        return null;
                    return <View key={slot.id} style={styles.slot}>
            <Text style={styles.slotLabel}>{slot.label}</Text>
            {slot.target && <Body fine>Meal target: {nutritionText(slot.target)}</Body>}
            {state.options.map(option => <MealOptionCard key={option.id} option={option} isSelected={state.acceptedId === option.id} disabled={busy.includes(slot.id)} onAccept={() => {
                                if (busyRef.current.has(slot.id)) return; setStates(prev => ({ ...prev, [slot.id]: { ...prev[slot.id], acceptedId: option.id } })); acceptMeal(slot.id, slot.label, option); }}/>)}
            {state.error && <Body error>{state.error}</Body>}
            {!state.acceptedId && <PillButton secondary label={busy.includes(slot.id) ? "Re-rolling…" : `↻ Re-roll (${MAX_REROLLS - state.rerolls} left)`} disabled={busy.includes(slot.id) || state.rerolls >= MAX_REROLLS} onPress={() => reroll(slot)}/>}
          </View>;
                })}
      </View>;
        })}
  </ScrollView>{acceptedMeals.length > 0 && <View style={styles.footer}><PillButton label={`View grocery list (${acceptedMeals.length} meal${acceptedMeals.length === 1 ? "" : "s"})`} onPress={() => navigation.navigate("GroceryList")} style={styles.footerButton}/></View>}</View>;
}
const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
    centerButton: { alignSelf: "stretch", maxWidth: 360, width: "100%", marginHorizontal: "auto" },
    summary: { gap: 6 },
    day: { gap: 10, borderTopWidth: 1, borderColor: "rgba(43,29,20,0.1)", paddingTop: 16 },
    dayHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
    badge: { fontSize: 12, fontWeight: "700", color: INK, backgroundColor: "rgba(246,179,61,0.3)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
    badgeDone: { backgroundColor: "rgba(94,158,110,0.25)" },
    loadingRow: { flexDirection: "row", gap: 10, alignItems: "center" },
    slot: { gap: 12, marginVertical: 8 },
    slotLabel: { fontSize: 13, fontWeight: "800", color: INK, letterSpacing: 1, textTransform: "uppercase" },
    footer: { padding: 16, backgroundColor: CREAM, borderTopWidth: 1, borderColor: "rgba(43,29,20,0.1)" },
    footerButton: { width: "100%", maxWidth: 640, alignSelf: "center" },
});
