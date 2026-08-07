import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

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
          <Pressable key={tag} onPress={() => removeTag(tag)} style={styles.chip}>
            <Text style={styles.chipText}>{tag} ✕</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={addTag}
        onBlur={addTag}
        placeholder={placeholder}
        returnKeyType="done"
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#eee",
  },
  chipText: {
    color: "#333",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
});
