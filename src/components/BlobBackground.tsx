import { StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

export const CREAM = "#FBF4EA";

// Soft radial blobs fading to transparent stand in for a CSS blur, which RN 0.74 lacks.
const BLOBS = [
  { id: "tomato", color: "#F2643D", x: 0.95, y: 0.08, r: 0.75 },
  { id: "saffron", color: "#F6B33D", x: 0.0, y: 0.42, r: 0.7 },
  { id: "herb", color: "#5E9E6E", x: 0.75, y: 1.0, r: 0.8 },
  { id: "blush", color: "#F7A9A0", x: 0.2, y: 0.88, r: 0.4 },
];

export default function BlobBackground() {
  const { width, height } = useWindowDimensions();
  const base = Math.max(width, height * 0.6);
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: CREAM }]}>
    <Svg width={width} height={height}>
      <Defs>
        {BLOBS.map(blob => <RadialGradient key={blob.id} id={blob.id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={blob.color} stopOpacity={0.85} />
          <Stop offset="0.55" stopColor={blob.color} stopOpacity={0.35} />
          <Stop offset="1" stopColor={blob.color} stopOpacity={0} />
        </RadialGradient>)}
      </Defs>
      {BLOBS.map(blob => <Circle key={blob.id} cx={blob.x * width} cy={blob.y * height} r={blob.r * base} fill={`url(#${blob.id})`} />)}
    </Svg>
  </View>;
}
