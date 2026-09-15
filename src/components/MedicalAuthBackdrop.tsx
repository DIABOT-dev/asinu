import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Circle, G, Path, Rect, Svg } from 'react-native-svg';

export interface MedicalAuthBackdropProps {
  width: number;
  height: number;
  isDark: boolean;
  ecgY?: number;
}

export function MedicalAuthBackdrop({
  width,
  height,
  isDark,
  ecgY = 205,
}: MedicalAuthBackdropProps) {
  const gradientColors = isDark
    ? (['#0A1A2F', '#0D233A', '#0F172A', '#0D1B2A'] as const)
    : (['#E1F5FA', '#EBF7FA', '#FAFCFE', '#FFFFFF', '#F0F9FE', '#C9ECFC'] as const);

  const p1 = Math.max(width * 0.12, 40);
  const p2 = Math.max(width * 0.18, 65);
  const p3 = Math.max(width * 0.22, 80);
  const p4 = Math.max(width * 0.26, 95);
  const p5 = Math.max(width * 0.30, 115);
  const p6 = Math.max(width * 0.34, 130);
  const p7 = Math.max(width * 0.38, 150);

  const q1 = Math.min(width * 0.62, width - 150);
  const q2 = Math.min(width * 0.66, width - 130);
  const q3 = Math.min(width * 0.70, width - 115);
  const q4 = Math.min(width * 0.74, width - 95);
  const q5 = Math.min(width * 0.78, width - 80);
  const q6 = Math.min(width * 0.82, width - 65);
  const q7 = Math.min(width * 0.88, width - 40);

  const crossColor = isDark ? '#38BDF8' : '#BAE6FD';
  const crossOpacity = isDark ? 0.22 : 0.9;
  const ecgStroke = isDark ? '#38BDF8' : '#BAE6FD';
  const dotColor = isDark ? '#38BDF8' : '#7DD3FC';

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <LinearGradient
        colors={gradientColors}
        locations={[0, 0.15, 0.35, 0.65, 0.85, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
        {/* Ambient Corner Silhouettes / Bubbles */}
        <Circle
          cx={0}
          cy={120}
          r={170}
          fill={isDark ? '#0284C7' : '#D2F2FA'}
          opacity={isDark ? 0.08 : 0.6}
        />
        <Circle
          cx={width + 30}
          cy={160}
          r={180}
          fill={isDark ? '#0284C7' : '#DDF6F9'}
          opacity={isDark ? 0.08 : 0.55}
        />
        <Circle
          cx={-20}
          cy={height - 80}
          r={230}
          fill={isDark ? '#0284C7' : '#BEEBFB'}
          opacity={isDark ? 0.08 : 0.65}
        />
        <Circle
          cx={width + 40}
          cy={height - 60}
          r={250}
          fill={isDark ? '#0284C7' : '#B6E5FE'}
          opacity={isDark ? 0.08 : 0.65}
        />

        {/* Top-Left Medical Cross */}
        <G opacity={crossOpacity} transform="translate(32, 118)">
          <Rect x="0" y="15" width="46" height="16" rx="6" fill={crossColor} />
          <Rect x="15" y="0" width="16" height="46" rx="6" fill={crossColor} />
        </G>

        {/* Top-Right Medical Cross */}
        <G opacity={crossOpacity} transform={`translate(${Math.max(width - 72, 280)}, 165)`}>
          <Rect x="0" y="14" width="42" height="14" rx="5" fill={crossColor} />
          <Rect x="14" y="0" width="14" height="42" rx="5" fill={crossColor} />
        </G>

        {/* Heartbeat ECG Pulse Wave behind the logo */}
        <Path
          d={`M 0 ${ecgY} L ${p1} ${ecgY} L ${p2} ${ecgY - 6} L ${p3} ${ecgY + 12} L ${p4} ${ecgY - 45} L ${p5} ${ecgY + 32} L ${p6} ${ecgY - 14} L ${p7} ${ecgY} L ${q1} ${ecgY} L ${q2} ${ecgY - 8} L ${q3} ${ecgY + 14} L ${q4} ${ecgY - 42} L ${q5} ${ecgY + 28} L ${q6} ${ecgY - 10} L ${q7} ${ecgY} L ${width} ${ecgY}`}
          fill="none"
          stroke={ecgStroke}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={isDark ? 0.28 : 0.85}
        />

        {/* Bottom-Left Dot Grid Matrix */}
        <G opacity={isDark ? 0.25 : 0.55} transform={`translate(28, ${Math.max(height - 180, 520)})`}>
          {[0, 1, 2, 3].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <Circle
                key={`dot-${r}-${c}`}
                cx={c * 15}
                cy={r * 15}
                r={2.8}
                fill={dotColor}
              />
            ))
          )}
        </G>

        {/* Bottom-Right Medical Cross */}
        <G opacity={crossOpacity} transform={`translate(${Math.max(width - 74, 280)}, ${Math.max(height - 140, 560)})`}>
          <Rect x="0" y="15" width="46" height="16" rx="6" fill={crossColor} />
          <Rect x="15" y="0" width="16" height="46" rx="6" fill={crossColor} />
        </G>
      </Svg>
    </View>
  );
}
