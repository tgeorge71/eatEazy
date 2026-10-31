import { useFonts } from "expo-font";
// Per-weight imports keep the other 16 Fraunces files out of the bundle.
import { Fraunces_800ExtraBold } from "@expo-google-fonts/fraunces/800ExtraBold";
import { Fraunces_800ExtraBold_Italic } from "@expo-google-fonts/fraunces/800ExtraBold_Italic";
import type { TextStyle } from "react-native";
export { CREAM } from "@/components/BlobBackground";

export const INK = "#2B1D14";
export const TOMATO = "#E2502A";

// Falls back to the system bold face until Fraunces loads, so text never blocks on fonts.
export function useDisplayFonts(): { display: TextStyle; displayItalic: TextStyle } {
  const [loaded] = useFonts({ Fraunces_800ExtraBold, Fraunces_800ExtraBold_Italic });
  return loaded
    ? { display: { fontFamily: "Fraunces_800ExtraBold" }, displayItalic: { fontFamily: "Fraunces_800ExtraBold_Italic" } }
    : { display: { fontWeight: "800" }, displayItalic: { fontWeight: "800", fontStyle: "italic" } };
}

export const HERB = "#3F7D52";
export const ERROR = "#B3261E";
