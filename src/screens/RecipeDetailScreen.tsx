import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { CREAM, INK, TOMATO, useDisplayFonts } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "RecipeDetail">;

export default function RecipeDetailScreen({ route }: Props) {
  const { recipe } = route.params;
  const { display } = useDisplayFonts();
  const n = recipe.nutrition;
  return <ScrollView style={styles.root} contentContainerStyle={styles.content}>
    <Text accessibilityRole="header" style={[styles.title, display]}>{recipe.title}</Text>
    <Text style={styles.meta}>{recipe.cuisine} · {recipe.cookTimeMinutes} min · serves {recipe.servings}</Text>
    <Text style={styles.body}>{recipe.description}</Text>
    {n && <View style={styles.nutrition}>
      {[["Calories", Math.round(n.calories)], ["Protein", `${Math.round(n.protein_g)} g`], ["Carbs", `${Math.round(n.carbs_g)} g`], ["Fat", `${Math.round(n.fat_g)} g`]].map(([label, value]) =>
        <View key={label} style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}
    </View>}
    {n && <Text style={styles.fine}>Estimated per serving.</Text>}

    <Text accessibilityRole="header" style={[styles.heading, display]}>Ingredients</Text>
    {recipe.ingredients.map((item, i) => <Text key={`${item.name}-${i}`} style={styles.body}>• {item.quantity} {item.name}</Text>)}

    <Text accessibilityRole="header" style={[styles.heading, display]}>Steps</Text>
    {recipe.steps.map((step, i) => <View key={i} style={styles.step}>
      <Text style={styles.stepNumber}>{i + 1}</Text>
      <Text style={[styles.body, styles.stepText]}>{step}</Text>
    </View>)}

    <Text style={[styles.fine, { marginTop: 24 }]}>AI-generated recipe. Check ingredient labels for allergens.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CREAM },
  content: { padding: 24, gap: 8, width: "100%", maxWidth: 640, alignSelf: "center" },
  title: { fontSize: 34, lineHeight: 40, color: INK },
  meta: { fontSize: 14, color: TOMATO, fontWeight: "700" },
  body: { fontSize: 16, lineHeight: 24, color: INK },
  nutrition: { flexDirection: "row", gap: 8, marginTop: 8 },
  stat: { flex: 1, backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 14, paddingVertical: 10, alignItems: "center" },
  statValue: { fontSize: 16, fontWeight: "800", color: INK },
  statLabel: { fontSize: 12, color: INK, opacity: 0.7 },
  heading: { fontSize: 22, color: INK, marginTop: 20 },
  step: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  stepNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: INK, color: "white", textAlign: "center", lineHeight: 28, fontWeight: "800", overflow: "hidden" },
  stepText: { flex: 1 },
  fine: { fontSize: 12, color: INK, opacity: 0.6 },
});
