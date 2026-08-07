import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";

import { usePlan } from "@/context/PlanContext";
import type { RootStackParamList } from "@/navigation/RootNavigator";
import { buildGroceryList, formatGroceryListAsText } from "@/utils/groceryList";

type Props = NativeStackScreenProps<RootStackParamList, "GroceryList">;

export default function GroceryListScreen({}: Props) {
  const { acceptedMeals } = usePlan();
  const items = useMemo(() => buildGroceryList(acceptedMeals), [acceptedMeals]);
  const listText = useMemo(() => formatGroceryListAsText(items), [items]);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await Clipboard.setStringAsync(listText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleShare() {
    await Share.share({ message: listText });
  }

  if (items.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>Accept a meal to build your grocery list.</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        {items.map((item) => (
          <View key={item.name} style={styles.item}>
            <Text style={styles.itemName}>{item.name}</Text>
            {item.entries.map((entry, i) => (
              <Text key={i} style={styles.itemDetail}>
                {entry.quantity} — {entry.slotLabel}
              </Text>
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.actions}>
        <Pressable style={styles.actionButton} onPress={handleCopy}>
          <Text style={styles.actionButtonText}>{copied ? "Copied!" : "Copy to clipboard"}</Text>
        </Pressable>
        <Pressable style={styles.actionButton} onPress={handleShare}>
          <Text style={styles.actionButtonText}>Share</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    padding: 20,
    gap: 16,
    paddingBottom: 20,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
  },
  item: {
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingBottom: 12,
    gap: 2,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "700",
  },
  itemDetail: {
    fontSize: 13,
    color: "#666",
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: "#2f6f4f",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
});
