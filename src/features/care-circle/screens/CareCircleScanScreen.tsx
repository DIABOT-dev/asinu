import { Ionicons } from '@expo/vector-icons';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
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

        {/* Decorative background elements */}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Image
            source={require('../../../../assets/images/care-circle/header_cross_leaves_left.png')}
            style={styles.bgDecoTopLeft}
            resizeMode="contain"
          />
          <Image
            source={require('../../../../assets/images/care-circle/scan_header_heart_ecg.png')}
            style={styles.bgDecoTopRight}
            resizeMode="contain"
          />
          <Image
            source={require('../../../../assets/images/care-circle/scan_bottom_leaves.png')}
            style={styles.bgDecoBottom}
            resizeMode="cover"
          />
        </View>

        {/* Header Bar */}
        <View style={[styles.permissionHeader, { paddingTop: insets.top + spacing.xs }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={tc('back')}
            hitSlop={12}
            onPress={() => router.back()}
            style={({ pressed }) => [styles.headerNavButton, pressed && styles.pressed]}
          >
            <Ionicons name="arrow-back" size={24} color={isDark ? '#5EEAD4' : '#0D766E'} />
          </Pressable>
          <Text style={styles.permissionHeaderTitle}>{t('scanQrTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Scrollable Content */}
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.permissionScrollContent}
          showsVerticalScrollIndicator={false}
          style={styles.permissionScroll}
        >
          {/* Main White Card */}
          <View style={styles.permissionCard}>
            {/* Hero Art */}
            <Image
              source={require('../../../../assets/images/care-circle/camera_permission_hero_art.png')}
              style={styles.cameraHeroArt}
              resizeMode="contain"
            />

            {/* Title & Body */}
            <Text style={styles.permissionTitle}>{t('cameraPermissionTitle')}</Text>
            <Text style={styles.permissionBody}>
              {canAskAgain
                ? t('cameraPermissionDescription')
                : t('cameraPermissionNeedSettings')}
            </Text>

            {/* Feature 1 */}
            <View style={styles.featureCard}>
              <Ionicons
                name="qr-code-outline"
                size={26}
                color={isDark ? '#2DD4BF' : '#0D9488'}
              />
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{t('cameraPermissionFeature1')}</Text>
                <Text style={styles.featureDesc}>{t('cameraPermissionFeatureDesc1')}</Text>
              </View>
            </View>

            {/* Feature 2 */}
            <View style={styles.featureCard}>
              <Ionicons
                name="shield-checkmark-outline"
                size={26}
                color={isDark ? '#2DD4BF' : '#0D9488'}
              />
              <View style={styles.featureTextWrap}>
                <Text style={styles.featureTitle}>{t('cameraPermissionFeature2')}</Text>
                <Text style={styles.featureDesc}>{t('cameraPermissionFeatureDesc2')}</Text>
              </View>
            </View>

            {/* Primary Action Button */}
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
                colors={['#0D9488', '#0F766E']}
                end={{ x: 1, y: 0 }}
                start={{ x: 0, y: 0 }}
                style={styles.permissionButton}
              >
                <Ionicons
                  name={canAskAgain ? 'camera' : 'settings-outline'}
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.permissionButtonText}>
                  {canAskAgain ? t('allowCamera') : t('openSettings')}
                </Text>
              </LinearGradient>
            </Pressable>

            {/* Secondary Action Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('cameraPermissionLater')}
              onPress={() => router.back()}
              style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}
            >
              <Text style={styles.laterButtonText}>{t('cameraPermissionLater')}</Text>
            </Pressable>
          </View>
        </ScrollView>
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
      justifyContent: 'space-between',
      minHeight: 56,
      paddingHorizontal: spacing.lg,
      zIndex: 2,
    },
    permissionHeaderTitle: {
      color: isDark ? '#f8fafc' : '#0F172A',
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
    headerNavButton: {
      alignItems: 'center',
      height: 44,
      justifyContent: 'center',
      width: 44,
    },
    bgDecoTopLeft: {
      height: 176,
      left: 0,
      opacity: isDark ? 0.4 : 0.85,
      position: 'absolute',
      top: 0,
      width: 130,
    },
    bgDecoTopRight: {
      height: 100,
      opacity: isDark ? 0.45 : 0.95,
      position: 'absolute',
      right: 0,
      top: 36,
      width: 135,
    },
    bgDecoBottom: {
      bottom: 0,
      height: 80,
      left: 0,
      opacity: isDark ? 0.5 : 0.9,
      position: 'absolute',
      right: 0,
      width: '100%',
    },
    permissionScroll: {
      flex: 1,
    },
    permissionScrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    permissionContentScroll: {
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
    },
    permissionCard: {
      alignSelf: 'center',
      backgroundColor: isDark ? '#0d2522' : '#ffffff',
      borderColor: isDark ? 'rgba(44, 199, 181, 0.2)' : '#E2E8F0',
      borderRadius: 28,
      borderWidth: 1,
      maxWidth: 420,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      shadowColor: '#087F73',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 18,
      elevation: 4,
      width: '100%',
    },
    cameraHeroArt: {
      alignSelf: 'center',
      height: 114,
      marginBottom: spacing.md,
      width: 220,
    },
    permissionTitle: {
      color: isDark ? '#f8fafc' : '#0F172A',
      fontSize: typography.size.xl,
      fontWeight: '800',
      marginTop: spacing.xs,
      textAlign: 'center',
    },
    permissionBody: {
      alignSelf: 'center',
      color: isDark ? '#94a3b8' : '#64748B',
      fontSize: typography.size.sm,
      lineHeight: 20,
      marginBottom: spacing.lg,
      marginTop: spacing.xs,
      maxWidth: 320,
      textAlign: 'center',
    },
    featureCard: {
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
      borderColor: isDark ? 'rgba(44, 199, 181, 0.2)' : '#E2E8F0',
      borderRadius: 16,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 14,
      marginBottom: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      width: '100%',
    },
    featureTextWrap: {
      flex: 1,
    },
    featureTitle: {
      color: isDark ? '#f8fafc' : '#0F172A',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    featureDesc: {
      color: isDark ? '#94a3b8' : '#64748B',
      fontSize: typography.size.xs,
      lineHeight: 18,
      marginTop: 2,
    },
    actionButtonWrap: {
      borderRadius: radius.full,
      marginTop: spacing.sm,
      overflow: 'hidden',
      width: '100%',
    },
    permissionButton: {
      alignItems: 'center',
      borderRadius: radius.full,
      flexDirection: 'row',
      gap: spacing.sm,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: spacing.xl,
      width: '100%',
    },
    permissionButtonText: {
      color: '#FFFFFF',
      fontSize: typography.size.md,
      fontWeight: '700',
    },
    laterButton: {
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.sm,
      minHeight: 40,
      paddingHorizontal: spacing.md,
    },
    laterButtonText: {
      color: isDark ? '#5EEAD4' : '#0D9488',
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
