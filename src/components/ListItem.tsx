import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, ViewProps } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { colors, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

type Props = ViewProps & {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
};

export const ListItem = React.memo(({ title, subtitle, onPress, right, style }: Props) => {
  const scaledTypography = useScaledTypography();
  const Container = onPress ? Pressable : View;
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center'
    },
    textContainer: {
      gap: spacing.xs,
      flex: 1
    },
    title: {
      fontWeight: '600',
      color: colors.textPrimary,
      fontFamily: 'System'
    },
    subtitle: {
      color: colors.textSecondary,
      fontFamily: 'System'
    }
  }), [isDark]);

  return (
    <Container style={[styles.container, style]} onPress={onPress}>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { fontSize: scaledTypography.size.md }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { fontSize: scaledTypography.size.sm }]}>{subtitle}</Text> : null}
      </View>
      {right}
    </Container>
  );
});
