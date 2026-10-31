import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { authorizeGoogleHealth, googleHealthConfig, googleHealthStatus } from "@/api/googleHealth";
import { CREAM, INK, TOMATO, useDisplayFonts } from "@/theme";

const STORAGE_KEY = "eateazy.healthPrompt";
const WAIT_MS = 600000;
type Stage = "ask" | "continue" | "waiting" | "connected";

// Offers Google Health once per visit when it isn't connected, unless the account opted out.
export default function GoogleHealthPrompt({ accountId }: { accountId: string }) {
  const storageKey = `${STORAGE_KEY}.${accountId}`;
  const { display, displayItalic } = useDisplayFonts();
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<Stage>("ask");
  const [url, setUrl] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const deadline = useRef(0);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    (async () => {
      let optedOut = false;
      try { optedOut = (await AsyncStorage.getItem(storageKey)) === "never"; } catch {}
      if (optedOut) return;
      try {
        const config = await googleHealthConfig();
        if (!config.available) return;
        const status = await googleHealthStatus();
        if (active.current && status.signed_in && !status.has_grant && !status.pending && !status.error) setVisible(true);
      } catch {}
    })();
    return () => { active.current = false; };
  }, [storageKey]);

  async function check() {
    if (deadline.current && Date.now() > deadline.current) {
      deadline.current = 0; setStage("ask"); setUrl(undefined); setMessage("Sign-in expired. Try connecting again.");
      return;
    }
    try {
      const status = await googleHealthStatus();
      if (!active.current) return;
      if (status.error) { deadline.current = 0; setStage("ask"); setUrl(undefined); setMessage(status.error); }
      else if (status.connected) { deadline.current = 0; setStage("connected"); setMessage(undefined); }
    } catch (e: any) { if (active.current) setMessage(e.message); }
  }
  useEffect(() => {
    if (stage !== "waiting") return;
    const timer = setInterval(check, 3000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") check(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [stage]);

  async function connect() {
    setBusy(true); setMessage(undefined);
    try { const result = await authorizeGoogleHealth(); setUrl(result.url); setStage("continue"); }
    catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function openGoogle() {
    if (!url) return;
    try { await Linking.openURL(url); deadline.current = Date.now() + WAIT_MS; setStage("waiting"); }
    catch { setMessage("Could not open your browser. Try again."); }
  }
  async function neverAsk() {
    try { await AsyncStorage.setItem(storageKey, "never"); } catch {}
    setVisible(false);
  }
  const close = () => setVisible(false);

  return <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={styles.card}>
        {stage === "connected" ? <>
          <Text accessibilityRole="header" style={[styles.title, display]}>You're <Text style={[styles.accent, displayItalic]}>connected</Text></Text>
          <Text style={styles.body}>Google Health is connected. Sync workouts from Account & connections whenever you want them in your plans.</Text>
          <Pill label="Done" onPress={close} />
        </> : <>
          <Text accessibilityRole="header" style={[styles.title, display]}>Connect Google <Text style={[styles.accent, displayItalic]}>Health?</Text></Text>
          <Text style={styles.body}>Import your completed workouts so meal plans fit your training. Read-only, and you can disconnect anytime.</Text>
          {stage === "ask" && <Pill label={busy ? "Preparing…" : "Connect Google Health"} disabled={busy} onPress={connect} />}
          {stage === "continue" && <Pill label="Continue to Google →" onPress={openGoogle} />}
          {stage === "waiting" && <>
            <Text style={styles.status}>Finish in the Google tab, then come back here.</Text>
            <Pill label="Open Google again" secondary onPress={openGoogle} />
          </>}
          {!!message && <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text>}
          <Pill label="Not now" secondary onPress={close} />
          <Pressable accessibilityRole="button" onPress={neverAsk} style={styles.link}><Text style={styles.linkLabel}>Don't ask again</Text></Pressable>
          <Text style={styles.fine}>You can connect anytime from Account & connections.</Text>
        </>}
      </View>
    </View>
  </Modal>;
}

function Pill({ label, onPress, secondary, disabled }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.pill, secondary ? styles.secondary : styles.primary, disabled && { opacity: 0.5 }, pressed && styles.pressed]}>
    <Text style={[styles.pillLabel, secondary && { color: INK }]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(43,29,20,0.45)", alignItems: "center", justifyContent: "center", padding: 20 },
  card: { width: "100%", maxWidth: 420, backgroundColor: CREAM, borderRadius: 28, padding: 26, gap: 12 },
  title: { fontSize: 30, lineHeight: 36, color: INK },
  accent: { color: TOMATO },
  body: { fontSize: 16, lineHeight: 23, color: INK, opacity: 0.85, marginBottom: 6 },
  status: { fontSize: 14, color: INK, textAlign: "center" },
  pill: { minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primary: { backgroundColor: INK },
  secondary: { backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "rgba(43,29,20,0.12)" },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  pillLabel: { color: "white", fontSize: 16, fontWeight: "700" },
  link: { alignSelf: "center", paddingVertical: 4 },
  linkLabel: { color: INK, fontSize: 14, fontWeight: "600", textDecorationLine: "underline" },
  fine: { fontSize: 12, color: INK, opacity: 0.6, textAlign: "center" },
});
