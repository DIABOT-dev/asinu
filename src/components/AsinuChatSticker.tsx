import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Image, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { colors, spacing } from '../styles';

const AsinuSticker = require('../../assets/asinu_chat_sticker.png');

type AsinuChatStickerProps = {
  onPress?: () => void;
};

export default function AsinuChatSticker({ onPress }: AsinuChatStickerProps) {
  const { t } = useTranslation('chat');
  const MESSAGES = t('stickerMessages', { returnObjects: true }) as string[];

  // Float animation
  const floatY = useRef(new Animated.Value(0)).current;
  // Bubble fade
  const bubbleOpacity = useRef(new Animated.Value(1)).current;
  const bubbleScale  = useRef(new Animated.Value(1)).current;
  // Current message index
  const [msgIndex, setMsgIndex] = useState(0);

  // Float: bob up 6px and back, loop every 2.4s
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -7, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue:  0, duration: 1100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  // Text cycle: every 3.5s, fade out → change text → fade + scale in
  useEffect(() => {
    const cycle = setInterval(() => {
      Animated.parallel([
        Animated.timing(bubbleOpacity, { toValue: 0, duration: 280, useNativeDriver: true }),
        Animated.timing(bubbleScale,   { toValue: 0.85, duration: 280, useNativeDriver: true }),
      ]).start(() => {
        setMsgIndex(i => (i + 1) % MESSAGES.length);
        Animated.parallel([
          Animated.timing(bubbleOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
          Animated.spring(bubbleScale,   { toValue: 1, useNativeDriver: true }),
        ]).start();
      });
    }, 3500);
    return () => clearInterval(cycle);
  }, []);

  return (
    <Pressable style={styles.wrapper} onPress={onPress} accessibilityRole="button">
      {/* Floating image */}
      <Animated.Image
        source={AsinuSticker}
        style={[styles.sticker, { transform: [{ translateY: floatY }] }]}
        resizeMode="contain"
      />

      {/* Speech bubble */}
      <Animated.View
        style={[styles.bubble, { opacity: bubbleOpacity, transform: [{ scale: bubbleScale }] }]}
        pointerEvents="none"
      >
        <Text style={styles.bubbleText}>{MESSAGES[msgIndex]}</Text>
        <View style={styles.tail} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: 56,
    paddingBottom: 12,
    position: 'relative',
    overflow: 'visible',
  },
  sticker: {
    width: 200,
    height: 200,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  bubble: {
    position: 'absolute',
    top: 0,
    right: 6,
    transform: [{ translateY: -28 }],
    maxWidth: 180,
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  bubbleText: {
    fontWeight: '700',
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  tail: {
    position: 'absolute',
    bottom: -8,
    right: 22,
    width: 12,
    height: 12,
    backgroundColor: '#fff',
    transform: [{ rotate: '45deg' }],
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
