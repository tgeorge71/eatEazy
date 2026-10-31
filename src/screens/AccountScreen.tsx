import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import GoogleHealthConnection from "@/components/GoogleHealthConnection";
import { useAuth } from "@/context/AuthContext";
export default function AccountScreen({ onContinue }: { onContinue?: () => void }) {
  const { user, signOut } = useAuth();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  return <SafeAreaView style={{ flex: 1 }}><ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
    <Text style={{ fontSize: 24, fontWeight: "700" }}>Hi {user?.name || "there"}</Text>
    <Text>Signed in as {user?.email}</Text>
    <Text>Would you like to connect Google Health? Import your completed workouts to help plan meals around your routine.</Text>
    <GoogleHealthConnection />
    {onContinue && <Pressable onPress={onContinue} style={{ padding: 16, backgroundColor: "#2f6f4f", borderRadius: 8 }}><Text style={{ color: "white", textAlign: "center" }}>Continue to meal planning</Text></Pressable>}
    {onContinue && <Text>You can continue without connecting and add Google Health later in Account & connections.</Text>}
    <Pressable disabled={busy} onPress={async () => { setBusy(true); try { await signOut(); } catch (e: any) { setError(e.message); } finally { setBusy(false); } }}><Text>Sign out & disconnect Google Health</Text></Pressable>
    {error && <Text accessibilityLiveRegion="polite">{error}</Text>}
  </ScrollView></SafeAreaView>;
}
