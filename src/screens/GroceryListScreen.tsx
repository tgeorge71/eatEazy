import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { useMemo, useState } from "react";
import { ScrollView, Share, StyleSheet, Text, View } from "react-native";

import { Body, Card, Heading, PillButton, ui } from "@/components/ui";
import { usePlan } from "@/context/PlanContext";
import { CREAM, INK } from "@/theme";
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
        <Heading size={26} style={{ textAlign: "center" }}>Nothing on the list yet</Heading>
        <Body fine style={{ textAlign: "center" }}>Choose a meal to build your grocery list.</Body>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={ui.screen}>
        <Heading size={30}>Your groceries</Heading>
        <Body fine>{items.length} item{items.length === 1 ? "" : "s"} for {acceptedMeals.length} meal{acceptedMeals.length === 1 ? "" : "s"}.</Body>
        <Card style={styles.list}>
          {items.map((item, index) => (
            <View key={item.name} style={[styles.item, index > 0 && styles.divider]}>
              <Text style={styles.itemName}>{item.name}</Text>
              {item.entries.map((entry, i) => (
                <Text key={i} style={styles.itemDetail}>
                  {entry.quantity} · {entry.slotLabel}
                </Text>
              ))}
            </View>
          ))}
        </Card>
      </ScrollView>
      <View style={styles.actions}>
        <PillButton label={copied ? "Copied!" : "Copy to clipboard"} onPress={handleCopy} style={styles.action} />
        <PillButton secondary label="Share" onPress={handleShare} style={styles.action} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 8 },
  list: { gap: 0, paddingVertical: 6 },
  item: { paddingVertical: 12, gap: 2 },
  divider: { borderTopWidth: 1, borderTopColor: "rgba(43,29,20,0.08)" },
  itemName: { fontSize: 16, fontWeight: "700", color: INK, textTransform: "capitalize" },
  itemDetail: { fontSize: 13, color: INK, opacity: 0.65 },
  actions: { flexDirection: "row", gap: 12, padding: 16, backgroundColor: CREAM, borderTopWidth: 1, borderColor: "rgba(43,29,20,0.1)", width: "100%", maxWidth: 640, alignSelf: "center" },
  action: { flex: 1 },
});
