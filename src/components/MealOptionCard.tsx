import { Pressable, StyleSheet, Text, View } from "react-native";
import { nutritionText } from "@/health/fitness";
import type { MealOption } from "@/types/meal";
type Props = {
    option: MealOption;
    isSelected: boolean;
    onAccept: () => void;
    disabled?: boolean;
};
export default function MealOptionCard({ option, isSelected, onAccept, disabled = false }: Props) {
    return (<View style={[styles.card, isSelected && styles.cardSelected]}>
      <Text style={styles.title}>{option.title}</Text>
      <Text style={styles.meta}>
        {option.cuisine} · {option.cookTimeMinutes} min
      </Text>
      <Text style={styles.description}>{option.description}</Text>
      {option.nutrition && <><Text style={styles.meta}>AI-estimated per serving</Text><Text>{nutritionText(option.nutrition)}</Text></>}
      {option.workoutRationale && <Text style={styles.description}>{option.workoutRationale}</Text>}
      {option.tags.length > 0 && (<View style={styles.tagRow}>
          {option.tags.map((tag) => (<Text key={tag} style={styles.tag}>
              {tag}
            </Text>))}
        </View>)}
      <Pressable style={[styles.acceptButton, isSelected && styles.acceptButtonSelected, disabled && { opacity: 0.5 }]} onPress={onAccept} disabled={isSelected || disabled}>
        <Text style={styles.acceptButtonText}>{isSelected ? "Selected" : "Choose this"}</Text>
      </Pressable>
    </View>);
}
const styles = StyleSheet.create({
    card: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 16,
        gap: 6,
        backgroundColor: "#fff",
    },
    cardSelected: {
        borderColor: "#2f6f4f",
        borderWidth: 2,
        backgroundColor: "#f1f8f4",
    },
    title: {
        fontSize: 16,
        fontWeight: "700",
    },
    meta: {
        fontSize: 13,
        color: "#666",
    },
    description: {
        fontSize: 14,
        color: "#444",
    },
    tagRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 4,
    },
    tag: {
        fontSize: 12,
        color: "#2f6f4f",
        backgroundColor: "#e5f2ea",
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 10,
        overflow: "hidden",
    },
    acceptButton: {
        marginTop: 8,
        backgroundColor: "#2f6f4f",
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: "center",
    },
    acceptButtonSelected: {
        backgroundColor: "#8fb9a2",
    },
    acceptButtonText: {
        color: "#fff",
        fontWeight: "700",
        fontSize: 14,
    },
});
