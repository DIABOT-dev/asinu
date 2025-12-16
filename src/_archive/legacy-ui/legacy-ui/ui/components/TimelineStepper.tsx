import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/ui/theme';

export type TimelineItem = {
  id: string;
  label: string;
  description?: string;
};

export type TimelineStepperProps = {
  items: TimelineItem[];
  currentIndex?: number;
};

export const TimelineStepper = ({ items, currentIndex = 0 }: TimelineStepperProps) => {
  return (
    <View style={styles.container}>
      {items.map((item, index) => {
        const isActive = index <= currentIndex;
        return (
          <View key={item.id} style={styles.row}>
            <View style={styles.iconColumn}>
              <View style={[styles.node, isActive && styles.nodeActive]} />
              {index < items.length - 1 ? <View style={[styles.connector, isActive && styles.connectorActive]} /> : null}
            </View>
            <View style={styles.textColumn}>
              <Text style={[styles.label, isActive && styles.labelActive]}>{item.label}</Text>
              {item.description ? <Text style={styles.description}>{item.description}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: spacing.md
  },
  row: {
    flexDirection: 'row',
    gap: spacing.md
  },
  iconColumn: {
    alignItems: 'center'
  },
  textColumn: {
    flex: 1,
    gap: spacing.xs
  },
  node: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface
  },
  nodeActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary
  },
  connector: {
    width: 2,
    flex: 1,
    backgroundColor: colors.border
  },
  connectorActive: {
    backgroundColor: colors.primary
  },
  label: {
    fontSize: 16,
    color: colors.textSecondary
  },
  labelActive: {
    color: colors.textPrimary,
    fontWeight: '600'
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary
  }
});
