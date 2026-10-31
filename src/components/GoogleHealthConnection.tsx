import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Pressable, Text, View, StyleSheet } from "react-native";
import { authorizeGoogleHealth, googleHealthConfig, googleHealthStatus, DISCONNECTED } from "@/api/googleHealth";
import type { GoogleHealthStatus } from "@/api/googleHealth";
import { useAuth } from "@/context/AuthContext";
import { useGoogleHealth } from "@/context/GoogleHealthContext";
import { INK, useDisplayFonts } from "@/theme";

export default function GoogleHealthConnection() {
  const { refresh: refreshAuth } = useAuth();
  const { workouts, sync, disconnect, clear } = useGoogleHealth();
  const [available,setAvailable] = useState(false);
  const [status,setStatus] = useState<GoogleHealthStatus>(DISCONNECTED);
  const [message,setMessage] = useState("Checking backend configuration…");
  const [busy,setBusy] = useState(false);
  const [url,setUrl] = useState<string>();
  const [waiting,setWaiting] = useState(false);
  const { display } = useDisplayFonts();
  const active = useRef(true);
  const checking = useRef(false);
  const deadline = useRef(0);
  async function refresh() {
    if (checking.current) return;
    checking.current = true;
    if (deadline.current && Date.now() > deadline.current) {
      setWaiting(false); setUrl(undefined); deadline.current=0;
    }
    try {
      const config = await googleHealthConfig();
      if (!active.current) return;
      setAvailable(config.available);
      if (!config.available) { setStatus(DISCONNECTED); clear(); setWaiting(false); setUrl(undefined); deadline.current=0; setMessage(config.message); return; }
      const next = await googleHealthStatus();
      if (!active.current) return;
      setStatus(next);
      if (!next.connected && !next.pending) clear();
      if (next.error) { setMessage(next.error); setWaiting(false); setUrl(undefined); deadline.current=0; clear(); }
      else if (next.connected) { setMessage("Connected. Sync workouts to read your recent completed sessions."); setWaiting(false); setUrl(undefined); }
      else if (!next.pending) {
        if (deadline.current && Date.now() > deadline.current) { setMessage("Sign-in expired. Connect again."); setWaiting(false); setUrl(undefined); }
        else if (!deadline.current) setMessage(config.message);
      }
    } catch(e:any) { if(active.current) setMessage(e.message); }
    finally { checking.current = false; }
  }
  useEffect(() => {
    active.current=true; refresh();
    const subscription=AppState.addEventListener("change",state=>{ if(state==="active") refresh(); });
    return ()=>{active.current=false;subscription.remove();};
  },[]);
  useEffect(()=>{
    if(!waiting) return;
    const timer=setInterval(()=>refresh(),3000);
    return ()=>clearInterval(timer);
  },[waiting]);
  async function run(action:()=>Promise<void>) {
    setBusy(true);
    try { await action(); } catch(e:any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function connect() {
    const result=await authorizeGoogleHealth();
    setUrl(result.url); deadline.current=Date.now()+600000; setWaiting(true);
    setMessage("Choose Continue to Google. After allowing read-only workout access, return here.");
  }
  async function syncNow() {
    let count: number;
    try { count = await sync(); }
    catch (error) { const next = await googleHealthStatus(); setStatus(next); if (!next.connected) clear(); throw error; }
    setMessage(`Synced ${count} completed workout${count===1 ? "" : "s"} from the past seven days.`);
    const next=await googleHealthStatus(); setStatus(next);
  }
  const disconnectNow = async()=>{await disconnect();setStatus(DISCONNECTED);setWaiting(false);setUrl(undefined);deadline.current=0;setMessage("Disconnected. Google access was revoked and connection data deleted.");await refreshAuth();};
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={[styles.title, display]}>Google Health</Text>
    <Text style={styles.body}>Connect the Google account linked to your Google Health/Fitbit app to import completed workouts.</Text>
    <Text accessibilityLiveRegion="polite" style={styles.status}>{message}</Text>
    {available && status.signed_in && !status.has_grant && <Button label="Connect Google Health" disabled={busy} action={()=>run(connect)}/>}
    {url && <Button label="Continue to Google →" disabled={busy} action={()=>run(async()=>{await Linking.openURL(url);})}/>}
    {status.connected && <Button label="Sync workouts" disabled={busy} action={()=>run(syncNow)}/>}
    {(status.has_grant || waiting) && <Button secondary label="Disconnect & delete connection" disabled={busy} action={()=>run(disconnectNow)}/>}
    <Button secondary label="Check connection" disabled={busy} action={()=>run(refresh)}/>
    {status.last_synced && <Text style={styles.fine}>Last synced: {new Date(status.last_synced).toLocaleString()}</Text>}
    {workouts.length > 0 && <View style={styles.workouts}>
      {workouts.map(w=><Text key={w.id} style={styles.workout}>{w.local_date} · {w.type} · {Math.round(w.duration_minutes)} min</Text>)}
    </View>}
    <Text style={styles.fine}>Read-only access. Sharing workouts with Claude needs the separate workout-sharing toggle. Synced workouts stay in memory, so sync again after restarting the app.</Text>
  </View>;
}
function Button({label,action,disabled,secondary}:{label:string;action:()=>void;disabled:boolean;secondary?:boolean}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} onPress={action} disabled={disabled}
    style={({pressed})=>[styles.button,secondary?styles.secondary:styles.primary,disabled&&{opacity:.5},pressed&&styles.pressed]}>
    <Text style={[styles.buttonLabel,secondary&&{color:INK}]}>{label}</Text>
  </Pressable>;
}
const styles=StyleSheet.create({
  card:{gap:12,backgroundColor:"rgba(255,255,255,0.8)",borderRadius:20,padding:20,borderWidth:1,borderColor:"rgba(43,29,20,0.08)"},
  title:{fontSize:24,color:INK},
  body:{fontSize:15,lineHeight:22,color:INK,opacity:0.85},
  status:{fontSize:14,color:INK,fontWeight:"600"},
  button:{minHeight:50,borderRadius:999,alignItems:"center",justifyContent:"center",paddingHorizontal:20},
  primary:{backgroundColor:INK},
  secondary:{backgroundColor:"rgba(255,255,255,0.9)",borderWidth:1,borderColor:"rgba(43,29,20,0.12)"},
  pressed:{opacity:0.8,transform:[{scale:0.98}]},
  buttonLabel:{color:"white",fontSize:15,fontWeight:"700"},
  workouts:{gap:6},
  workout:{fontSize:14,color:INK,backgroundColor:"rgba(94,158,110,0.15)",borderRadius:12,paddingHorizontal:12,paddingVertical:8,overflow:"hidden"},
  fine:{fontSize:12,color:INK,opacity:0.6,lineHeight:17},
});
