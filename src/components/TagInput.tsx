import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ThemedInput } from "@/components/ui";
import { INK } from "@/theme";

type TagInputProps = {
  tags: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export default function TagInput({ tags, onChange, placeholder }: TagInputProps) {
  const [draft, setDraft] = useState("");

  function addTag() {
    const value = draft.trim();
    if (value && !tags.includes(value)) {
      onChange([...tags, value]);
    }
    setDraft("");
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <View>
      <View style={styles.row}>
        {tags.map((tag) => (
          <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Remove ${tag}`} onPress={() => removeTag(tag)} style={styles.chip}>
            <Text style={styles.chipText}>{tag} ✕</Text>
          </Pressable>
        ))}
      </View>
      <ThemedInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addTag}
        onBlur={addTag}
        placeholder={placeholder}
        returnKeyType="done"
        accessibilityLabel={placeholder}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  chip: { paddingVertical: 7, paddingHorizontal: 14, borderRadius: 999, backgroundColor: "rgba(246,179,61,0.3)" },
  chipText: { color: INK, fontSize: 14, fontWeight: "600" },
});
