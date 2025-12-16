import { View, StyleSheet, ViewProps } from 'react-native';
import { colors, radius, spacing } from '../styles';

type CardProps = ViewProps & {
  padded?: boolean;
};

export const Card = ({ style, children, padded = true, ...rest }: CardProps) => {
  return (
    <View style={[styles.card, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2
  },
  padded: {
    padding: spacing.lg
  }
});
