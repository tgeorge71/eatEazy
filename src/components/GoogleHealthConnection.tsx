import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Pressable, Text, View, StyleSheet } from "react-native";
import { authorizeGoogleHealth, googleHealthConfig, googleHealthStatus, DISCONNECTED } from "@/api/googleHealth";
import type { GoogleHealthStatus } from "@/api/googleHealth";
import { useAuth } from "@/context/AuthContext";
import { useGoogleHealth } from "@/context/GoogleHealthContext";

export default function GoogleHealthConnection() {
  const { refresh: refreshAuth } = useAuth();
  const { workouts, sync, disconnect, clear } = useGoogleHealth();
  const [available,setAvailable] = useState(false);
  const [status,setStatus] = useState<GoogleHealthStatus>(DISCONNECTED);
  const [message,setMessage] = useState("Checking backend configuration…");
  const [busy,setBusy] = useState(false);
  const [url,setUrl] = useState<string>();
  const [waiting,setWaiting] = useState(false);
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
  return <View style={styles.container}>
    <Text style={styles.title}>Google Health</Text>
    <Text>Connect the Google account linked to your Google Health/Fitbit app. Read-only workout access does not grant permission to share workouts with Claude; use the separate workout-sharing toggle.</Text>
    <Text accessibilityLiveRegion="polite">{message}</Text>
    {available && status.signed_in && !status.has_grant && <Button label="Connect Google Health" disabled={busy} action={()=>run(connect)}/>}
    {url && <Button label="Continue to Google" disabled={busy} action={()=>run(async()=>{await Linking.openURL(url);})}/>}
    {status.connected && <Button label="Sync workouts" disabled={busy} action={()=>run(syncNow)}/>}
    {(status.has_grant || waiting) && <Button label="Disconnect & delete connection" disabled={busy} action={()=>run(async()=>{await disconnect();setStatus(DISCONNECTED);setWaiting(false);setUrl(undefined);deadline.current=0;setMessage("Disconnected. Google access was revoked and connection data deleted.");await refreshAuth();})}/>}
    <Button label="Check connection" disabled={busy} action={()=>run(refresh)}/>
    {status.last_synced && <Text>Last synced: {new Date(status.last_synced).toLocaleString()}</Text>}
    {workouts.map(w=><Text key={w.id}>{w.local_date} · {w.type} · {Math.round(w.duration_minutes)} min · completed · Google Health</Text>)}
    <Text>Synced workouts stay in memory. Sync again after restarting the app. Future sessions still come from your manual schedule.</Text>
  </View>;
}
function Button({label,action,disabled}:{label:string;action:()=>void;disabled:boolean}) { return <Pressable onPress={action} disabled={disabled} style={[styles.button,disabled&&{opacity:.5}]}><Text style={{color:"white"}}>{label}</Text></Pressable>; }
const styles=StyleSheet.create({container:{gap:12,borderTopWidth:1,borderColor:"#ddd",paddingTop:16},title:{fontSize:18,fontWeight:"700"},button:{backgroundColor:"#2f6f4f",padding:12,borderRadius:8,alignItems:"center"}});
