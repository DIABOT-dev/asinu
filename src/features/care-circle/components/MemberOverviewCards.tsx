import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Avatar } from '../../../components/Avatar';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useScaledFontSize } from '../../../hooks/useScaledTypography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { spacing } from '../../../styles';
import type { MemberHealthOverview } from '../care-circle.api';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
type Tone = 'bloodPressure' | 'glucose' | 'medication' | 'weight' | 'meal' | 'primary';
type HealthStatus = 'loading' | 'ready' | 'denied' | 'error';

function CategoryIcon({ name, tone }: { name: IconName; tone: Tone }) {
  const { colors, categoryColors } = useThemeColors();
  const tint = tone === 'primary' ? colors.primaryText : categoryColors[tone];
  const fill = tone === 'primary' ? colors.primaryLight : categoryColors[`${tone}Bg`];
  return (
    <View style={[styles.icon, { backgroundColor: fill }]}>
      <MaterialCommunityIcons name={name} size={23} color={tint} accessible={false} />
    </View>
  );
}

function positive(value: string | number | null | undefined) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function MemberProfileCard({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const { t } = useTranslation('careCircle');
  const { colors } = useThemeColors();
  return (
    <View style={[styles.identity, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.identityAvatar, { borderColor: colors.primary }]}>
        <Avatar name={name} imageUrl={avatarUrl} size={60}
          containerStyle={{ backgroundColor: colors.primaryLight, borderWidth: 0 }}
          initialsStyle={{ color: colors.primaryText, fontSize: 23 }} />
      </View>
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.identityName, { color: colors.textPrimary }]}>{name}</Text>
        <Text style={[styles.caption, { color: colors.primaryText }]}>{t('familyProfileLabel')}</Text>
      </View>
    </View>
  );
}

export function MemberHealthMetrics({ data, status, onRetry }: {
  data?: MemberHealthOverview;
  status: HealthStatus;
  onRetry: () => void;
}) {
  const { t, i18n } = useTranslation('careCircle');
  const { t: logs } = useTranslation('logs');
  const { colors } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const labelSize = useScaledFontSize(13);
  const twoColumns = width < 375 || labelSize * fontScale > 16;
  const numberFormat = new Intl.NumberFormat(i18n.resolvedLanguage || i18n.language, { maximumFractionDigits: 1 });
  const weight = positive(data?.weightKg);
  const height = positive(data?.heightCm);
  const bmi = weight && height ? weight / Math.pow(height / 100, 2) : null;
  const metrics: { key: string; label: string; value: number | string | null; unit?: string; icon: IconName; tone: Tone }[] = [
    { key: 'bp', label: logs('bloodPressure'), value: positive(data?.systolic) && positive(data?.diastolic) ? `${data?.systolic}/${data?.diastolic}` : null, unit: data?.bloodPressureUnit || 'mmHg', icon: 'heart-pulse', tone: 'bloodPressure' },
    { key: 'pulse', label: t('familyPulse'), value: positive(data?.pulse), unit: 'bpm', icon: 'pulse', tone: 'primary' },
    { key: 'weight', label: logs('weight'), value: weight, unit: 'kg', icon: 'scale-bathroom', tone: 'weight' },
    { key: 'bmi', label: t('familyBmi'), value: bmi, icon: 'human', tone: 'meal' },
  ];
  const surface = { backgroundColor: colors.surface, borderColor: colors.border };
  if (status !== 'ready') {
    return (
      <View style={[styles.notice, surface]}>
        {status === 'loading' ? (
          <ActivityIndicator color={colors.primaryText} accessibilityLabel={t('familyMetricsLoading')} />
        ) : (
          <>
            <MaterialCommunityIcons name={status === 'denied' ? 'lock-outline' : 'information-outline'} size={21} color={colors.primaryText} accessible={false} />
            <Text style={[styles.copy, styles.caption, { color: colors.textSecondary }]}>
              {t(status === 'denied' ? 'healthAccessRequired' : 'familyMetricsError')}
            </Text>
            {status === 'error' && <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry}>
              <Text style={{ color: colors.primaryText }}>{t('familyRetry')}</Text>
            </Pressable>}
          </>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.metrics, surface]} testID="family-health-metrics">
      {metrics.map(metric => (
        <View key={metric.key} style={[styles.metric, { width: twoColumns ? '50%' : '25%' }]}>
          <CategoryIcon name={metric.icon} tone={metric.tone} />
          <Text style={[styles.metricLabel, { color: colors.textSecondary }]}>{metric.label}</Text>
          <Text style={[styles.metricValue, { color: colors.textPrimary }]}>
            {typeof metric.value === 'number' ? numberFormat.format(metric.value) : metric.value ?? '–'}
          </Text>
          {metric.unit && <Text style={[styles.unit, { color: colors.textSecondary }]}>{metric.unit}</Text>}
        </View>
      ))}
    </View>
  );
}

export function FamilyActionCard({ title, description, icon, tone, onPress, tile = false }: {
  title: string;
  description?: string;
  icon: IconName;
  tone: Tone;
  onPress?: () => void;
  tile?: boolean;
}) {
  const { colors } = useThemeColors();
  const body = (
    <>
      <CategoryIcon name={icon} tone={tone} />
      <View style={styles.copy}>
        <Text style={[styles.actionTitle, { color: colors.textPrimary }]}>{title}</Text>
        {description && <Text style={[styles.caption, { color: colors.textSecondary }]}>{description}</Text>}
      </View>
      {onPress && <MaterialCommunityIcons name="chevron-right" size={21} color={colors.textSecondary}
        style={tile && styles.tileArrow} accessible={false} />}
    </>
  );
  const surface = { backgroundColor: colors.surface, borderColor: colors.border };
  const layout = [styles.action, tile && styles.tile, surface];
  if (!onPress) return <View style={layout}>{body}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityHint={description}
      onPress={onPress} style={({ pressed }) => [...layout, pressed && { backgroundColor: colors.primaryLight }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: 20, borderWidth: 1 },
  identityAvatar: { padding: 3, borderRadius: 36, borderWidth: 1.5 },
  identityName: { fontSize: 21, fontWeight: '700' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  caption: { fontSize: 13 },
  icon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  metrics: { borderRadius: 20, borderWidth: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.xs },
  metric: { alignItems: 'center', gap: 4, paddingHorizontal: 3 },
  metricLabel: { fontSize: 13, textAlign: 'center', marginTop: 3 },
  metricValue: { fontSize: 19, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 11, textAlign: 'center' },
  notice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minHeight: 76, gap: spacing.sm, padding: spacing.md, borderWidth: 1, borderRadius: 20 },
  retry: { minHeight: 44, justifyContent: 'center' },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 68, padding: spacing.sm + 2, borderRadius: 16, borderWidth: 1 },
  actionTitle: { fontSize: 15, fontWeight: '600' },
  tile: { flex: 1, flexDirection: 'column', alignItems: 'flex-start', minHeight: 118, padding: spacing.md },
  tileArrow: { position: 'absolute', top: 22, right: 12 },
});
