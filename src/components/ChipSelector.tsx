import { Pressable, StyleSheet, Text, View } from "react-native";

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
            onPress={() => toggle(option)}
            style={[styles.chip, isSelected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{option}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  chipSelected: {
    backgroundColor: "#2f6f4f",
    borderColor: "#2f6f4f",
  },
  chipText: {
    color: "#333",
    fontSize: 14,
  },
  chipTextSelected: {
    color: "#fff",
    fontWeight: "600",
  },
});
