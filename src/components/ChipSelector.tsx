import { Pressable, StyleSheet, Text, View } from "react-native";
import { INK } from "@/theme";

type ChipSelectorProps = {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  multiple?: boolean;
};

export default function ChipSelector({ options, selected, onChange, multiple = true }: ChipSelectorProps) {
  function toggle(option: string) {
    const isSelected = selected.includes(option);
    if (multiple) {
      onChange(isSelected ? selected.filter((o) => o !== option) : [...selected, option]);
    } else {
      onChange(isSelected ? [] : [option]);
    }
  }

  return (
    <View style={styles.row}>
      {options.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            onPress={() => toggle(option)}
            style={({ pressed }) => [styles.chip, isSelected && styles.chipSelected, pressed && { opacity: 0.8 }]}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: "rgba(43,29,20,0.15)", backgroundColor: "rgba(255,255,255,0.85)" },
  chipSelected: { backgroundColor: INK, borderColor: INK },
  chipText: { color: INK, fontSize: 14, fontWeight: "600", textTransform: "capitalize" },
  chipTextSelected: { color: "#fff" },
});
