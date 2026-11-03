import { useId } from "react";
import Svg, {
  Defs,
  Circle,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

/** A complete round coin with space around every edge at small icon sizes. */
export function HealthCoinIcon({ size = 36 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
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
      <Circle cx="24" cy="24" r="21" fill={`url(#${id}edge)`} />
      <Circle
        cx="24"
        cy="23"
        r="19.5"
        fill={`url(#${id}face)`}
        stroke="#f4c342"
      />
      <Circle
        cx="24"
        cy="23"
        r="15.5"
        fill="none"
        stroke="#fff0a1"
        strokeWidth="1.5"
      />
      <Path
        d="M11 17a15 15 0 0 1 15-9"
        fill="none"
        stroke="#fff8ce"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <Path d="m26 12-11 14h8l-2 10 12-16h-9l2-8Z" fill="#dc9918" />
    </Svg>
  );
}
