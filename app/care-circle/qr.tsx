import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { careCircleApi, type CareCircleQrToken } from '../../src/features/care-circle';
import { useGuardedRouter as useRouter } from '../../src/hooks/useGuardedRouter';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { radius, spacing } from '../../src/styles';

function secondsUntil(value?: string) {
  if (!value) {
    return 0;
  }
  return Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 1000));
}

function formatRemaining(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export default function CareCircleQrScreen() {
  const { t } = useTranslation('careCircle');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const typography = useScaledTypography();
  const { colors, isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(typography, colors, isDark), [colors, isDark, typography]);
  const profile = useAuthStore((state) => state.profile);
  const [qr, setQr] = useState<CareCircleQrToken | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const qrSize = Math.min(280, Math.max(220, width - 96));

  const createCode = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await careCircleApi.createQrToken();
      setQr(next);
      setRemaining(secondsUntil(next.expiresAt));
    } catch (err) {
      setQr(null);
      setError(getApiErrorMessage(err, t, 'qrCreateError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    createCode().catch(() => {});
  }, [createCode]);

  useEffect(() => {
    if (!qr?.expiresAt) {
      return;
    }
    const timer = setInterval(() => setRemaining(secondsUntil(qr.expiresAt)), 1000);
    return () => clearInterval(timer);
  }, [qr?.expiresAt]);

  const displayName = profile?.name || t('qrFallbackName');
  const expired = Boolean(qr) && remaining === 0;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <ScreenBackButton onPress={() => router.back()} style={styles.headerIconButton} />
        <Text style={styles.headerTitle}>{t('myQrTitle')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.intro}>
          <Ionicons name="people-outline" size={32} color={colors.primary} />
          <View style={styles.introCopy}>
            <Text style={styles.title}>{t('myQrHeading')}</Text>
            <Text style={styles.subtitle}>{t('myQrDescription')}</Text>
          </View>
        </View>

        <View style={styles.qrPanel}>
          <View style={styles.personRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName.trim().charAt(0).toUpperCase() || t('qrFallbackName').charAt(0)}
              </Text>
            </View>
            <View style={styles.personCopy}>
              <Text numberOfLines={1} style={styles.personName}>{displayName}</Text>
              <Text style={styles.personMeta}>{t('qrIdentityHint')}</Text>
            </View>
          </View>

          <View style={styles.qrWrap}>
            {loading ? (
              <View style={[styles.qrPlaceholder, { width: qrSize, height: qrSize }]}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>{t('qrCreating')}</Text>
              </View>
            ) : qr && !expired ? (
              <QRCode
                value={qr.value}
                size={qrSize}
                color="#071A18"
                backgroundColor="#FCFFFE"
                quietZone={12}
              />
            ) : (
              <View style={[styles.qrPlaceholder, { width: qrSize, height: qrSize }]}>
                <Ionicons name="time-outline" size={42} color={colors.textSecondary} />
                <Text style={styles.expiredTitle}>{t('qrExpiredTitle')}</Text>
                <Text style={styles.loadingText}>{error || t('qrExpiredDescription')}</Text>
              </View>
            )}
          </View>

          {!loading && qr && !expired ? (
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={17} color={colors.primaryDark} />
              <Text style={styles.timerText}>{t('qrExpiresIn', { time: formatRemaining(remaining) })}</Text>
            </View>
          ) : null}

          {error && !qr ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('qrRefresh')}
            disabled={loading}
            onPress={() => createCode().catch(() => {})}
            style={({ pressed }) => [styles.refreshButton, pressed && styles.pressed, loading && styles.disabled]}
          >
            <Ionicons name="refresh" size={20} color={colors.primary} />
            <Text style={styles.refreshText}>{t('qrRefresh')}</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('scanQr')}
          onPress={() => router.push('/care-circle/scan' as never)}
          style={({ pressed }) => [styles.scanButton, pressed && styles.pressed]}
        >
          <Ionicons name="scan" size={24} color="#F7FFFD" />
          <Text style={styles.scanButtonText}>{t('scanSomeoneQr')}</Text>
        </Pressable>

        <View style={styles.privacyRow}>
          <Ionicons name="shield-checkmark-outline" size={19} color={colors.textSecondary} />
          <Text style={styles.privacyText}>{t('qrPrivacy')}</Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  colors: ReturnType<typeof useThemeColors>['colors'],
  isDark: boolean,
) {
  return StyleSheet.create({
    header: { alignItems: 'center', flexDirection: 'row', minHeight: 62, paddingHorizontal: spacing.lg },
    headerTitle: { color: colors.textPrimary, flex: 1, fontSize: typography.size.lg, fontWeight: '800', textAlign: 'center' },
    headerSpacer: { width: 44 },
    headerIconButton: { backgroundColor: 'transparent', borderWidth: 0, elevation: 0, shadowOpacity: 0 },
    content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: spacing.md },
    intro: { alignItems: 'center', flexDirection: 'row', gap: spacing.md, marginBottom: spacing.lg },
    introCopy: { flex: 1 },
    title: { color: colors.textPrimary, fontSize: typography.size.xl, fontWeight: '900', lineHeight: 30 },
    subtitle: { color: colors.textSecondary, fontSize: typography.size.sm, lineHeight: 20, marginTop: 3 },
    qrPanel: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xxl, borderWidth: 1, padding: spacing.lg },
    personRow: { alignItems: 'center', alignSelf: 'stretch', flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
    avatar: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: 18, height: 44, justifyContent: 'center', width: 44 },
    avatarText: { color: colors.primaryDark, fontSize: typography.size.md, fontWeight: '900' },
    personCopy: { flex: 1 },
    personName: { color: colors.textPrimary, fontSize: typography.size.md, fontWeight: '800' },
    personMeta: { color: colors.textSecondary, fontSize: typography.size.xs, marginTop: 2 },
    qrWrap: { alignItems: 'center', backgroundColor: '#FCFFFE', borderColor: isDark ? '#315451' : '#D7E9E6', borderRadius: 24, borderWidth: 1, justifyContent: 'center', overflow: 'hidden' },
    qrPlaceholder: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
    loadingText: { color: colors.textSecondary, fontSize: typography.size.sm, lineHeight: 20, marginTop: spacing.sm, textAlign: 'center' },
    expiredTitle: { color: colors.textPrimary, fontSize: typography.size.md, fontWeight: '800', marginTop: spacing.sm },
    timerRow: { alignItems: 'center', backgroundColor: colors.primaryLight, borderRadius: radius.full, flexDirection: 'row', gap: 6, marginTop: spacing.md, paddingHorizontal: 12, paddingVertical: 7 },
    timerText: { color: colors.primaryDark, fontSize: typography.size.xs, fontWeight: '700' },
    errorText: { color: colors.danger, fontSize: typography.size.sm, marginTop: spacing.md, textAlign: 'center' },
    refreshButton: { alignItems: 'center', flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: spacing.md, minHeight: 44, paddingHorizontal: spacing.md },
    refreshText: { color: colors.primary, fontSize: typography.size.sm, fontWeight: '800' },
    scanButton: { alignItems: 'center', backgroundColor: colors.primary, borderRadius: radius.lg, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.lg, minHeight: 54, paddingHorizontal: spacing.lg },
    scanButtonText: { color: '#F7FFFD', fontSize: typography.size.md, fontWeight: '800' },
    privacyRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md, paddingHorizontal: spacing.sm },
    privacyText: { color: colors.textSecondary, flex: 1, fontSize: typography.size.xs, lineHeight: 18 },
    pressed: { opacity: 0.82 },
    disabled: { opacity: 0.55 },
  });
}
