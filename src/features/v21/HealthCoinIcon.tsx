import { useId } from "react";
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

/** Gold coins drawn locally so the balance never depends on a network image. */
export function HealthCoinIcon({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <Svg
      width={size}
      height={size}
      viewBox="-4 -4 56 56"
      style={{ flexShrink: 0 }}
      accessible={false}
    >
      <Defs>
        <LinearGradient id={`${id}face`} x1="0" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#fff2a7" />
          <Stop offset="0.45" stopColor="#ffdc58" />
          <Stop offset="1" stopColor="#f5ad1c" />
        </LinearGradient>
        <LinearGradient id={`${id}edge`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#f9cd41" />
          <Stop offset="1" stopColor="#d58b0e" />
        </LinearGradient>
      </Defs>
      <G rotation={-24} origin="30,17">
        <Path d="M15 16v6c0 5 30 5 30-1v-5Z" fill={`url(#${id}edge)`} />
        <Ellipse
          cx="30"
          cy="16"
          rx="15"
          ry="10"
          fill={`url(#${id}face)`}
          stroke="#f4c342"
        />
        <Ellipse
          cx="30"
          cy="16"
          rx="11.5"
          ry="7.2"
          fill="none"
          stroke="#fff0a1"
          strokeWidth="1.4"
        />
        <Path d="m31 11-4 5h4l-3 5 7-7h-5l2-3Z" fill="#e4a020" />
        <Path
          d="M20 13c3-4 9-5 14-3"
          fill="none"
          stroke="#fff8ce"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </G>
      <G rotation={-18} origin="17,32">
        <Path d="M2 29v7c0 12 30 12 30 0v-7Z" fill={`url(#${id}edge)`} />
        <Ellipse
          cx="17"
          cy="29"
          rx="15"
          ry="10.5"
          fill={`url(#${id}face)`}
          stroke="#f4c342"
        />
        <Ellipse
          cx="17"
          cy="29"
          rx="11.5"
          ry="7.5"
          fill="none"
          stroke="#fff0a1"
          strokeWidth="1.5"
        />
        <Path d="m18 24-4 5h4l-3 5 7-7h-5l2-3Z" fill="#e4a020" />
        <Path
          d="M7 26c3-4 8-5 13-3"
          fill="none"
          stroke="#fff8ce"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <Path
          d="M6 37v3m5-1v3m6-2v3m6-4v3m5-6v3"
          stroke="#fbe48b"
          strokeWidth="1.2"
        />
      </G>
    </Svg>
  );
}
