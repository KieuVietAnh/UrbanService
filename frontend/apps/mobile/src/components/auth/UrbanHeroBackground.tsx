
import React from "react";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Rect,
  Path,
  Circle,
  G,
} from "react-native-svg";

export default function UrbanHeroBackground() {
  return (
    <Svg width="100%" height="320" viewBox="0 0 390 320">
      <Defs>
        {/* Background */}
        <LinearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#F8FBFF" />
          <Stop offset="100%" stopColor="#EAF3FF" />
        </LinearGradient>

        {/* Location Pin */}
        <LinearGradient id="pin" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#60A5FA" />
          <Stop offset="100%" stopColor="#2563EB" />
        </LinearGradient>

        {/* Bottom Fade */}
        <LinearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <Stop offset="100%" stopColor="#FFFFFF" stopOpacity="1" />
        </LinearGradient>
      </Defs>

      {/* Background */}
      <Rect width="390" height="320" fill="url(#bg)" />

      {/* Decorative Clouds */}
      <G opacity={0.5}>
        <Circle cx="70" cy="40" r="14" fill="white" />
        <Circle cx="86" cy="40" r="11" fill="white" />
        <Circle cx="100" cy="40" r="14" fill="white" />

        <Circle cx="280" cy="55" r="20" fill="white" />
        <Circle cx="302" cy="55" r="16" fill="white" />
        <Circle cx="323" cy="55" r="20" fill="white" />
      </G>

      {/* Background City Layer */}
      <G opacity={0.08}>
        <Rect x="135" y="120" width="20" height="70" fill="#2563EB" />
        <Rect x="165" y="95" width="28" height="95" fill="#2563EB" />
        <Rect x="205" y="80" width="32" height="110" fill="#2563EB" />
        <Rect x="250" y="105" width="24" height="85" fill="#2563EB" />
        <Rect x="285" y="90" width="30" height="100" fill="#2563EB" />
      </G>

      {/* Main Skyline */}
      <G opacity={0.18}>
        <Rect
          x="145"
          y="120"
          width="24"
          height="80"
          rx="4"
          fill="#2563EB"
        />

        <Rect
          x="180"
          y="90"
          width="32"
          height="110"
          rx="4"
          fill="#2563EB"
        />

        <Rect
          x="225"
          y="65"
          width="42"
          height="135"
          rx="4"
          fill="#2563EB"
        />

        <Rect
          x="280"
          y="100"
          width="28"
          height="100"
          rx="4"
          fill="#2563EB"
        />
      </G>

      {/* Trees */}
      <G opacity={0.18}>
        <Circle cx="55" cy="205" r="12" fill="#60A5FA" />
        <Rect x="52" y="205" width="5" height="15" fill="#60A5FA" />

        <Circle cx="325" cy="205" r="11" fill="#60A5FA" />
        <Rect x="322" y="205" width="5" height="15" fill="#60A5FA" />
      </G>

      {/* Smart City Network */}
      <G opacity={0.18}>
        <Path
          d="M40 180 C110 145 170 200 240 165"
          stroke="#2563EB"
          strokeWidth="2"
          fill="none"
        />

        <Path
          d="M120 145 C180 120 250 180 345 135"
          stroke="#2563EB"
          strokeWidth="2"
          fill="none"
        />

        <Path
          d="M65 210 C130 185 210 220 295 190"
          stroke="#2563EB"
          strokeWidth="2"
          fill="none"
        />

        <Circle cx="40" cy="180" r="4" fill="#2563EB" />
        <Circle cx="120" cy="145" r="4" fill="#2563EB" />
        <Circle cx="240" cy="165" r="4" fill="#2563EB" />
        <Circle cx="345" cy="135" r="4" fill="#2563EB" />
        <Circle cx="65" cy="210" r="4" fill="#2563EB" />
        <Circle cx="295" cy="190" r="4" fill="#2563EB" />
      </G>

      {/* Heatmap Dots */}
      <G opacity={0.15}>
        <Circle cx="95" cy="120" r="5" fill="#60A5FA" />
        <Circle cx="110" cy="155" r="4" fill="#60A5FA" />
        <Circle cx="300" cy="115" r="5" fill="#60A5FA" />
        <Circle cx="330" cy="175" r="4" fill="#60A5FA" />
      </G>

      {/* AI Pulse Rings */}
      <G opacity={0.12}>
        <Circle
          cx="310"
          cy="145"
          r="38"
          fill="none"
          stroke="#2563EB"
          strokeWidth="2"
        />
        <Circle
          cx="310"
          cy="145"
          r="52"
          fill="none"
          stroke="#2563EB"
          strokeWidth="2"
        />
      </G>

      {/* Main Location Pin */}
      <G transform="translate(275,110)">
        <Path
          d="
            M30 0
            C46 0 60 14 60 30
            C60 52 30 82 30 82
            C30 82 0 52 0 30
            C0 14 14 0 30 0
          "
          fill="url(#pin)"
        />

        <Circle cx="30" cy="30" r="11" fill="white" />
      </G>

      {/* Soft Bottom Fade */}
      <Rect
        x="0"
        y="165"
        width="390"
        height="155"
        fill="url(#fade)"
      />
    </Svg>
  );
}
