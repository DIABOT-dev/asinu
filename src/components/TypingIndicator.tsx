import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, radius, spacing } from '../styles';
import { ScaledText as Text } from './ScaledText';

type Props = {
  avatar?: string;
};

const Dot = ({ delay }: { delay: number }) => {
  const offset = useSharedValue(0);
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    offset.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-4, { duration: 360, easing: Easing.out(Easing.quad) }),
          withTiming(0,  { duration: 360, easing: Easing.in(Easing.quad) }),
          withTiming(0,  { duration: 280 }),
        ),
        -1,
      ),
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1,    { duration: 360 }),
          withTiming(0.35, { duration: 360 }),
          withTiming(0.35, { duration: 280 }),
        ),
        -1,
      ),
    );
  }, [delay, offset, opacity]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offset.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, animStyle]} />;
};

export const TypingIndicator = ({ avatar }: Props) => {
  const { t } = useTranslation('chat');
  const typography = useScaledTypography();

  // Subtle "breathing" pulse on the bubble — feels alive without distracting
  const breathe = useSharedValue(1);
  useEffect(() => {
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.015, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
        withTiming(1,     { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
    );
  }, [breathe]);

  const bubbleAnim = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  return (
    <Animated.View
      entering={FadeInUp.duration(220).easing(Easing.out(Easing.quad))}
      style={styles.row}
      accessibilityRole="text"
      accessibilityLabel={t('typing')}
    >
      {avatar ? (
        <Image source={{ uri: avatar }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarSpacer} />
      )}
      <Animated.View style={[styles.bubble, bubbleAnim]}>
        <Text
          style={[styles.label, { fontSize: typography.size.sm }]}
          numberOfLines={2}
        >
          {t('typing')}
        </Text>
        <View style={styles.dotsRow}>
          <Dot delay={0} />
          <Dot delay={140} />
          <Dot delay={280} />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 12,
  },
  avatarSpacer: {
    width: 32,
  },
  bubble: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.xl ?? 24,
    borderTopLeftRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    maxWidth: '82%',
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '500',
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
  },
});
