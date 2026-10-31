import { Pressable, StyleSheet, Text, View } from "react-native";
import { INK, TOMATO, useDisplayFonts } from "@/theme";
import type { Recipe } from "@/types/meal";

export default function RecipeCard({ recipe, onPress }: { recipe: Recipe; onPress: () => void }) {
  const { display } = useDisplayFonts();
  return <Pressable accessibilityRole="button" accessibilityHint="Opens the recipe" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
    <Text style={[styles.title, display]}>{recipe.title}</Text>
    <Text style={styles.meta}>{recipe.cuisine} · {recipe.cookTimeMinutes} min · serves {recipe.servings}</Text>
    <Text numberOfLines={2} style={styles.description}>{recipe.description}</Text>
    {recipe.tags.length > 0 && <View style={styles.tags}>
      {recipe.tags.slice(0, 3).map(tag => <Text key={tag} style={styles.tag}>{tag}</Text>)}
    </View>}
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 20, padding: 18, gap: 6, borderWidth: 1, borderColor: "rgba(43,29,20,0.08)" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  title: { fontSize: 20, color: INK },
  meta: { fontSize: 13, color: TOMATO, fontWeight: "700" },
  description: { fontSize: 14, color: INK, opacity: 0.8, lineHeight: 20 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: { fontSize: 12, color: INK, backgroundColor: "rgba(246,179,61,0.25)", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: "hidden" },
});
