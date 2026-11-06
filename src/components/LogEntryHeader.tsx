import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '../hooks/useThemeColors';
import { spacing } from '../styles';
import { ScaledText as Text } from './ScaledText';
import { ScreenBackButton, ScreenSaveButton } from './ScreenHeaderButton';

type Props = {
  title: string;
  onBack: () => void;
  onSave: () => void;
  saving: boolean;
};

export function LogEntryHeader({ title, onBack, onSave, saving }: Props) {
  const { colors } = useThemeColors();

  return (
    <View style={styles.row}>
      <View style={styles.leading}>
        <ScreenBackButton onPress={onBack} />
      </View>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
        {title}
      </Text>
      <View style={styles.trailing}>
        <ScreenSaveButton onPress={onSave} disabled={saving} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  leading: {
    width: 80,
    alignItems: 'flex-start',
  },
  trailing: {
    width: 80,
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
});
