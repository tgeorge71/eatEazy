import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Tagline from "@/components/Tagline";
import { useConstraints } from "@/context/ConstraintsContext";
import { useFitness } from "@/context/FitnessContext";
import { usePlan } from "@/context/PlanContext";
import type { RootStackParamList } from "@/navigation/RootNavigator";
type Props = NativeStackScreenProps<RootStackParamList, "Home">;
export default function HomeScreen({ navigation }: Props) {
    const { hasConstraints, isLoaded } = useConstraints();
    const { settings, loaded } = useFitness();
    const { clearPlan } = usePlan();
    useEffect(() => {
        if (isLoaded && !hasConstraints) {
            navigation.replace("ConstraintSetup");
        }
    }, [isLoaded, hasConstraints, navigation]);
    if (!isLoaded || !hasConstraints) {
        return <View style={styles.container}/>;
    }
    function startPlan(planType: "tonight" | "today" | "week") {
        if (!loaded)
            return;
        if (planType !== "tonight" && !settings.profile) {
            navigation.navigate("Fitness");
            return;
        }
        clearPlan();
        navigation.navigate("Suggestions", { planType });
    }
    return (<View style={styles.container}>
      <Text style={styles.title}>eatEazy</Text>
      <Tagline text="Simplifying the way people make food"/>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={() => startPlan("tonight")}>
          <Text style={styles.primaryButtonText}>Plan tonight</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={() => startPlan("today")}><Text style={styles.primaryButtonText}>Plan today</Text></Pressable>
        <Pressable style={styles.primaryButton} onPress={() => startPlan("week")}>
          <Text style={styles.primaryButtonText}>Plan this week</Text>
        </Pressable>
      </View>

      <Pressable onPress={() => navigation.navigate("Account")}><Text style={styles.editLink}>Account & connections</Text></Pressable>
      <Pressable onPress={() => navigation.navigate("Fitness")}><Text style={styles.editLink}>Fitness profile & workouts</Text></Pressable>
      <Pressable onPress={() => navigation.navigate("ConstraintSetup")}>
        <Text style={styles.editLink}>Edit preferences</Text>
      </Pressable>
    </View>);
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    title: {
        fontSize: 32,
        fontWeight: "700",
        marginBottom: 8,
    },
    actions: {
        marginTop: 40,
        width: "100%",
        gap: 12,
    },
    primaryButton: {
        backgroundColor: "#2f6f4f",
        borderRadius: 10,
        paddingVertical: 16,
        alignItems: "center",
    },
    primaryButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "700",
    },
    editLink: {
        marginTop: 24,
        color: "#2f6f4f",
        fontSize: 14,
    },
});
