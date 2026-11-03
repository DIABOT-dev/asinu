import { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing } from '../styles';

type LogHeroBannerProps = {
  title: string;
  description: string;
  style?: StyleProp<ViewStyle>;
};

export function LogHeroBanner({
  title,
  description,
  style,
}: LogHeroBannerProps) {
  const { colors } = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={[styles.header, style]}>
      <View style={styles.textColumn}>
        <Text style={styles.title}>
          {title}
        </Text>
        <Text style={styles.description}>
          {description}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (colors: ReturnType<typeof useThemeColors>['colors']) =>
  StyleSheet.create({
    header: {
      backgroundColor: 'transparent',
      paddingVertical: spacing.sm,
    },
    textColumn: {
      gap: spacing.xs,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: -0.5,
      color: colors.textPrimary,
      marginBottom: 4,
    },
    description: {
      fontSize: 13,
      lineHeight: 18,
      color: colors.textSecondary,
    },
  });
