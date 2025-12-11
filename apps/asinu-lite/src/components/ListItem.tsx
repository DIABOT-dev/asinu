import { View, Text, StyleSheet, Pressable, ViewProps } from 'react-native';
import { colors, spacing, typography } from '../styles';

type Props = ViewProps & {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
};

export const ListItem = ({ title, subtitle, onPress, right, style }: Props) => {
  const Container = onPress ? Pressable : View;
  return (
    <Container style={[styles.container, style]} onPress={onPress}>
      <View style={styles.textContainer}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
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
    fontSize: typography.size.md,
    fontWeight: '600',
    color: colors.textPrimary,
    fontFamily: 'System'
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: 'System',
    fontSize: typography.size.sm
  }
});
