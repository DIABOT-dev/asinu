import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../styles';
import { ScaledText as Text } from './ScaledText';

const asinuSticker = require('../../assets/asinu_chat_sticker.png');

type HeaderButtonProps = {
  onPress: () => void;
  accessibilityLabel?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ScreenBackButton({ onPress, accessibilityLabel = 'Quay lại', disabled, style }: HeaderButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.backButton, style, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <Ionicons name="arrow-back" size={22} color={colors.primary} />
    </Pressable>
  );
}

export function ScreenSaveButton({ onPress, accessibilityLabel = 'Lưu', disabled, style }: HeaderButtonProps) {
  const { t } = useTranslation('common');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.saveButton, style, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {disabled ? <ActivityIndicator size="small" color={colors.primary} /> : <Image source={asinuSticker} style={styles.saveMascot} resizeMode="contain" />}
      <Text style={styles.saveLabel}>{t('save')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadowColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButton: {
    minWidth: 68,
    height: 44,
    paddingHorizontal: 2,
    gap: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  saveMascot: {
    width: 36,
    height: 36,
  },
  saveLabel: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});
