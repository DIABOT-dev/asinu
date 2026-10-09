import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { spacing } from '../../../styles';

const FAMILY_3D_ART = require('../../../../assets/images/care-circle/family_3d_art.png');
const HERO_QUOTE_VI = require('../../../../assets/images/care-circle/hero_quote_vi.png');
const HERO_QUOTE_EN = require('../../../../assets/images/care-circle/hero_quote_en.png');

type Props = {
  title?: string;
  subtitle?: string;
  language?: string;
};

export function CareCircleHeroBanner({ title, subtitle, language = 'vi' }: Props) {
  const { t } = useTranslation('careCircle');
  const { isDark } = useThemeColors();

  // 1. Family 3D illustration floating & breathing animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // 2. Warm ambient aura pulse behind the family
  const auraScale = useRef(new Animated.Value(0.95)).current;
  const auraOpacity = useRef(new Animated.Value(0.3)).current;

  // 3. Twinkling sparkles
  const sparkle1Anim = useRef(new Animated.Value(0.2)).current;
  const sparkle2Anim = useRef(new Animated.Value(0.3)).current;

  // 4. Subtle quote breathing
  const quoteScale = useRef(new Animated.Value(1)).current;

  // 5. Floating affection hearts (tình cảm gia đình)
  const heart1Y = useRef(new Animated.Value(0)).current;
  const heart1Opacity = useRef(new Animated.Value(0)).current;
  const heart1Scale = useRef(new Animated.Value(0.7)).current;

  const heart2Y = useRef(new Animated.Value(0)).current;
  const heart2Opacity = useRef(new Animated.Value(0)).current;
  const heart2Scale = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    // Family floating loop (smooth sine wave bobbing + gentle sway + breathing)
    const familyFloatLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: -5,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1.025,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auraScale, {
            toValue: 1.18,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.55,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auraScale, {
            toValue: 0.95,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(auraOpacity, {
            toValue: 0.3,
            duration: 1500,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    // Sparkle 1 twinkling
    const sparkle1Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle1Anim, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkle1Anim, {
          toValue: 0.2,
          duration: 900,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Sparkle 2 twinkling (offset)
    const sparkle2Loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sparkle2Anim, {
          toValue: 0.9,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sparkle2Anim, {
          toValue: 0.25,
          duration: 1100,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Quote subtle breathing loop
    const quoteLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(quoteScale, {
          toValue: 1.02,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(quoteScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Floating Heart 1 loop (warm rose pink)
    const heart1Loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(heart1Y, {
            toValue: -24,
            duration: 2200,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(heart1Opacity, {
              toValue: 0.9,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(heart1Opacity, {
              toValue: 0,
              duration: 1700,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(heart1Scale, {
            toValue: 1.2,
            duration: 2200,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(heart1Y, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(heart1Scale, {
            toValue: 0.7,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(400),
      ])
    );

    // Floating Heart 2 loop (warm mint emerald, staggered)
    let heart2Loop: Animated.CompositeAnimation | null = null;
    const heart2Delay = setTimeout(() => {
      heart2Loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(heart2Y, {
              toValue: -20,
              duration: 2400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
            Animated.sequence([
              Animated.timing(heart2Opacity, {
                toValue: 0.8,
                duration: 600,
                useNativeDriver: true,
              }),
              Animated.timing(heart2Opacity, {
                toValue: 0,
                duration: 1800,
                useNativeDriver: true,
              }),
            ]),
            Animated.timing(heart2Scale, {
              toValue: 1.1,
              duration: 2400,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(heart2Y, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(heart2Scale, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
          Animated.delay(600),
        ])
      );
      heart2Loop.start();
    }, 1100);

    familyFloatLoop.start();
    sparkle1Loop.start();
    sparkle2Loop.start();
    quoteLoop.start();
    heart1Loop.start();

    return () => {
      clearTimeout(heart2Delay);
      familyFloatLoop.stop();
      sparkle1Loop.stop();
      sparkle2Loop.stop();
      quoteLoop.stop();
      heart1Loop.stop();
      heart2Loop?.stop();
    };
  }, [
    floatAnim,
    scaleAnim,
    auraScale,
    auraOpacity,
    sparkle1Anim,
    sparkle2Anim,
    quoteScale,
    heart1Y,
    heart1Opacity,
    heart1Scale,
    heart2Y,
    heart2Opacity,
    heart2Scale,
  ]);

  const sparkle1Rotate = sparkle1Anim.interpolate({
    inputRange: [0.2, 1],
    outputRange: ['0deg', '45deg'],
  });

  const quoteSource = language === 'en' ? HERO_QUOTE_EN : HERO_QUOTE_VI;

  return (
    <View style={styles.heroCardShadowWrap}>
      <LinearGradient
        colors={
          isDark
            ? ['#0f2e28', '#09211c']
            : ['#F3FCFB', '#E2F6F2']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[
          styles.heroCardContainer,
          isDark && { borderColor: 'rgba(20, 184, 166, 0.25)' },
        ]}
      >
        {/* Warm Ambient Aura behind the Family */}
        <Animated.View
          style={[
            styles.ambientAura,
            {
              transform: [{ scale: auraScale }],
              opacity: auraOpacity,
            },
          ]}
        />

        {/* Floating Affection Heart 1 (Warm Rose Pink) */}
        <Animated.View
          style={[
            styles.floatingHeart1,
            {
              transform: [{ translateY: heart1Y }, { scale: heart1Scale }],
              opacity: heart1Opacity,
            },
          ]}
        >
          <Ionicons name="heart" size={16} color="#FB7185" />
        </Animated.View>

        {/* Floating Affection Heart 2 (Warm Mint) */}
        <Animated.View
          style={[
            styles.floatingHeart2,
            {
              transform: [{ translateY: heart2Y }, { scale: heart2Scale }],
              opacity: heart2Opacity,
            },
          ]}
        >
          <Ionicons name="heart" size={13} color="#34D399" />
        </Animated.View>

        {/* Floating Sparkle 1 */}
        <Animated.View
          style={[
            styles.sparkle1,
            {
              opacity: sparkle1Anim,
              transform: [{ scale: sparkle1Anim }, { rotate: sparkle1Rotate }],
            },
          ]}
        >
          <Ionicons name="sparkles" size={14} color="#0D9488" />
        </Animated.View>

        {/* Floating Sparkle 2 */}
        <Animated.View
          style={[
            styles.sparkle2,
            {
              opacity: sparkle2Anim,
              transform: [{ scale: sparkle2Anim }],
            },
          ]}
        >
          <Ionicons name="sparkles" size={11} color="#F59E0B" />
        </Animated.View>

        {/* Right: Animated 3D Family Illustration */}
        <Animated.View
          style={[
            styles.heroFamilyImageWrap,
            {
              transform: [
                { translateY: floatAnim },
                { scale: scaleAnim },
              ],
            },
          ]}
        >
          <Image
            source={FAMILY_3D_ART}
            style={styles.heroFamilyImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Left: Native Texts & Animated Calligraphic Quote */}
        <View style={styles.heroTextContent}>
          <Text
            style={[
              styles.heroCardTitle,
              isDark && { color: '#6EE7B7' },
            ]}
          >
            {title ?? t('title')}
          </Text>
          <Text
            style={[
              styles.heroCardSubtitle,
              isDark && { color: '#94A3B8' },
            ]}
          >
            {subtitle ?? t('headerSubtitle')}
          </Text>
          <Animated.View
            style={[
              styles.heroQuoteWrapper,
              { transform: [{ scale: quoteScale }] },
            ]}
          >
            <Image
              source={quoteSource}
              style={styles.heroQuoteImage}
              resizeMode="contain"
            />
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  heroCardShadowWrap: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  heroCardContainer: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D8F1EB',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    minHeight: 168,
    position: 'relative',
    justifyContent: 'flex-start',
  },
  ambientAura: {
    backgroundColor: 'rgba(52, 211, 153, 0.22)',
    borderRadius: 90,
    bottom: -10,
    height: 180,
    position: 'absolute',
    right: 15,
    width: 180,
  },
  floatingHeart1: {
    position: 'absolute',
    right: 48,
    top: 18,
    zIndex: 5,
  },
  floatingHeart2: {
    position: 'absolute',
    right: 95,
    top: 26,
    zIndex: 5,
  },
  sparkle1: {
    position: 'absolute',
    right: 70,
    top: 12,
    zIndex: 4,
  },
  sparkle2: {
    position: 'absolute',
    right: 15,
    top: 32,
    zIndex: 4,
  },
  heroFamilyImageWrap: {
    bottom: 0,
    height: '100%',
    position: 'absolute',
    right: 0,
    top: 0,
    width: '51%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 2,
  },
  heroFamilyImage: {
    height: '100%',
    width: '100%',
  },
  heroTextContent: {
    justifyContent: 'center',
    paddingLeft: 20,
    paddingVertical: 14,
    width: '49%',
    zIndex: 3,
  },
  heroCardTitle: {
    color: '#0D7A68',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  heroCardSubtitle: {
    color: '#4B5563',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: 4,
  },
  heroQuoteWrapper: {
    marginTop: 10,
  },
  heroQuoteImage: {
    alignSelf: 'flex-start',
    height: 50,
    width: 140,
  },
});
