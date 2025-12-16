import Svg, { Circle } from 'react-native-svg';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export type ProgressRingProps = {
  percentage: number;
  label: string;
  size?: number;
  strokeWidth?: number;
  accentColor?: string;
};

export const ProgressRing = ({
  percentage,
  label,
  size = 120,
  strokeWidth = 10,
  accentColor = colors.secondary
}: ProgressRingProps) => {
  const normalizedRadius = size / 2 - strokeWidth;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - Math.min(Math.max(percentage, 0), 1) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}> 
      <Svg width={size} height={size}>
        <Circle
          stroke={colors.surfaceMuted}
          fill="transparent"
          strokeWidth={strokeWidth}
          cx={size / 2}
          cy={size / 2}
          r={normalizedRadius}
        />
        <Circle
          stroke={accentColor}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          cx={size / 2}
          cy={size / 2}
          r={normalizedRadius}
        />
      </Svg>
      <View style={styles.labelWrapper}>
        <Text style={styles.percent}>{Math.round(percentage * 100)}%</Text>
        <Text style={styles.label}>{label}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  labelWrapper: {
    position: 'absolute',
    alignItems: 'center'
  },
  percent: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs
  }
});
