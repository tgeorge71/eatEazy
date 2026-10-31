import type { ReactNode } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { StyleProp, TextInputProps, TextStyle, ViewStyle } from "react-native";
import { ERROR, HERB, INK, TOMATO, useDisplayFonts } from "@/theme";

// Shared building blocks so every screen uses the same warm cream-and-ink look.

export function PillButton({ label, onPress, secondary, disabled, style }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [ui.pill, secondary ? ui.secondary : ui.primary, disabled && ui.disabled, pressed && ui.pressed, style]}>
    <Text style={[ui.pillLabel, secondary && { color: INK }]}>{label}</Text>
  </Pressable>;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[ui.card, style]}>{children}</View>;
}

export function Heading({ children, size = 22, style }: { children: ReactNode; size?: number; style?: StyleProp<TextStyle> }) {
  const { display } = useDisplayFonts();
  return <Text accessibilityRole="header" style={[{ fontSize: size, lineHeight: size * 1.2, color: INK }, display, style]}>{children}</Text>;
}

export function Body({ children, fine, error, style }: { children: ReactNode; fine?: boolean; error?: boolean; style?: StyleProp<TextStyle> }) {
  return <Text style={[ui.body, fine && ui.fine, error && ui.error, style]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={ui.label}>{children}</Text>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <View style={ui.field}><Label>{label}</Label>{children}</View>;
}

export function ThemedInput(props: TextInputProps) {
  return <TextInput placeholderTextColor="#8A7A6E" {...props} style={[ui.input, props.style]} />;
}

export function Toggle({ label, value, change }: { label: string; value: boolean; change: (v: boolean) => void }) {
  return <View style={ui.toggle}>
    <Text style={[ui.body, { flex: 1 }]}>{label}</Text>
    <Switch accessibilityLabel={label} value={value} onValueChange={change} trackColor={{ true: HERB, false: "rgba(43,29,20,0.2)" }} thumbColor="white" />
  </View>;
}

export const ui = StyleSheet.create({
  screen: { padding: 20, paddingBottom: 48, gap: 16, width: "100%", maxWidth: 640, alignSelf: "center" },
  pill: { minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  primary: { backgroundColor: INK },
  secondary: { backgroundColor: "rgba(255,255,255,0.85)", borderWidth: 1, borderColor: "rgba(43,29,20,0.12)" },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
  pillLabel: { color: "white", fontSize: 15, fontWeight: "700", textAlign: "center" },
  card: { backgroundColor: "rgba(255,255,255,0.8)", borderRadius: 20, padding: 18, gap: 12, borderWidth: 1, borderColor: "rgba(43,29,20,0.08)" },
  body: { fontSize: 15, lineHeight: 22, color: INK },
  fine: { fontSize: 13, lineHeight: 18, opacity: 0.65 },
  error: { color: ERROR, fontWeight: "600" },
  label: { fontSize: 14, fontWeight: "700", color: INK },
  field: { gap: 8 },
  input: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, fontSize: 15, color: INK, backgroundColor: "rgba(255,255,255,0.95)", borderWidth: 1, borderColor: "rgba(43,29,20,0.15)" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 12 },
  accent: { color: TOMATO },
});
