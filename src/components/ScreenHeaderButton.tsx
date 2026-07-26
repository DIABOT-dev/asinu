import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { colors } from '../styles';

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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.saveButton, style, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {disabled ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <MaterialCommunityIcons name="content-save-outline" size={21} color={colors.primary} />
      )}
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
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.78 },
  disabled: { opacity: 0.55 },
});
