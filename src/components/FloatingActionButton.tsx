import React, { useMemo } from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { ScaledText as Text } from './ScaledText';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = {
  label: string;
  onPress?: () => void;
  style?: ViewStyle;
};

export const FloatingActionButton = React.memo(({ label, onPress, style }: Props) => {
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.xl,
      backgroundColor: colors.primaryLight,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.lg,
      borderRadius: radius.xl,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 5
    },
    label: {
      color: colors.primary,
      fontWeight: '700',
      fontFamily: 'Inter_600SemiBold'
    }
  }), [isDark]);

  return (
    <Pressable style={[styles.fab, style]} onPress={onPress}>
      <Text style={[styles.label, { fontSize: scaledTypography.size.md }]}>{label}</Text>
    </Pressable>
  );
});
