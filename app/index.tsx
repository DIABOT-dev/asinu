import { LinearGradient } from 'expo-linear-gradient';
import { useRootNavigationState, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, Image, InteractionManager, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../src/components/ScaledText';
import { DataConsentModal, hasDataConsent } from '../src/components/DataConsentModal';
import { useAuthStore } from '../src/features/auth/auth.store';
import { spacing } from '../src/styles';

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
  const router = useRouter();
  const navigationState = useRootNavigationState();
  const profile = useAuthStore((state) => state.profile);
  const loading = useAuthStore((state) => state.loading);
  const bootstrap = useAuthStore((state) => state.bootstrap);
  const isNavReady = Boolean(navigationState?.key);
  const insets = useSafeAreaInsets();

  const logoScale   = useRef(new Animated.Value(0.75)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
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
    const task = InteractionManager.runAfterInteractions(() => {
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
      colors={['#0dd4bc', '#08b8a2', '#076b5e']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }]}
    >
      {/* Decorative background circles */}
      <View style={styles.circleTopRight} />
      <View style={styles.circleBottomLeft} />
      <View style={styles.circleCenter} />

      {/* Logo */}
      <Animated.View style={{ opacity: logoOpacity, transform: [{ scale: logoScale }] }}>
        <View style={styles.logoShadow}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logo}
            resizeMode="cover"
          />
        </View>
      </Animated.View>

      {/* Brand */}
      <Animated.View style={[styles.brandWrap, { opacity: textOpacity }]}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>ASINU</Text>
          <View style={styles.liteBadge}>
            <Text style={styles.liteText}>Lite</Text>
          </View>
        </View>
        <Text style={styles.tagline}>Sức khoẻ của bạn, mỗi ngày</Text>
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
  // Decorative circles
  circleTopRight: {
    position: 'absolute',
    top: -100,
    right: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  circleBottomLeft: {
    position: 'absolute',
    bottom: -80,
    left: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  circleCenter: {
    position: 'absolute',
    top: '30%',
    left: -120,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  // Logo
  logoShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.28,
    shadowRadius: 22,
    elevation: 18,
    borderRadius: 36,
    backgroundColor: 'transparent',
  },
  logo: {
    width: 128,
    height: 128,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.25)',
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
    color: '#ffffff',
    letterSpacing: 5,
  },
  liteBadge: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    marginTop: 8,
  },
  liteText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  tagline: {
    color: 'rgba(255,255,255,0.72)',
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
    backgroundColor: '#ffffff',
  },
});
