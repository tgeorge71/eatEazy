import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ConstraintsProvider } from "./src/context/ConstraintsContext";
import { PlanProvider } from "./src/context/PlanContext";
import RootNavigator from "./src/navigation/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <ConstraintsProvider>
        <PlanProvider>
          <StatusBar style="auto" />
          <RootNavigator />
        </PlanProvider>
      </ConstraintsProvider>
    </SafeAreaProvider>
  );
}
