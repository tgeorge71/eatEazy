import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { authorizeGoogleLogin, googleHealthConfig } from "@/api/googleHealth";
import { useAuth } from "@/context/AuthContext";
export default function LoginScreen() {
  const { error, refresh, signOut } = useAuth();
  const [available, setAvailable] = useState(false);
  const [message, setMessage] = useState("Checking Google sign-in…");
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  async function check() {
    try { const config = await googleHealthConfig(); setAvailable(config.available); setMessage(config.available ? "Sign in to plan meals around your day." : config.message); await refresh(); }
    catch (e: any) { setMessage(e.message); }
  }
  useEffect(() => { check(); }, []);
  async function login() {
    setBusy(true);
    try {
      const result = await authorizeGoogleLogin(); setUrl(result.url);
      setMessage("Continue in your browser, then return to eatEazy. Google Health access is requested separately after sign-in.");
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={styles.container}>
    <Text style={styles.title}>Welcome to eatEazy</Text>
    <Text>Meals that fit your preferences and your routine.</Text>
    <Text accessibilityLiveRegion="polite">{error || message}</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy || !available }} style={[styles.button, (busy || !available) && { opacity: 0.5 }]} disabled={busy || !available} onPress={login}><Text style={styles.label}>{busy ? "Preparing sign-in…" : "Sign in with Google"}</Text></Pressable>
    {url && <Pressable style={styles.button} onPress={async () => { try { await Linking.openURL(url); } catch { setMessage("Could not open your browser. Try again."); } }}><Text style={styles.label}>Continue to Google</Text></Pressable>}
    <Pressable onPress={check}><Text>Check sign-in</Text></Pressable>
    <Pressable onPress={async () => { try { await signOut(); setUrl(undefined); await check(); } catch (e: any) { setMessage(e.message); } }}><Text>Reset sign-in / sign out</Text></Pressable>
    <Text>Sign-in uses your Google name and email. Connecting workouts is optional.</Text>
  </SafeAreaView>;
}
const styles = StyleSheet.create({ container: { flex: 1, justifyContent: "center", padding: 28, gap: 20 }, title: { fontSize: 28, fontWeight: "700" }, button: { backgroundColor: "#2f6f4f", padding: 16, borderRadius: 10, alignItems: "center" }, label: { color: "white", fontWeight: "700" } });
