import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackButton } from '../../../components/ScreenHeaderButton';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useGuardedRouter as useRouter } from '../../../hooks/useGuardedRouter';
import { useScaledTypography } from '../../../hooks/useScaledTypography';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { getApiErrorMessage } from '../../../lib/apiClient';
import { radius, spacing } from '../../../styles';
import { careCircleApi } from '../care-circle.api';

function tokenFromQr(value: string) {
  const trimmed = value.trim();
  try {
    const parsed = Linking.parse(trimmed);
    const token = parsed.queryParams?.token;
    if (typeof token === 'string' && token.length >= 32) {
      return token;
    }
  } catch {}
  return /^[A-Za-z0-9_-]{32,256}$/.test(trimmed) ? trimmed : null;
}

function CareCircleScanScreen() {
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const inboundToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const inboundHandled = useRef(false);
  const insets = useSafeAreaInsets();
  const typography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(typography, isDark), [typography, isDark]);
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');

  const openToken = useCallback(async (token: string) => {
    setScanning(true);
    setError('');
    try {
      await careCircleApi.previewQrToken(token);
      router.replace({ pathname: '/care-circle/invite', params: { qrToken: token } } as never);
    } catch (err) {
      setError(getApiErrorMessage(err, t, 'qrPreviewError'));
    }
  }, [router, t]);

  const scan = useCallback(async ({ data }: BarcodeScanningResult) => {
    if (scanning) {
      return;
    }
    const token = tokenFromQr(data);
    if (!token) {
      setError(t('qrInvalidFormat'));
      setScanning(true);
      return;
    }
    await openToken(token);
  }, [openToken, scanning, t]);

  useEffect(() => {
    if (!inboundToken || inboundHandled.current) {
      return;
    }
    inboundHandled.current = true;
    openToken(inboundToken).catch(() => {});
  }, [inboundToken, openToken]);

  const retry = () => {
    setError('');
    setScanning(false);
  };

  if (inboundToken) {
    return (
      <View style={styles.permissionScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={
            isDark
              ? ['#071a18', '#0c2824', '#071a18']
              : ['#f0fbf8', '#f8fdfb', '#eef9f5']
          }
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.permissionHeader, { paddingTop: insets.top + spacing.xs }]}>
          <ScreenBackButton onPress={() => router.back()} style={styles.headerIconButton} />
          <Text style={styles.permissionHeaderTitle}>{t('scanQrTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.permissionContentScroll}>
          <View style={styles.permissionCard}>
            {error ? (
              <>
                <View style={styles.errorIconBadge}>
                  <Ionicons name="alert-circle-outline" size={42} color="#EF4444" />
                </View>
                <Text style={styles.permissionTitle}>{t('qrCannotUse')}</Text>
                <Text style={styles.permissionBody}>{error}</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('scanAgain')}
                  onPress={() => router.replace('/care-circle/scan' as never)}
                  style={({ pressed }) => [styles.actionButtonWrap, pressed && styles.pressed]}
                >
                  <LinearGradient
                    colors={['#087F73', '#059669']}
                    end={{ x: 1, y: 0 }}
                    start={{ x: 0, y: 0 }}
                    style={styles.permissionButton}
                  >
                    <Ionicons name="scan" size={20} color="#F7FFFD" />
                    <Text style={styles.permissionButtonText}>{t('scanAgain')}</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                <ActivityIndicator size="large" color="#087F73" />
                <Text style={[styles.permissionTitle, { marginTop: spacing.md }]}>{t('qrChecking')}</Text>
              </>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.permissionLoadingScreen}>
        <LinearGradient
          colors={
            isDark
              ? ['#071a18', '#0c2824', '#071a18']
              : ['#f0fbf8', '#f8fdfb', '#eef9f5']
          }
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#087F73" />
      </View>
    );
  }

  if (!permission.granted) {
    const canAskAgain = permission.canAskAgain;

    return (
      <View style={styles.permissionScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <LinearGradient
          colors={
            isDark
              ? ['#071a18', '#0c2824', '#071a18']
              : ['#f0fbf8', '#f8fdfb', '#eef9f5']
          }
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.permissionHeader, { paddingTop: insets.top + spacing.xs }]}>
          <ScreenBackButton onPress={() => router.back()} style={styles.headerIconButton} />
          <Text style={styles.permissionHeaderTitle}>{t('scanQrTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.permissionContentScroll}>
          <View style={styles.permissionCard}>
            <View style={styles.heroBadgeContainer}>
              <View style={styles.heroBadgeOuter}>
                <LinearGradient
                  colors={isDark ? ['#0d9488', '#059669'] : ['#087F73', '#10B981']}
                  end={{ x: 1, y: 1 }}
                  start={{ x: 0, y: 0 }}
                  style={styles.heroBadgeGradient}
                >
                  <Ionicons name="camera" size={38} color="#FFFFFF" />
                </LinearGradient>
              </View>
              <View style={styles.floatingShieldBadge}>
                <MaterialCommunityIcons name="shield-check" size={17} color="#FFFFFF" />
              </View>
            </View>

            <Text style={styles.permissionTitle}>{t('cameraPermissionTitle')}</Text>
            <Text style={styles.permissionBody}>
              {canAskAgain
                ? t('cameraPermissionDescription')
                : t('cameraPermissionNeedSettings')}
            </Text>

            <View style={styles.featureContainer}>
              <View style={styles.featureRow}>
                <View style={styles.featureIconBadge}>
                  <Ionicons name="qr-code-outline" size={20} color="#087F73" />
                </View>
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureTitle}>{t('cameraPermissionFeature1')}</Text>
                  <Text style={styles.featureDesc}>{t('cameraPermissionFeatureDesc1')}</Text>
                </View>
              </View>

              <View style={styles.featureDivider} />

              <View style={styles.featureRow}>
                <View style={[styles.featureIconBadge, styles.featureIconBadgeShield]}>
                  <MaterialCommunityIcons name="shield-check-outline" size={21} color="#059669" />
                </View>
                <View style={styles.featureTextWrap}>
                  <Text style={styles.featureTitle}>{t('cameraPermissionFeature2')}</Text>
                  <Text style={styles.featureDesc}>{t('cameraPermissionFeatureDesc2')}</Text>
                </View>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={canAskAgain ? t('allowCamera') : t('openSettings')}
              onPress={() => {
                if (canAskAgain) {
                  requestPermission().catch(() => {});
                } else {
                  Linking.openSettings().catch(() => {});
                }
              }}
              style={({ pressed }) => [styles.actionButtonWrap, pressed && styles.pressed]}
            >
              <LinearGradient
                colors={['#087F73', '#059669']}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={styles.permissionButton}
              >
                <Ionicons
                  name={canAskAgain ? 'camera' : 'settings-outline'}
                  size={20}
                  color="#F7FFFD"
                />
                <Text style={styles.permissionButtonText}>
                  {canAskAgain ? t('allowCamera') : t('openSettings')}
                </Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cameraPermissionLater')}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}
            >
              <Text style={styles.laterButtonText}>{t('cameraPermissionLater')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />
      <CameraView
        active
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        enableTorch={torch}
        facing="back"
        onBarcodeScanned={scanning ? undefined : scan}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />

      <View style={[styles.cameraHeader, { paddingTop: insets.top + spacing.xs }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tc('back')}
          hitSlop={8}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.cameraBackButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={22} color="#F7FFFD" />
        </Pressable>
        <Text style={styles.cameraTitle}>{t('scanQrTitle')}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torch ? t('turnOffFlash') : t('turnOnFlash')}
          onPress={() => setTorch((value) => !value)}
          style={({ pressed }) => [styles.torchButton, pressed && styles.pressed]}
        >
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color={torch ? '#53E4D1' : '#F7FFFD'} />
        </Pressable>
      </View>

      <View pointerEvents="none" style={styles.scanArea}>
        <View style={styles.viewfinder}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
          {scanning && !error ? (
            <View style={styles.scanningOverlay}>
              <ActivityIndicator size="large" color="#53E4D1" />
              <Text style={styles.scanningText}>{t('qrChecking')}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.instructionPanel, { paddingBottom: insets.bottom + spacing.lg }]}>
        {error ? (
          <>
            <Ionicons name="alert-circle-outline" size={30} color="#FECACA" />
            <Text style={styles.errorTitle}>{t('qrCannotUse')}</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('scanAgain')}
              onPress={retry}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Ionicons name="scan" size={20} color="#073B36" />
              <Text style={styles.retryText}>{t('scanAgain')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.instructionTitle}>{t('placeQrInFrame')}</Text>
            <Text style={styles.instructionBody}>{t('scanQrDescription')}</Text>
          </>
        )}
      </View>
    </View>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>, isDark: boolean) {
  return StyleSheet.create({
    screen: { backgroundColor: '#071A18', flex: 1 },
    permissionScreen: {
      backgroundColor: isDark ? '#071a18' : '#F4FBF9',
      flex: 1,
    },
    permissionLoadingScreen: {
      alignItems: 'center',
      backgroundColor: isDark ? '#071a18' : '#F4FBF9',
      flex: 1,
      justifyContent: 'center',
    },
    permissionHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      minHeight: 62,
      paddingHorizontal: spacing.lg,
    },
    permissionHeaderTitle: {
      color: isDark ? '#f8fafc' : '#102A27',
      flex: 1,
      fontSize: typography.size.lg,
      fontWeight: '800',
      textAlign: 'center',
    },
    headerSpacer: { width: 44 },
    headerIconButton: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.85)',
      borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : '#e2e8f0',
      borderWidth: 1,
    },
    permissionContentScroll: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    permissionCard: {
      alignItems: 'center',
      backgroundColor: isDark ? '#0d2522' : '#ffffff',
      borderColor: isDark ? 'rgba(44, 199, 181, 0.2)' : '#e6f4f1',
      borderRadius: 24,
      borderWidth: 1,
      maxWidth: 420,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      shadowColor: '#087F73',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 20,
      elevation: 4,
      width: '100%',
    },
    heroBadgeContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
      position: 'relative',
    },
    heroBadgeOuter: {
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(8, 127, 115, 0.2)' : '#E6F8F5',
      borderColor: isDark ? 'rgba(44, 199, 181, 0.3)' : '#bbf2e7',
      borderRadius: 50,
      borderWidth: 1.5,
      height: 100,
      justifyContent: 'center',
      width: 100,
    },
    heroBadgeGradient: {
      alignItems: 'center',
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      shadowColor: '#087F73',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 10,
      width: 72,
    },
    floatingShieldBadge: {
      alignItems: 'center',
      backgroundColor: '#10B981',
      borderColor: isDark ? '#0d2522' : '#ffffff',
      borderRadius: 15,
      borderWidth: 2.5,
      bottom: -2,
      height: 30,
      justifyContent: 'center',
      position: 'absolute',
      right: -2,
      width: 30,
    },
    permissionTitle: {
      color: isDark ? '#f8fafc' : '#102A27',
      fontSize: typography.size.xl,
      fontWeight: '900',
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    permissionBody: {
      color: isDark ? '#94a3b8' : '#5D716E',
      fontSize: typography.size.sm,
      lineHeight: 20,
      marginTop: spacing.xs,
      maxWidth: 320,
      textAlign: 'center',
    },
    featureContainer: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F7FDFB',
      borderColor: isDark ? 'rgba(44, 199, 181, 0.15)' : '#E6F6F2',
      borderRadius: radius.lg,
      borderWidth: 1,
      marginTop: spacing.lg,
      padding: spacing.md,
      width: '100%',
    },
    featureRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    featureIconBadge: {
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(8, 127, 115, 0.25)' : '#E6F8F5',
      borderRadius: 20,
      height: 40,
      justifyContent: 'center',
      width: 40,
    },
    featureIconBadgeShield: {
      backgroundColor: isDark ? 'rgba(5, 150, 105, 0.25)' : '#ECFDF5',
    },
    featureTextWrap: {
      flex: 1,
    },
    featureTitle: {
      color: isDark ? '#e2e8f0' : '#134e4a',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    featureDesc: {
      color: isDark ? '#94a3b8' : '#64748b',
      fontSize: typography.size.xs,
      lineHeight: 16,
      marginTop: 2,
    },
    featureDivider: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#E6F4F0',
      height: 1,
      marginVertical: spacing.sm,
    },
    actionButtonWrap: {
      borderRadius: radius.xl,
      marginTop: spacing.xl,
      overflow: 'hidden',
      width: '100%',
    },
    permissionButton: {
      alignItems: 'center',
      borderRadius: radius.xl,
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: spacing.xl,
      width: '100%',
    },
    permissionButtonText: {
      color: '#F7FFFD',
      fontSize: typography.size.md,
      fontWeight: '800',
    },
    laterButton: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
      minHeight: 38,
      paddingHorizontal: spacing.md,
    },
    laterButtonText: {
      color: isDark ? '#94a3b8' : '#087F73',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    errorIconBadge: {
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      marginBottom: spacing.md,
      width: 72,
    },
    scrimTop: { backgroundColor: 'rgba(4, 20, 18, 0.58)', height: '24%', left: 0, position: 'absolute', right: 0, top: 0 },
    scrimBottom: { backgroundColor: 'rgba(4, 20, 18, 0.72)', bottom: 0, height: '32%', left: 0, position: 'absolute', right: 0 },
    cameraHeader: { alignItems: 'center', flexDirection: 'row', left: 0, paddingHorizontal: spacing.lg, position: 'absolute', right: 0, top: 0 },
    cameraBackButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
    cameraTitle: { color: '#F7FFFD', flex: 1, fontSize: typography.size.lg, fontWeight: '800', textAlign: 'center' },
    torchButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 44 },
    scanArea: { alignItems: 'center', bottom: '28%', justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: '20%' },
    viewfinder: { height: 264, position: 'relative', width: 264 },
    corner: { borderColor: '#53E4D1', height: 46, position: 'absolute', width: 46 },
    cornerTopLeft: { borderLeftWidth: 5, borderTopLeftRadius: 18, borderTopWidth: 5, left: 0, top: 0 },
    cornerTopRight: { borderRightWidth: 5, borderTopRightRadius: 18, borderTopWidth: 5, right: 0, top: 0 },
    cornerBottomLeft: { borderBottomLeftRadius: 18, borderBottomWidth: 5, borderLeftWidth: 5, bottom: 0, left: 0 },
    cornerBottomRight: { borderBottomRightRadius: 18, borderBottomWidth: 5, borderRightWidth: 5, bottom: 0, right: 0 },
    scanningOverlay: { alignItems: 'center', backgroundColor: 'rgba(7, 26, 24, 0.82)', borderRadius: 22, bottom: 12, justifyContent: 'center', left: 12, position: 'absolute', right: 12, top: 12 },
    scanningText: { color: '#F7FFFD', fontSize: typography.size.sm, fontWeight: '700', marginTop: spacing.sm },
    instructionPanel: { alignItems: 'center', bottom: 0, left: 0, paddingHorizontal: spacing.xl, position: 'absolute', right: 0 },
    instructionTitle: { color: '#F7FFFD', fontSize: typography.size.lg, fontWeight: '900', textAlign: 'center' },
    instructionBody: { color: '#C9DBD8', fontSize: typography.size.sm, lineHeight: 21, marginTop: spacing.xs, maxWidth: 330, textAlign: 'center' },
    errorTitle: { color: '#F7FFFD', fontSize: typography.size.md, fontWeight: '900', marginTop: spacing.sm },
    errorBody: { color: '#FECACA', fontSize: typography.size.sm, lineHeight: 20, marginTop: 4, textAlign: 'center' },
    retryButton: { alignItems: 'center', backgroundColor: '#B9F4EA', borderRadius: radius.full, flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: spacing.md, minHeight: 46, paddingHorizontal: spacing.lg },
    retryText: { color: '#073B36', fontSize: typography.size.sm, fontWeight: '800' },
    pressed: { opacity: 0.82 },
  });
}

// Keep the route export explicit so Expo Router's require context always
// receives a module object with a stable `default` field.
export default CareCircleScanScreen;
