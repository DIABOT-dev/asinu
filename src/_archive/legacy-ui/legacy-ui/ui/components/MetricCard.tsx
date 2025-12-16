import { ReactNode } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export type MetricCardProps = {
  title: string;
  value: string | number;
  unit?: string;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  accentColor?: string;
  icon?: ReactNode;
  footnote?: string;
  onPress?: () => void;
};

const trendCopy = {
  up: 'Higher than usual',
  down: 'Lower than usual',
  flat: 'On track'
};

export const MetricCard = ({
  title,
  value,
  unit,
  delta,
  trend = 'flat',
  accentColor = colors.primary,
  icon,
  footnote,
  onPress
}: MetricCardProps) => {
  const Container = onPress ? Pressable : View;

  return (
    <Container style={[styles.card, { borderColor: accentColor }]} onPress={onPress}>
      <LinearGradient colors={[accentColor, '#6f6bff']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.accent}>
        {icon || <Text style={styles.accentLabel}>◎</Text>}
      </LinearGradient>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.valueRow}>
        <Text style={styles.value}>{value}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {delta !== undefined ? (
        <Text style={[styles.delta, { color: trend === 'down' ? colors.danger : colors.success }]}>
          {delta > 0 ? '+' : ''}
          {delta}
        </Text>
      ) : null}
      <Text style={styles.helper}>{footnote || trendCopy[trend]}</Text>
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: colors.surface,
    gap: spacing.sm
  },
  accent: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  accentLabel: {
    color: colors.surface,
    fontWeight: '600'
  },
  title: {
    fontSize: 14,
    color: colors.textSecondary
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs
  },
  value: {
    fontSize: 32,
    color: colors.textPrimary,
    fontWeight: '700'
  },
  unit: {
    color: colors.textSecondary,
    marginBottom: spacing.xs
  },
  delta: {
    fontSize: 16,
    fontWeight: '600'
  },
  helper: {
    fontSize: 12,
    color: colors.textSecondary
  }
});
