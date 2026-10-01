import { Ionicons } from '@expo/vector-icons';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Linking from 'expo-linking';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { careCircleApi } from '../../src/features/care-circle';
import { useGuardedRouter as useRouter } from '../../src/hooks/useGuardedRouter';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { radius, spacing } from '../../src/styles';

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

export default function CareCircleScanScreen() {
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const inboundToken = Array.isArray(params.token) ? params.token[0] : params.token;
  const inboundHandled = useRef(false);
  const insets = useSafeAreaInsets();
  const typography = useScaledTypography();
  const styles = useMemo(() => createStyles(typography), [typography]);
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
        <View style={[styles.permissionHeader, { paddingTop: insets.top + spacing.xs }]}>
          <ScreenBackButton onPress={() => router.back()} />
          <Text style={styles.permissionHeaderTitle}>{t('scanQrTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.permissionContent}>
          {error ? (
            <>
              <View style={styles.permissionIcon}>
                <Ionicons name="alert-circle-outline" size={38} color="#B42318" />
              </View>
              <Text style={styles.permissionTitle}>{t('qrCannotUse')}</Text>
              <Text style={styles.permissionBody}>{error}</Text>
              <Pressable
                onPress={() => router.replace('/care-circle/scan' as never)}
                style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}
              >
                <Ionicons name="scan" size={21} color="#F7FFFD" />
                <Text style={styles.permissionButtonText}>{t('scanAgain')}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <ActivityIndicator size="large" color="#087F73" />
              <Text style={styles.permissionTitle}>{t('qrChecking')}</Text>
            </>
          )}
        </View>
      </View>
    );
  }

  if (!permission) {
    return <View style={styles.permissionScreen}><ActivityIndicator size="large" color="#2CC7B5" /></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionScreen}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.permissionHeader, { paddingTop: insets.top + spacing.xs }]}>
          <ScreenBackButton onPress={() => router.back()} />
          <Text style={styles.permissionHeaderTitle}>{t('scanQrTitle')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.permissionContent}>
          <View style={styles.permissionIcon}>
            <Ionicons name="camera-outline" size={38} color="#087F73" />
          </View>
          <Text style={styles.permissionTitle}>{t('cameraPermissionTitle')}</Text>
          <Text style={styles.permissionBody}>{t('cameraPermissionDescription')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('allowCamera')}
            onPress={() => requestPermission().catch(() => {})}
            style={({ pressed }) => [styles.permissionButton, pressed && styles.pressed]}
          >
            <Ionicons name="camera" size={21} color="#F7FFFD" />
            <Text style={styles.permissionButtonText}>{t('allowCamera')}</Text>
          </Pressable>
          {!permission.canAskAgain ? (
            <Pressable onPress={() => Linking.openSettings().catch(() => {})} style={styles.settingsButton}>
              <Text style={styles.settingsText}>{t('openSettings')}</Text>
            </Pressable>
          ) : null}
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
          style={({ pressed }) => [styles.torchButton, torch && styles.torchActive, pressed && styles.pressed]}
        >
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color="#F7FFFD" />
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
            <View style={styles.errorIcon}>
              <Ionicons name="alert-circle-outline" size={24} color="#FECACA" />
            </View>
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

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    screen: { backgroundColor: '#071A18', flex: 1 },
    permissionScreen: { backgroundColor: '#F4FBF9', flex: 1 },
    permissionHeader: { alignItems: 'center', flexDirection: 'row', minHeight: 62, paddingHorizontal: spacing.lg },
    permissionHeaderTitle: { color: '#102A27', flex: 1, fontSize: typography.size.lg, fontWeight: '800', textAlign: 'center' },
    headerSpacer: { width: 44 },
    permissionContent: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: spacing.xl },
    permissionIcon: { alignItems: 'center', backgroundColor: '#DDF6F1', borderRadius: 28, height: 76, justifyContent: 'center', width: 76 },
    permissionTitle: { color: '#102A27', fontSize: typography.size.xl, fontWeight: '900', marginTop: spacing.lg, textAlign: 'center' },
    permissionBody: { color: '#5D716E', fontSize: typography.size.sm, lineHeight: 21, marginTop: spacing.sm, maxWidth: 330, textAlign: 'center' },
    permissionButton: { alignItems: 'center', backgroundColor: '#087F73', borderRadius: radius.lg, flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', marginTop: spacing.xl, minHeight: 52, paddingHorizontal: spacing.xl },
    permissionButtonText: { color: '#F7FFFD', fontSize: typography.size.md, fontWeight: '800' },
    settingsButton: { marginTop: spacing.md, minHeight: 44, padding: spacing.sm },
    settingsText: { color: '#087F73', fontSize: typography.size.sm, fontWeight: '700' },
    scrimTop: { backgroundColor: 'rgba(4, 20, 18, 0.58)', height: '24%', left: 0, position: 'absolute', right: 0, top: 0 },
    scrimBottom: { backgroundColor: 'rgba(4, 20, 18, 0.72)', bottom: 0, height: '32%', left: 0, position: 'absolute', right: 0 },
    cameraHeader: { alignItems: 'center', flexDirection: 'row', left: 0, paddingHorizontal: spacing.lg, position: 'absolute', right: 0, top: 0 },
    cameraBackButton: { alignItems: 'center', backgroundColor: 'rgba(7, 26, 24, 0.62)', borderColor: 'rgba(247,255,253,0.32)', borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
    cameraTitle: { color: '#F7FFFD', flex: 1, fontSize: typography.size.lg, fontWeight: '800', textAlign: 'center' },
    torchButton: { alignItems: 'center', backgroundColor: 'rgba(7, 26, 24, 0.62)', borderColor: 'rgba(247,255,253,0.32)', borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
    torchActive: { backgroundColor: '#087F73' },
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
    errorIcon: { alignItems: 'center', backgroundColor: 'rgba(185,28,28,0.42)', borderRadius: 20, height: 42, justifyContent: 'center', width: 42 },
    errorTitle: { color: '#F7FFFD', fontSize: typography.size.md, fontWeight: '900', marginTop: spacing.sm },
    errorBody: { color: '#FECACA', fontSize: typography.size.sm, lineHeight: 20, marginTop: 4, textAlign: 'center' },
    retryButton: { alignItems: 'center', backgroundColor: '#B9F4EA', borderRadius: radius.full, flexDirection: 'row', gap: 7, justifyContent: 'center', marginTop: spacing.md, minHeight: 46, paddingHorizontal: spacing.lg },
    retryText: { color: '#073B36', fontSize: typography.size.sm, fontWeight: '800' },
    pressed: { opacity: 0.82 },
  });
}
