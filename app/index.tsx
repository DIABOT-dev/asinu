import { LinearGradient } from 'expo-linear-gradient';
import { useRootNavigationState } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, InteractionManager, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { ScaledText as Text } from '../src/components/ScaledText';
import { DataConsentModal, hasDataConsent } from '../src/components/DataConsentModal';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../src/features/auth/auth.store';
import { routeFromNotificationData } from '../src/lib/notifications';
import { spacing } from '../src/styles';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';

function LoadingDot({ delay }: { delay: number }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 500, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[styles.dot, { opacity: anim }]} />;
}

export default function Index() {
  const { t } = useTranslation('common');
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isNavReady = Boolean(navigationState?.key);
  const insets = useSafeAreaInsets();

  const logoScale   = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoFloat   = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;

  const [consentReady, setConsentReady] = useState(false);
  const [showConsent, setShowConsent]   = useState(false);

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(logoScale, { toValue: 1, useNativeDriver: true, tension: 55, friction: 7 }),
      Animated.timing(logoOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() =>
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start()
    );

    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(logoFloat, { toValue: -7, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(logoFloat, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    floatLoop.start();
    return () => floatLoop.stop();
  }, []);

  useEffect(() => {
    bootstrap();
    hasDataConsent().then((consented) => {
      if (!consented) setShowConsent(true);
      setConsentReady(true);
    });
  }, [bootstrap]);

  useEffect(() => {
    if (!isNavReady || loading || !consentReady || showConsent) return;
    const task = InteractionManager.runAfterInteractions(async () => {
      // Cold-start deep link: nếu user mở app bằng cách tap notification,
      // ưu tiên route đó thay vì replace về home (nếu không sẽ ghi đè).
      if (profile?.onboardingCompleted) {
        try {
          const response = await Notifications.getLastNotificationResponseAsync();
          if (response) {
            const ageSec = Date.now() / 1000 - response.notification.date;
            if (ageSec < 60) {
              const data = response.notification.request.content.data as Record<string, unknown>;
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

      if (profile) {
        router.replace(profile.onboardingCompleted ? '/(tabs)/home' : '/onboarding');
      } else {
        router.replace('/login');
      }
    });
    return () => task.cancel();
  }, [isNavReady, loading, profile, router, consentReady, showConsent]);

  return (
    <LinearGradient
      colors={['#dff7f3', '#effbf9', '#fbfbfb']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}
    >
      {/* Light splash surface with the same Asinu mascot used in the app. */}
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }, { translateY: logoFloat }] }}>
        <Image
          source={require('../assets/asinu_chat_sticker.png')}
          style={styles.sticker}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Brand */}
      <Animated.View style={[styles.brandWrap, { opacity: textOpacity }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>ASINU</Text>
          <View style={styles.liteBadge}>
            <Text style={styles.liteText}>Lite</Text>
          </View>
        </View>
        <Text style={styles.tagline}>{t('tagline')}</Text>
      </Animated.View>

      {/* Loading dots */}
      <View style={styles.dotsWrap}>
        <LoadingDot delay={0} />
        <LoadingDot delay={220} />
        <LoadingDot delay={440} />
      </View>

      <DataConsentModal visible={showConsent} onAgree={() => setShowConsent(false)} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
    overflow: 'hidden',
  },
  sticker: {
    width: 156,
    height: 156,
  },
  // Brand
  brandWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    fontSize: 44,
    fontWeight: '900',
    color: '#155e58',
    letterSpacing: 5,
  },
  liteBadge: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(21,94,88,0.14)',
    marginTop: 8,
  },
  liteText: {
    color: '#287b72',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  tagline: {
    color: '#6b817f',
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  // Loading dots
  dotsWrap: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#159f91',
  },
});
