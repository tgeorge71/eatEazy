import { Pressable, StyleSheet, Text, View } from "react-native";
import { nutritionText } from "@/health/fitness";
import { HERB, INK, TOMATO, useDisplayFonts } from "@/theme";
import type { MealOption } from "@/types/meal";
type Props = {
    option: MealOption;
    isSelected: boolean;
    onAccept: () => void;
    disabled?: boolean;
};
export default function MealOptionCard({ option, isSelected, onAccept, disabled = false }: Props) {
    const { display } = useDisplayFonts();
    return (<View style={[styles.card, isSelected && styles.cardSelected]}>
      <Text style={[styles.title, display]}>{option.title}</Text>
      <Text style={styles.meta}>
        {option.cuisine} · {option.cookTimeMinutes} min
      </Text>
      <Text style={styles.description}>{option.description}</Text>
      {option.nutrition && <View style={styles.nutrition}><Text style={styles.fine}>AI-estimated per serving</Text><Text style={styles.nutritionText}>{nutritionText(option.nutrition)}</Text></View>}
      {option.workoutRationale && <Text style={styles.rationale}>{option.workoutRationale}</Text>}
      {option.tags.length > 0 && (<View style={styles.tagRow}>
          {option.tags.map((tag) => (<Text key={tag} style={styles.tag}>
              {tag}
            </Text>))}
        </View>)}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSelected || disabled, selected: isSelected }} style={({ pressed }) => [styles.acceptButton, isSelected && styles.acceptButtonSelected, disabled && { opacity: 0.5 }, pressed && { opacity: 0.8 }]} onPress={onAccept} disabled={isSelected || disabled}>
        <Text style={styles.acceptButtonText}>{isSelected ? "✓ Selected" : "Choose this"}</Text>
      </Pressable>
    </View>);
}
const styles = StyleSheet.create({
    card: { backgroundColor: "rgba(255,255,255,0.85)", borderRadius: 20, padding: 18, gap: 6, borderWidth: 1, borderColor: "rgba(43,29,20,0.08)" },
    cardSelected: { borderColor: HERB, borderWidth: 2, backgroundColor: "rgba(94,158,110,0.12)" },
    title: { fontSize: 20, lineHeight: 25, color: INK },
    meta: { fontSize: 13, color: TOMATO, fontWeight: "700" },
    description: { fontSize: 14, lineHeight: 20, color: INK, opacity: 0.85 },
    nutrition: { backgroundColor: "rgba(246,179,61,0.18)", borderRadius: 12, padding: 10, gap: 2, marginTop: 2 },
    nutritionText: { fontSize: 14, color: INK, fontWeight: "600" },
    fine: { fontSize: 12, color: INK, opacity: 0.6 },
    rationale: { fontSize: 13, lineHeight: 19, color: INK, opacity: 0.75, fontStyle: "italic" },
    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
    tag: { fontSize: 12, color: INK, backgroundColor: "rgba(246,179,61,0.25)", paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, overflow: "hidden" },
    acceptButton: { marginTop: 8, backgroundColor: INK, borderRadius: 999, minHeight: 46, alignItems: "center", justifyContent: "center" },
    acceptButtonSelected: { backgroundColor: HERB },
    acceptButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
