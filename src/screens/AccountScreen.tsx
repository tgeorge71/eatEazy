import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import BlobBackground from "@/components/BlobBackground";
import GoogleHealthConnection from "@/components/GoogleHealthConnection";
import { useAuth } from "@/context/AuthContext";
import { INK, TOMATO, useDisplayFonts } from "@/theme";

export default function AccountScreen() {
  const { user, signOut } = useAuth();
  const { display, displayItalic } = useDisplayFonts();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const firstName = user?.name?.split(" ")[0];
  return <View style={styles.root}>
    <BlobBackground />
    <ScrollView contentContainerStyle={styles.content}>
      <Text accessibilityRole="header" style={[styles.headline, display]}>Hi <Text style={[styles.accent, displayItalic]}>{firstName || "there"}</Text></Text>
      <Text style={styles.meta}>Signed in as {user?.email}</Text>
      <GoogleHealthConnection />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={async () => { setBusy(true); try { await signOut(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}
        style={({ pressed }) => [styles.pill, busy && { opacity: 0.5 }, pressed && styles.pressed]}>
        <Text style={styles.pillLabel}>{busy ? "Signing out…" : "Sign out & disconnect Google Health"}</Text>
      </Pressable>
      {error && <Text accessibilityLiveRegion="polite" style={styles.meta}>{error}</Text>}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 24, paddingBottom: 48, gap: 16, width: "100%", maxWidth: 560, alignSelf: "center" },
  headline: { fontSize: 44, lineHeight: 50, color: INK, letterSpacing: -1 },
  accent: { color: TOMATO },
  meta: { fontSize: 15, color: INK, opacity: 0.75 },
  pill: { minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20, backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "rgba(43,29,20,0.12)" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  pillLabel: { color: INK, fontSize: 15, fontWeight: "700" },
});
