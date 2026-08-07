import { StyleSheet, Text } from "react-native";

type TaglineProps = {
  text: string;
};

export default function Tagline({ text }: TaglineProps) {
  return <Text style={styles.text}>{text}</Text>;
}

const styles = StyleSheet.create({
  text: {
    fontSize: 16,
    color: "#666666",
    textAlign: "center",
  },
});
