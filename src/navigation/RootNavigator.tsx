import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ConstraintSetupScreen from "@/screens/ConstraintSetupScreen";
import GroceryListScreen from "@/screens/GroceryListScreen";
import FitnessScreen from "@/screens/FitnessScreen";
import AccountScreen from "@/screens/AccountScreen";
import HomeScreen from "@/screens/HomeScreen";
import SuggestionScreen from "@/screens/SuggestionScreen";
import RecipeDetailScreen from "@/screens/RecipeDetailScreen";
import type { Recipe } from "@/types/meal";
import { CREAM, INK } from "@/theme";
export type RootStackParamList = {
    Home: undefined;
    Account: undefined;
    ConstraintSetup: undefined;
    Suggestions: {
        planType: "tonight" | "today" | "week";
    };
    GroceryList: undefined;
    RecipeDetail: {
        recipe: Recipe;
    };
    Fitness: undefined;
};
const Stack = createNativeStackNavigator<RootStackParamList>();
export default function RootNavigator() {
    return (<NavigationContainer>
      <Stack.Navigator initialRouteName="Home" screenOptions={{ headerTitleAlign: "center", headerStyle: { backgroundColor: CREAM }, headerTintColor: INK, headerShadowVisible: false, contentStyle: { backgroundColor: CREAM } }}>
        <Stack.Screen name="Account" component={AccountScreen} options={{ title: "Account & connections" }}/>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "eatEazy", headerShown: false }}/>
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} options={{ title: "Recipe" }}/>
        <Stack.Screen name="ConstraintSetup" component={ConstraintSetupScreen} options={{ title: "Your preferences" }}/>
        <Stack.Screen name="Suggestions" component={SuggestionScreen} options={{ title: "Pick a meal" }}/>
        <Stack.Screen name="Fitness" component={FitnessScreen} options={{ title: "Fitness & workouts" }}/>
        <Stack.Screen name="GroceryList" component={GroceryListScreen} options={{ title: "Grocery list" }}/>
      </Stack.Navigator>
    </NavigationContainer>);
}
