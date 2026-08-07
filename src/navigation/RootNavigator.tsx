import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import ConstraintSetupScreen from "@/screens/ConstraintSetupScreen";
import GroceryListScreen from "@/screens/GroceryListScreen";
import HomeScreen from "@/screens/HomeScreen";
import SuggestionScreen from "@/screens/SuggestionScreen";

export type RootStackParamList = {
  Home: undefined;
  ConstraintSetup: undefined;
  Suggestions: { planType: "tonight" | "week" };
  GroceryList: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTitleAlign: "center" }}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "eatEazy" }} />
        <Stack.Screen
          name="ConstraintSetup"
          component={ConstraintSetupScreen}
          options={{ title: "Your preferences" }}
        />
        <Stack.Screen name="Suggestions" component={SuggestionScreen} options={{ title: "Pick a meal" }} />
        <Stack.Screen name="GroceryList" component={GroceryListScreen} options={{ title: "Grocery list" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
