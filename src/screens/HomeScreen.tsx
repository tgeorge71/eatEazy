import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { searchRecipes } from "@/api/recipes";
import BlobBackground from "@/components/BlobBackground";
import GoogleHealthPrompt from "@/components/GoogleHealthPrompt";
import RecipeCard from "@/components/RecipeCard";
import { useAuth } from "@/context/AuthContext";
import { useConstraints } from "@/context/ConstraintsContext";
import { useFitness } from "@/context/FitnessContext";
import { usePlan } from "@/context/PlanContext";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { INK, TOMATO, useDisplayFonts } from "@/theme";
import type { Recipe } from "@/types/meal";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;
const IDEAS = ["15-minute pasta", "High-protein lunch", "Veggie curry", "Sheet-pan dinner"];

export default function HomeScreen({ navigation }: Props) {
    const { user } = useAuth();
    const { constraints, hasConstraints, isLoaded } = useConstraints();
    const { settings, loaded } = useFitness();
    const { clearPlan } = usePlan();
    const { display, displayItalic } = useDisplayFonts();
    const [query, setQuery] = useState("");
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string>();
    const [lastQuery, setLastQuery] = useState<string>();
    const latest = useRef(0);

    async function search(text = query) {
        const trimmed = text.trim();
        if (!trimmed || !isLoaded) return;
        const request = ++latest.current;
        setQuery(trimmed); setLastQuery(trimmed); setSearching(true); setError(undefined);
        try {
            const results = await searchRecipes(trimmed, constraints);
            if (request === latest.current) setRecipes(results);
        } catch (e: any) {
            if (request === latest.current) { setError(e.message); setRecipes([]); }
        } finally {
            if (request === latest.current) setSearching(false);
        }
    }
    function startPlan(planType: "tonight" | "today" | "week") {
        if (!loaded || !isLoaded) return;
        if (!hasConstraints) return navigation.navigate("ConstraintSetup");
        if (planType !== "tonight" && !settings.profile) return navigation.navigate("Fitness");
        clearPlan();
        navigation.navigate("Suggestions", { planType });
    }
    const firstName = user?.name?.split(" ")[0];

    return <View style={styles.root}>
      <BlobBackground />
      {user && <GoogleHealthPrompt accountId={user.sub} />}
      <SafeAreaView style={styles.root}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text style={styles.greeting}>{firstName ? `Hi ${firstName}` : "Hi there"}</Text>
          <Text accessibilityRole="header" style={[styles.headline, display]}>
            What are we <Text style={[styles.accent, displayItalic]}>cooking?</Text>
          </Text>

          <View style={styles.searchRow}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => search()}
              returnKeyType="search"
              placeholder="Search recipes, ingredients, cuisines…"
              placeholderTextColor="#8A7A6E"
              accessibilityLabel="Search recipes"
              maxLength={120}
              style={styles.input}
            />
            <Pressable accessibilityRole="button" accessibilityLabel="Search" disabled={searching || !query.trim()} onPress={() => search()} style={({ pressed }) => [styles.searchButton, (searching || !query.trim()) && styles.disabled, pressed && styles.pressed]}>
              <Text style={styles.searchIcon}>→</Text>
            </Pressable>
          </View>
          <View style={styles.chips}>
            {IDEAS.map(idea => <Pressable key={idea} accessibilityRole="button" disabled={searching} onPress={() => search(idea)} style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
              <Text style={styles.chipLabel}>{idea}</Text>
            </Pressable>)}
          </View>

          {isLoaded && !hasConstraints && <Pressable accessibilityRole="button" onPress={() => navigation.navigate("ConstraintSetup")} style={styles.nudge}>
            <Text style={styles.nudgeText}>Add your allergies & diet so recipes fit you.</Text>
            <Text style={styles.nudgeLink}>Set preferences →</Text>
          </Pressable>}

          <View accessibilityLiveRegion="polite">
            {searching && <Text style={styles.status}>Finding recipes for “{lastQuery}”…</Text>}
            {!searching && error && <View style={styles.errorRow}>
              <Text style={styles.status}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => search(lastQuery)}><Text style={styles.link}>Retry</Text></Pressable>
            </View>}
          </View>
          {!searching && recipes.length > 0 && <View style={styles.results}>
            <Text style={[styles.sectionTitle, display]}>Recipes for “{lastQuery}”</Text>
            {recipes.map(recipe => <RecipeCard key={recipe.id} recipe={recipe} onPress={() => navigation.navigate("RecipeDetail", { recipe })} />)}
          </View>}

          <Text style={[styles.sectionTitle, display]}>Plan meals</Text>
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={() => startPlan("tonight")}><Text style={styles.pillLabel}>Plan tonight</Text></Pressable>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={() => startPlan("today")}><Text style={styles.pillLabel}>Plan today</Text></Pressable>
            <Pressable accessibilityRole="button" style={({ pressed }) => [styles.pill, pressed && styles.pressed]} onPress={() => startPlan("week")}><Text style={styles.pillLabel}>Plan this week</Text></Pressable>
          </View>

          <View style={styles.links}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Account")}><Text style={styles.link}>Account & connections</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Fitness")}><Text style={styles.link}>Fitness profile & workouts</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("ConstraintSetup")}><Text style={styles.link}>Edit preferences</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>;
}

const styles = StyleSheet.create({
    root: { flex: 1 },
    content: { padding: 24, paddingBottom: 48, gap: 16, width: "100%", maxWidth: 560, alignSelf: "center" },
    greeting: { fontSize: 16, color: INK, opacity: 0.75, marginTop: 16, fontWeight: "600" },
    headline: { fontSize: 44, lineHeight: 50, color: INK, letterSpacing: -1 },
    accent: { color: TOMATO },
    searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    input: { flex: 1, minHeight: 56, borderRadius: 999, paddingHorizontal: 22, fontSize: 16, color: INK, backgroundColor: "rgba(255,255,255,0.9)", borderWidth: 1, borderColor: "rgba(43,29,20,0.15)" },
    searchButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
    searchIcon: { color: "white", fontSize: 22, fontWeight: "800" },
    disabled: { opacity: 0.5 },
    pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: { backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(43,29,20,0.1)" },
    chipLabel: { color: INK, fontSize: 14, fontWeight: "600" },
    nudge: { backgroundColor: "rgba(246,179,61,0.25)", borderRadius: 16, padding: 14, gap: 4 },
    nudgeText: { color: INK, fontSize: 14 },
    nudgeLink: { color: INK, fontSize: 14, fontWeight: "800" },
    status: { color: INK, fontSize: 14, flexShrink: 1 },
    errorRow: { flexDirection: "row", gap: 12, alignItems: "center" },
    results: { gap: 12 },
    sectionTitle: { fontSize: 24, color: INK, marginTop: 12 },
    actions: { gap: 12 },
    pill: { minHeight: 56, borderRadius: 999, backgroundColor: INK, alignItems: "center", justifyContent: "center" },
    pillLabel: { color: "white", fontSize: 16, fontWeight: "700" },
    links: { alignItems: "center", gap: 14, marginTop: 12 },
    link: { color: INK, fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
});
