import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';

export type M1MetricCardProps = {
  title: string;
  value: string | number;
  unit?: string;
  delta?: number;
  trend?: 'up' | 'down' | 'flat';
  accentColor?: string;
  accentGradient?: [string, string];
  icon?: ReactNode;
  footnote?: string;
  onPress?: () => void;
};

const trendKeys = {
  up: 'higherThanNormal',
  down: 'lowerThanNormal',
  flat: 'stable'
} as const;

export const M1MetricCard = ({
  title,
  value,
  unit,
  delta,
  trend = 'flat',
  accentColor = colors.primary,
  accentGradient = [colors.primaryDark, colors.primary],
  icon,
  footnote,
  onPress
}: M1MetricCardProps) => {
  const { t } = useTranslation('tree');
  const scaledTypography = useScaledTypography();
  const Container = onPress ? Pressable : View;

  return (
    <Container style={[styles.card, { borderColor: accentColor }]} onPress={onPress}>
      <LinearGradient colors={accentGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.accent}>
        {icon || <Ionicons name="pulse" size={20} color={colors.surface} />}
      </LinearGradient>
      <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>{title}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { fontSize: scaledTypography.size.xl }]}>{value}</Text>
        {unit ? <Text style={[styles.unit, { fontSize: scaledTypography.size.sm }]}>{unit}</Text> : null}
      </View>
      {delta !== undefined ? (
        <Text style={[styles.delta, { color: trend === 'down' ? colors.danger : colors.success, fontSize: scaledTypography.size.md }]}>
          {delta > 0 ? '+' : ''}
          {delta}
        </Text>
      ) : null}
      <Text style={[styles.helper, { fontSize: scaledTypography.size.sm }]}>{footnote || t(trendKeys[trend])}</Text>
    </Container>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: spacing.lg,
    borderRadius: 20,
    borderWidth: 1.5,
    borderStyle: 'solid',
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
    color: colors.textSecondary,
    fontWeight: '700'
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs
  },
  value: {
    color: colors.textPrimary,
    fontWeight: '700'
  },
  unit: {
    color: colors.textSecondary,
    marginBottom: spacing.xs
  },
  delta: {
    fontWeight: '600'
  },
  helper: {
    color: colors.textSecondary
  }
});
