import { useRootNavigationState } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, InteractionManager, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { ScaledText as Text } from '../src/components/ScaledText';
import { DataConsentModal, hasDataConsent } from '../src/components/DataConsentModal';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../src/features/auth/auth.store';
import { routeFromNotificationData } from '../src/lib/notifications';
import { getPendingVoipCall } from '../src/lib/voip';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';

const splashBgVi = require('../assets/images/splash/asinu_splash_bg_vi.png');
const splashBgEn = require('../assets/images/splash/asinu_splash_bg_en.png');

function LoadingDot({ delay }: { delay: number }) {
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
    <Animated.View
      style={[
        styles.dot,
        {
          opacity: anim,
          transform: [
            {
              scale: anim.interpolate({
                inputRange: [0.35, 1],
                outputRange: [0.85, 1.15],
              }),
            },
          ],
        },
      ]}
    />
  );
}

export default function Index() {
  const { i18n } = useTranslation('common');
  const isEn = i18n.language?.startsWith('en');
  const splashBg = isEn ? splashBgEn : splashBgVi;
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const hydrated = useAuthStore((state) => state.hydrated);
  const isNavReady = Boolean(navigationState?.key);

  const [consentReady, setConsentReady] = useState(false);
  const [showConsent, setShowConsent]   = useState(false);
  const [minSplashDone, setMinSplashDone] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const progressValue = useRef(new Animated.Value(0)).current;

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
      if (profile?.onboardingCompleted) {
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
        router.replace(profile.onboardingCompleted ? '/(tabs)/home' : '/onboarding');
      } else {
        router.replace('/login');
      }
    });
    return () => { cancelled = true; task.cancel(); };
  }, [minSplashDone, hydrated, isNavReady, loading, profile, router, consentReady, showConsent]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Image source={splashBg} style={StyleSheet.absoluteFill} resizeMode="cover" />

      {/* Synchronized 3-dot pulse overlay */}
      <View style={styles.dotsOverlay} pointerEvents="none">
        <LoadingDot delay={0} />
        <LoadingDot delay={200} />
        <LoadingDot delay={400} />
      </View>

      {/* Dynamic progress bar & percentage overlay matching mockup track */}
      <View style={styles.progressOverlay} pointerEvents="none">
        <View style={styles.pctRow}>
          <Text style={styles.progressPercent}>{progressPercent}%</Text>
        </View>
        <View style={styles.progressTrack} accessibilityLabel={`${progressPercent}%`}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressValue.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
            ]}
          />
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
    backgroundColor: '#ffffff',
  },
  dotsOverlay: {
    position: 'absolute',
    top: '64.7%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00a896',
  },
  progressOverlay: {
    position: 'absolute',
    top: '67.95%',
    alignSelf: 'center',
    width: '55.11%',
  },
  pctRow: {
    height: 24,
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 6,
  },
  progressPercent: {
    color: '#00796b',
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    width: '100%',
    height: 8,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: 'transparent',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: '#00a896',
  },
});
