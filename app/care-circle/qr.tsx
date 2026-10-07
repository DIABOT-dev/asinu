import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import Svg, { Path } from 'react-native-svg';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Screen } from '../../src/components/Screen';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { authApi } from '../../src/features/auth/auth.api';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useProfileStore } from '../../src/features/profile/profile.store';
import { careCircleApi, type CareCircleQrToken } from '../../src/features/care-circle';
import { useGuardedRouter as useRouter } from '../../src/hooks/useGuardedRouter';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { radius, spacing } from '../../src/styles';

export default function CareCircleQrScreen() {
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const typography = useScaledTypography();
  const { colors, isDark } = useThemeColors();
  const styles = useMemo(
    () => createStyles(typography, colors, isDark, insets),
    [colors, isDark, typography, insets],
  );

  const authProfile = useAuthStore((state) => state.profile);
  const authToken = useAuthStore((state) => state.token);
  const account = authProfile?.id == null ? null : String(authProfile.id);
  const profileStore = useProfileStore((state) => state.profile);
  const profile = authProfile || profileStore;

  const [code, setCode] = useState<{ account: string; qr: CareCircleQrToken } | null>(null);
  const qr = code?.account === account ? code.qr : null;
  const requestVersion = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Dimensions
  const qrBoxSize = Math.min(270, Math.max(220, width - 110));
  const qrCodeSize = qrBoxSize - 44;

  // Refresh profile from server on mount to ensure fresh avatar & name
  useEffect(() => {
    if (!account || !authToken) return;
    let active = true;
    authApi
      .fetchProfile()
      .then((p) => {
        const current = useAuthStore.getState();
        if (active && p && String(p.id) === account
          && String(current.profile?.id) === account && current.token === authToken) {
          useAuthStore.setState({ profile: p });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, [account, authToken]);

  const loadCode = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!account || !authToken) {
      setCode(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // The server returns the same account-owned code on every visit/device.
      const next = await careCircleApi.createQrToken();
      if (version !== requestVersion.current) return;
      setCode({ account, qr: next });
    } catch (err) {
      if (version !== requestVersion.current) return;
      setCode(null);
      setError(getApiErrorMessage(err, t, 'qrCreateError'));
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [account, authToken, t]);

  useEffect(() => {
    void loadCode();
    return () => { ++requestVersion.current; };
  }, [loadCode]);

  const displayName = profile?.name || profileStore?.name || t('qrFallbackName');
  const avatarUrl = profile?.avatarUrl || profileStore?.avatarUrl;

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={
          isDark
            ? ['#0f172a', '#132034', '#0f172a']
            : ['#f0fbf8', '#f8fdfb', '#eef9f5']
        }
        style={styles.rootGradient}
      >
        {/* Top Header Bar with round back button */}
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={tc('back')}
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Intro Section */}
          <View style={styles.introRow}>
            <View style={styles.introLeftCol}>
              <View style={styles.titleRow}>
                <MaterialCommunityIcons
                  name="account-group-outline"
                  size={32}
                  color={colors.primary}
                  style={styles.peopleIcon}
                />
                <View style={styles.titleTextCol}>
                  <Text style={styles.titleLine1}>{t('myQrHeadingPart1')}</Text>
                  <Text style={styles.titleLine2}>{t('myQrHeadingPart2')}</Text>
                </View>
              </View>
              <Text style={styles.subtitle}>{t('myQrDescription')}</Text>
            </View>

            <Image
              cachePolicy="memory-disk"
              contentFit="contain"
              source={require('../../assets/images/care-circle/qr_heart_bubble.png')}
              style={styles.heartBubbleImg}
            />
          </View>

          {/* Central White Card */}
          <View style={styles.card}>
            {/* Person Info Row */}
            <View style={styles.personRow}>
              <View style={styles.avatarWrap}>
                {avatarUrl ? (
                  <Image
                    cachePolicy="memory-disk"
                    contentFit="cover"
                    source={{ uri: avatarUrl }}
                    style={styles.avatarImg}
                  />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>
                      {displayName.trim().charAt(0).toUpperCase() || t('qrFallbackName').charAt(0)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.personCopy}>
                <Text numberOfLines={1} style={styles.personName}>
                  {displayName}
                </Text>
                <Text style={styles.personMeta}>{t('qrIdentityHint')}</Text>
              </View>
            </View>

            {/* QR Code Container with 4 Corner Accents */}
            <View style={[styles.qrFrame, { width: qrBoxSize, height: qrBoxSize }]}>
              {/* 4 Corner L-shaped brackets */}
              <View style={[styles.cornerBracket, styles.cornerTL]} />
              <View style={[styles.cornerBracket, styles.cornerTR]} />
              <View style={[styles.cornerBracket, styles.cornerBL]} />
              <View style={[styles.cornerBracket, styles.cornerBR]} />

              {loading ? (
                <View style={styles.qrLoadingBox}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loadingText}>{t('qrCreating')}</Text>
                </View>
              ) : qr ? (
                <View style={styles.qrInner}>
                  <QRCode
                    backgroundColor="transparent"
                    color={isDark ? '#f8fafc' : '#0f172a'}
                    quietZone={4}
                    size={qrCodeSize}
                    value={qr.value}
                  />
                </View>
              ) : (
                <View style={styles.qrErrorBox}>
                  <Ionicons name="qr-code-outline" size={38} color={colors.textSecondary} />
                  <Text style={styles.errorTitle}>{t('qrUnavailableTitle')}</Text>
                  <Text style={styles.errorSubtext}>{error || t('qrCreateError')}</Text>
                </View>
              )}
            </View>

            {/* Retry fetch only on failure; never replace an existing code. */}
            {!loading && !qr && error ? <Pressable
              accessibilityLabel={tc('retry')}
              accessibilityRole="button"
              disabled={loading}
              onPress={() => void loadCode()}
              style={({ pressed }) => [
                styles.refreshBtn,
                pressed && styles.pressed,
                loading && styles.disabled,
              ]}
            >
              <Ionicons name="reload" size={17} color={colors.primary} />
              <Text style={styles.refreshText}>{tc('retry')}</Text>
            </Pressable> : null}
          </View>

          {/* Action Button: Quét mã của người thân */}
          <Pressable
            accessibilityLabel={t('scanSomeoneQr')}
            accessibilityRole="button"
            onPress={() => router.push('/care-circle/scan' as never)}
            style={({ pressed }) => [styles.scanBtnWrap, pressed && styles.pressed]}
          >
            <LinearGradient
              colors={['#14b8a6', '#08b8a2']}
              end={{ x: 1, y: 0.5 }}
              start={{ x: 0, y: 0.5 }}
              style={styles.scanBtnGradient}
            >
              {/* Viewfinder scanner icon */}
              <View style={styles.scanIconBox}>
                <Svg height={22} viewBox="0 0 24 24" width={22}>
                  <Path
                    d="M3 7V5a2 2 0 0 1 2-2h2"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                  />
                  <Path
                    d="M17 3h2a2 2 0 0 1 2 2v2"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                  />
                  <Path
                    d="M21 17v2a2 2 0 0 1-2 2h-2"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                  />
                  <Path
                    d="M7 21H5a2 2 0 0 1-2-2v-2"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                  />
                  <Path
                    d="M7 12h10"
                    stroke="#ffffff"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.4}
                  />
                </Svg>
              </View>
              <View style={styles.scanBtnDivider} />
              <Text style={styles.scanBtnText}>{t('scanSomeoneQr')}</Text>
            </LinearGradient>
          </Pressable>

          {/* Privacy & Security Note */}
          <View style={styles.privacyRow}>
            <Ionicons
              name="shield-checkmark-outline"
              size={19}
              color={colors.textSecondary}
              style={styles.privacyIcon}
            />
            <Text style={styles.privacyText}>{t('qrPrivacy')}</Text>
          </View>
        </ScrollView>

        {/* Decorative Bottom Wave */}
        <Image
          cachePolicy="memory-disk"
          contentFit="cover"
          pointerEvents="none"
          source={require('../../assets/images/care-circle/qr_bottom_wave.png')}
          style={styles.bottomWave}
        />
      </LinearGradient>
    </Screen>
  );
}

function createStyles(
  typography: ReturnType<typeof useScaledTypography>,
  colors: ReturnType<typeof useThemeColors>['colors'],
  isDark: boolean,
  insets: ReturnType<typeof useSafeAreaInsets>,
) {
  return StyleSheet.create({
    rootGradient: {
      flex: 1,
      position: 'relative',
    },
    header: {
      paddingBottom: 4,
      paddingHorizontal: 20,
      paddingTop: insets.top + 6,
    },
    backBtn: {
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#e2e8f0',
      borderRadius: 20,
      borderWidth: 1,
      height: 40,
      justifyContent: 'center',
      width: 40,
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        },
        android: {
          elevation: 2,
        },
        default: {},
      }),
    },
    scrollContent: {
      flexGrow: 1,
      paddingBottom: Math.max(insets.bottom, 24) + 60,
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    introRow: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
      marginTop: 4,
    },
    introLeftCol: {
      flex: 1,
      paddingRight: 8,
    },
    titleRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 10,
    },
    peopleIcon: {
      marginTop: 2,
    },
    titleTextCol: {
      flexDirection: 'column',
    },
    titleLine1: {
      color: colors.textPrimary,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.4,
      lineHeight: 28,
    },
    titleLine2: {
      color: colors.primary,
      fontSize: 24,
      fontWeight: '900',
      letterSpacing: -0.4,
      lineHeight: 28,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13.5,
      lineHeight: 19,
      marginTop: 8,
    },
    heartBubbleImg: {
      height: 110,
      width: 110,
    },
    card: {
      alignItems: 'center',
      backgroundColor: isDark ? '#1e293b' : '#ffffff',
      borderColor: isDark ? '#334155' : '#eaf4f2',
      borderRadius: 28,
      borderWidth: 1,
      paddingBottom: 20,
      paddingHorizontal: 20,
      paddingTop: 18,
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.08,
          shadowRadius: 20,
        },
        android: {
          elevation: 4,
        },
        default: {},
      }),
    },
    personRow: {
      alignItems: 'center',
      alignSelf: 'stretch',
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    avatarWrap: {
      borderRadius: 24,
      height: 48,
      overflow: 'hidden',
      width: 48,
    },
    avatarImg: {
      borderRadius: 24,
      height: 48,
      width: 48,
    },
    avatarFallback: {
      alignItems: 'center',
      backgroundColor: isDark ? '#06342e' : '#e6faf8',
      borderRadius: 24,
      height: 48,
      justifyContent: 'center',
      width: 48,
    },
    avatarText: {
      color: colors.primary,
      fontSize: 20,
      fontWeight: '800',
    },
    personCopy: {
      flex: 1,
    },
    personName: {
      color: colors.textPrimary,
      fontSize: 16.5,
      fontWeight: '800',
      letterSpacing: -0.2,
    },
    personMeta: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: '500',
      marginTop: 2,
    },
    qrFrame: {
      alignItems: 'center',
      backgroundColor: isDark ? '#0f172a' : '#ffffff',
      borderColor: isDark ? '#1e3a36' : '#e6f4f1',
      borderRadius: 22,
      borderWidth: 1.5,
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative',
    },
    cornerBracket: {
      borderColor: isDark ? '#14b8a6' : '#5eead4',
      height: 22,
      position: 'absolute',
      width: 22,
    },
    cornerTL: {
      borderLeftWidth: 2.5,
      borderTopLeftRadius: 12,
      borderTopWidth: 2.5,
      left: 6,
      top: 6,
    },
    cornerTR: {
      borderRightWidth: 2.5,
      borderTopRightRadius: 12,
      borderTopWidth: 2.5,
      right: 6,
      top: 6,
    },
    cornerBL: {
      borderBottomLeftRadius: 12,
      borderBottomWidth: 2.5,
      borderLeftWidth: 2.5,
      bottom: 6,
      left: 6,
    },
    cornerBR: {
      borderBottomRightRadius: 12,
      borderBottomWidth: 2.5,
      borderRightWidth: 2.5,
      bottom: 6,
      right: 6,
    },
    qrInner: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: 8,
    },
    qrLoadingBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
      lineHeight: 20,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    qrErrorBox: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    errorTitle: {
      color: colors.textPrimary,
      fontSize: typography.size.md,
      fontWeight: '800',
      marginTop: spacing.xs,
    },
    errorSubtext: {
      color: colors.textSecondary,
      fontSize: typography.size.xs,
      lineHeight: 18,
      marginTop: 4,
      textAlign: 'center',
    },
    refreshBtn: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      marginTop: 12,
      minHeight: 48,
      paddingVertical: 6,
    },
    refreshText: {
      color: colors.primary,
      fontSize: 14.5,
      fontWeight: '700',
    },
    scanBtnWrap: {
      borderRadius: 27,
      marginTop: 18,
      overflow: 'hidden',
      ...Platform.select({
        ios: {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.28,
          shadowRadius: 14,
        },
        android: {
          elevation: 6,
        },
        default: {},
      }),
    },
    scanBtnGradient: {
      alignItems: 'center',
      borderRadius: 27,
      flexDirection: 'row',
      height: 54,
      justifyContent: 'center',
      paddingHorizontal: 20,
    },
    scanIconBox: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanBtnDivider: {
      backgroundColor: 'rgba(255, 255, 255, 0.45)',
      height: 18,
      marginHorizontal: 12,
      width: 1,
    },
    scanBtnText: {
      color: '#ffffff',
      fontSize: 15.5,
      fontWeight: '700',
    },
    privacyRow: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      gap: 8,
      marginTop: 14,
      paddingHorizontal: 4,
    },
    privacyIcon: {
      marginTop: 2,
    },
    privacyText: {
      color: colors.textSecondary,
      flex: 1,
      fontSize: 12.5,
      lineHeight: 18,
    },
    bottomWave: {
      bottom: 0,
      height: 76,
      left: 0,
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
      width: '100%',
    },
    pressed: {
      opacity: 0.82,
    },
    disabled: {
      opacity: 0.55,
    },
  });
}
