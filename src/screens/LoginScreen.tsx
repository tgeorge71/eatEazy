import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { authorizeGoogleLogin, googleHealthConfig } from "@/api/googleHealth";
import { useAuth } from "@/context/AuthContext";
import BlobBackground from "@/components/BlobBackground";
import { INK, TOMATO, useDisplayFonts } from "@/theme";

type Mode = "choose" | "email" | "phone";

export default function LoginScreen() {
  const { error, refresh, signOut } = useAuth();
  const { display, displayItalic } = useDisplayFonts();
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState("Checking Google sign-in…");
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<Mode>("choose");
  const [contact, setContact] = useState("");
  const [trouble, setTrouble] = useState(false);
  async function check() {
    try { const config = await googleHealthConfig(); setAvailable(config.available); setMessage(config.available ? "" : config.message); await refresh(); }
    catch (e: any) { setMessage(e.message); }
  }
  useEffect(() => { check(); }, []);
  async function login() {
    setBusy(true);
    try {
      const result = await authorizeGoogleLogin(); setUrl(result.url);
      setMessage("Continue in your browser, then return to eatEazy.");
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function openGoogle() {
    if (!url) return;
    try { await Linking.openURL(url); } catch { setMessage("Could not open your browser. Try again."); }
  }
  function choose(next: Mode) { setMode(next); setContact(""); setMessage(""); }
  function submitContact() {
    if (mode === "email" && !/^\S+@\S+\.\S+$/.test(contact.trim())) return setMessage("Enter a valid email address.");
    if (mode === "phone" && contact.replace(/\D/g, "").length < 7) return setMessage("Enter a valid phone number.");
    setMessage(`${mode === "email" ? "Email" : "Phone"} sign-up is coming soon. Use Google for now.`);
  }
  const googleDisabled = busy || !available;
  const status = error || message;

  return <View style={styles.root}>
    <BlobBackground />
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
        <View style={styles.hero}>
          <Text accessibilityRole="header" accessibilityLabel="eatEazy" style={[styles.headline, display]}>eat</Text>
          <Text importantForAccessibility="no" accessibilityElementsHidden style={[styles.headline, styles.accent, displayItalic]}>Eazy.</Text>
          <Text style={styles.tagline}>Dinner, decided.</Text>
        </View>

        <View style={styles.actions}>
          {mode === "choose" ? <>
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: googleDisabled }} disabled={googleDisabled} onPress={url ? openGoogle : login} style={({ pressed }) => [styles.pill, styles.primary, googleDisabled && styles.disabled, pressed && styles.pressed]}>
              {!url && <Text style={styles.googleMark}>G</Text>}
              <Text style={styles.primaryLabel}>{busy ? "Preparing sign-in…" : url ? "Continue to Google →" : "Continue with Google"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => choose("email")} style={({ pressed }) => [styles.pill, styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryLabel}>Sign up with email</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => choose("phone")} style={({ pressed }) => [styles.pill, styles.secondary, pressed && styles.pressed]}>
              <Text style={styles.secondaryLabel}>Use phone number</Text>
            </Pressable>
          </> : <>
            <TextInput
              key={mode}
              autoFocus
              value={contact}
              onChangeText={setContact}
              onSubmitEditing={submitContact}
              placeholder={mode === "email" ? "you@example.com" : "Phone number"}
              placeholderTextColor="#8A7A6E"
              keyboardType={mode === "email" ? "email-address" : "phone-pad"}
              autoComplete={mode === "email" ? "email" : "tel"}
              autoCapitalize="none"
              accessibilityLabel={mode === "email" ? "Email address" : "Phone number"}
              style={styles.input}
            />
            <Pressable accessibilityRole="button" onPress={submitContact} style={({ pressed }) => [styles.pill, styles.primary, pressed && styles.pressed]}>
              <Text style={styles.primaryLabel}>Continue</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => choose("choose")} style={styles.link}>
              <Text style={styles.linkLabel}>← Back</Text>
            </Pressable>
          </>}
          {!!status && <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>}
        </View>

        <View style={styles.footer}>
          <Pressable accessibilityRole="button" accessibilityState={{ expanded: trouble }} onPress={() => setTrouble(!trouble)} style={styles.link}>
            <Text style={styles.linkLabel}>Trouble signing in?</Text>
          </Pressable>
          {trouble && <View style={styles.troubleRow}>
            <Pressable accessibilityRole="button" onPress={check} style={styles.link}><Text style={styles.linkLabel}>Check again</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={async () => { try { await signOut(); setUrl(undefined); await check(); } catch (e: any) { setMessage(e.message); } }} style={styles.link}><Text style={styles.linkLabel}>Reset sign-in</Text></Pressable>
          </View>}
          <Text style={styles.fine}>Sign-in uses your Google name and email. Connecting workouts is optional.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  content: { flex: 1, width: "100%", maxWidth: 420, alignSelf: "center", paddingHorizontal: 28, paddingVertical: 24, justifyContent: "space-between" },
  hero: { flex: 1, justifyContent: "center" },
  headline: { fontSize: 72, lineHeight: 76, color: INK, letterSpacing: -2 },
  accent: { color: TOMATO, marginTop: -8 },
  tagline: { fontSize: 18, color: INK, opacity: 0.75, marginTop: 14, letterSpacing: 0.5 },
  actions: { gap: 12 },
  pill: { minHeight: 56, borderRadius: 999, paddingHorizontal: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  primary: { backgroundColor: INK },
  secondary: { backgroundColor: "rgba(255,255,255,0.75)", borderWidth: 1, borderColor: "rgba(43,29,20,0.12)" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  googleMark: { color: INK, backgroundColor: "white", width: 24, height: 24, borderRadius: 12, textAlign: "center", lineHeight: 24, fontWeight: "800", overflow: "hidden" },
  primaryLabel: { color: "white", fontSize: 16, fontWeight: "700" },
  secondaryLabel: { color: INK, fontSize: 16, fontWeight: "700" },
  input: { minHeight: 56, borderRadius: 999, paddingHorizontal: 24, fontSize: 16, color: INK, backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "rgba(43,29,20,0.15)" },
  status: { color: INK, textAlign: "center", fontSize: 14, marginTop: 4 },
  footer: { alignItems: "center", gap: 6, marginTop: 28 },
  troubleRow: { flexDirection: "row", gap: 20 },
  link: { paddingVertical: 6, alignSelf: "center" },
  linkLabel: { color: INK, fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
  fine: { color: INK, opacity: 0.6, fontSize: 12, textAlign: "center" },
});
