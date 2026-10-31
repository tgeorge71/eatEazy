import { useState } from "react";
import { Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { ConstraintsProvider } from "./src/context/ConstraintsContext";
import { GoogleHealthProvider } from "./src/context/GoogleHealthContext";
import { FitnessProvider } from "./src/context/FitnessContext";
import { PlanProvider } from "./src/context/PlanContext";
import RootNavigator from "./src/navigation/RootNavigator";
import LoginScreen from "./src/screens/LoginScreen";
import AccountScreen from "./src/screens/AccountScreen";
function SignedInApp() {
  const { user, loaded } = useAuth();
  if (!loaded) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Text>Checking sign-in…</Text></View>;
  if (!user) return <LoginScreen />;
  return <AccountApp key={user.sub} accountId={user.sub} />;
}
function AccountApp({ accountId }: { accountId: string }) {
  const [ready, setReady] = useState(false);
  return <ConstraintsProvider accountId={accountId}>
    <GoogleHealthProvider><FitnessProvider accountId={accountId}><PlanProvider>
      {ready ? <RootNavigator /> : <AccountScreen onContinue={() => setReady(true)} />}
    </PlanProvider></FitnessProvider></GoogleHealthProvider>
  </ConstraintsProvider>;
}
export default function App() {
  return <SafeAreaProvider><StatusBar style="auto" /><AuthProvider><SignedInApp /></AuthProvider></SafeAreaProvider>;
}
