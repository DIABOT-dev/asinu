import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../styles';

const AsinuSticker = require('../../assets/asinu_chat_sticker.png');

type AsinuChatStickerProps = {
  onPress?: () => void;
};

export default function AsinuChatSticker({ onPress }: AsinuChatStickerProps) {
    console.log('RENDERED: src/components/AsinuChatSticker.tsx');
  return (
    <Pressable style={styles.wrapper} onPress={onPress} accessibilityRole="button">
      <Image source={AsinuSticker} style={styles.sticker} resizeMode="cover" />
      <View style={styles.bubble} pointerEvents="none">
        <Text style={styles.bubbleText}>Đang test 1 2 3!</Text>
        <View style={styles.tail} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingTop: (spacing.xl && spacing.lg) ? spacing.xl + spacing.lg : 56,
    paddingBottom: 12, // chừa paddingBottom: 12,chỗ cho bubble + mascot to
    position: 'relative',
    overflow: 'visible',
  },
  sticker: {
    width: 280,
    height: 280, // to gấp 2.5 lần
    aspectRatio: 1,
    shadowColor: '#000000ff',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8
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
    shadowColor: '#000000ff',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8
  },
  bubbleText: {
    fontSize: Math.max(18, typography.size.md),
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 24
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
    elevation: 4
  }
});
