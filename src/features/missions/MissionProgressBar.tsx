import { StyleSheet, View } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';

type Props = {
  title: string;
  progress: number;
  goal: number;
  completed: boolean;
};

export function MissionProgressBar({ title, progress, goal, completed }: Props) {
  const { colors } = useThemeColors();
  const target = Number.isFinite(goal) && goal > 0 ? goal : 1;
  const value = completed ? target : Math.min(target, Math.max(0, Number.isFinite(progress) ? progress : 0));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={title}
      accessibilityValue={{ min: 0, max: target, now: value }}
      style={[styles.track, { backgroundColor: colors.border }]}
    >
      <View
        style={[
          styles.fill,
          { width: `${(value / target) * 100}%`, backgroundColor: colors.primaryDark },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    marginTop: 12,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
});
