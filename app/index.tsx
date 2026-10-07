import { useRootNavigationState } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Image, InteractionManager, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { LinearGradient } from 'expo-linear-gradient';
import { ScaledText as Text } from '../src/components/ScaledText';
import { DataConsentModal, hasDataConsent } from '../src/components/DataConsentModal';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../src/features/auth/auth.store';
import { routeFromNotificationData } from '../src/lib/notifications';
import { getPendingVoipCall } from '../src/lib/voip';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';

const splashBgVi = require('../assets/images/splash/asinu_splash_bg_vi.png');
const splashBgEn = require('../assets/images/splash/asinu_splash_bg_en.png');
const ARTWORK_WIDTH = 1280;
const ARTWORK_HEIGHT = 2776;

function LoadingDot({ delay, size = 8 }: { delay: number; size?: number }) {
  const anim = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.35, duration: 400, useNativeDriver: true }),
        Animated.delay(Math.max(0, 600 - delay)),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [anim, delay]);

  return (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2 }]}>
      <Animated.View style={[styles.dotFill, { opacity: anim }]} />
    </View>
  );
}

export default function Index() {
  const { i18n, t } = useTranslation('common');
  const isEn = i18n.language?.startsWith('en');
  const splashBg = isEn ? splashBgEn : splashBgVi;
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const profile = useAuthStore((state) => state.profile);
  const authToken = useAuthStore((state) => state.token);
  const loading = useAuthStore((state) => state.loading);
  const hydrated = useAuthStore((state) => state.hydrated);
  const isNavReady = Boolean(navigationState?.key);

  const [consentReady, setConsentReady] = useState(false);
  const [showConsent, setShowConsent]   = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const win = typeof Dimensions?.get === 'function' ? Dimensions.get('window') : { width: 393, height: 852 };
  const [viewport, setViewport] = useState({ width: win?.width || 393, height: win?.height || 852 });
  const progressValue = useRef(new Animated.Value(0)).current;
  // Match Image's centered cover crop so overlays stay on the artwork's
  // loading indicators on shorter phones, tablets and edge-to-edge screens.
  const artworkScale = Math.max(viewport.width / ARTWORK_WIDTH, viewport.height / ARTWORK_HEIGHT);
  const artworkWidth = ARTWORK_WIDTH * artworkScale;
  const artworkHeight = ARTWORK_HEIGHT * artworkScale;
  const artworkFrame = {
    width: artworkWidth,
    height: artworkHeight,
    left: (viewport.width - artworkWidth) / 2,
    top: (viewport.height - artworkHeight) / 2,
  };

  // Minimum splash display time so user sees the progress animation smoothly
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashDone(true);
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  // Smooth loading progression from 0% to 100%
  useEffect(() => {
    const listenerId = progressValue.addListener(({ value }) => {
      setProgressPercent(Math.round(value * 100));
    });

    Animated.timing(progressValue, {
      toValue: 1,
      duration: 1600,
      easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      useNativeDriver: false,
    }).start();

    return () => {
      progressValue.removeListener(listenerId);
    };
  }, [progressValue]);

  useEffect(() => {
    hasDataConsent().then((consented) => {
      if (!consented) setShowConsent(true);
      setConsentReady(true);
    });
  }, []);

  useEffect(() => {
    if (!minSplashDone || !hydrated || !isNavReady || loading || !consentReady || showConsent) return;
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(async () => {
      // Cold-start deep link: nếu user mở app bằng cách tap notification,
      // ưu tiên route đó thay vì replace về home (nếu không sẽ ghi đè).
      // A failed profile request does not invalidate the restored session.
      // Native call recovery only needs the token; the call API checks access.
      if (authToken) {
        try {
          // An answered CallKit call takes priority over a previous push tap.
          // The native handoff remains pending until this screen owns audio.
          const call = await getPendingVoipCall();
          if (cancelled) return;
          if (call) {
            router.replace({ pathname: '/checkin-call/[episodeId]', params: {
              episodeId: call.episodeId, attemptId: call.attemptId, nativeAnswered: '1',
            } } as any);
            return;
          }
          const response = await Notifications.getLastNotificationResponseAsync();
          if (cancelled) return;
          if (response) {
            const ageSec = Date.now() / 1000 - response.notification.date;
            const data = response.notification.request.content.data as Record<string, unknown>;
            if (ageSec < (data?.checkinCall === true ? 30 * 60 : 60)) {
              const route = routeFromNotificationData(data);
              if (route) {
                if (typeof route === 'string') router.replace(route as any);
                else router.replace(route as any);
                return;
              }
            }
          }
        } catch {}
      }

      if (cancelled) return;
      if (profile) {
        router.replace(profile.onboardingCompleted === true ? '/(tabs)/home' : '/onboarding');
      } else {
        router.replace('/login');
      }
    });
    return () => { cancelled = true; task.cancel(); };
  }, [minSplashDone, hydrated, isNavReady, loading, profile, authToken, router, consentReady, showConsent]);

  return (
    <View
      style={styles.container}
      onLayout={({ nativeEvent: { layout } }) => setViewport(current =>
        current.width === layout.width && current.height === layout.height
          ? current : { width: layout.width, height: layout.height })}
    >
      <StatusBar style="dark" />
      <Image
        source={splashBg}
        style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]}
        resizeMode="cover"
      />

      <View style={[styles.artworkOverlay, artworkFrame]} pointerEvents="none">
        <View style={[styles.dotsOverlay, {
          top: 1810 * artworkScale,
          marginLeft: -54 * artworkScale,
          gap: 22 * artworkScale,
        }]}>
          <LoadingDot delay={0} size={22 * artworkScale} />
          <LoadingDot delay={200} size={22 * artworkScale} />
          <LoadingDot delay={400} size={22 * artworkScale} />
        </View>

        <View style={[styles.statusRow, {
          top: 1898 * artworkScale,
          left: 287 * artworkScale,
          width: 706 * artworkScale,
        }]}>
          <Text style={[styles.loadingText, { fontSize: Math.max(13, 38 * artworkScale) }]}>
            {t('loading', { defaultValue: isEn ? 'Loading...' : 'Đang tải...' })}
          </Text>
          <Text style={[styles.progressPercent, { fontSize: Math.max(14, 40 * artworkScale) }]}>
            {progressPercent}%
          </Text>
        </View>
        <View
          style={[styles.progressTrack, {
            top: 1966 * artworkScale,
            left: 287 * artworkScale,
            width: 706 * artworkScale,
            height: 22 * artworkScale,
          }]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t('loading')}
          accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
        >
          <Animated.View style={[
            styles.progressFill,
            { width: progressValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
          ]}>
            <LinearGradient colors={['#00a98c', '#06c7b1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
          </Animated.View>
        </View>
      </View>

      <DataConsentModal
        visible={showConsent}
        onAgree={() => setShowConsent(false)}
        onDecline={() => setShowConsent(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#f1fbfc',
  },
  artworkOverlay: {
    position: 'absolute',
  },
  dotsOverlay: {
    position: 'absolute',
    left: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    overflow: 'hidden',
    backgroundColor: '#bce9e5',
  },
  dotFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#00b5a4',
  },
  statusRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 24,
  },
  loadingText: {
    color: '#1d5349',
    fontSize: 14,
    fontWeight: '600',
  },
  progressPercent: {
    color: '#007e71',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    position: 'absolute',
    overflow: 'hidden',
    borderRadius: 999,
    backgroundColor: '#daf0ee',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
});
