import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { spacing, colors } from '../../src/styles';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { Screen } from '../../src/components/Screen';
import { validateWaterPayload } from '../../src/features/logs/logs.validation';

export default function WaterLogScreen() {
  const [volume, setVolume] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createWater = useLogsStore((state) => state.createWater);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const handleSubmit = async () => {
    const result = validateWaterPayload(volume);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await createWater(result.value);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        <H1SectionHeader title="Nuoc uong" subtitle="Ghi nhanh" />
        <TextInput label="The tich (ml)" keyboardType="numeric" value={volume} onChangeText={setVolume} error={errors.volume} />
        {errors.volume ? <Text style={[styles.error, { fontFamily: 'System' }]}>{errors.volume}</Text> : null}
        <Button label="Luu" onPress={handleSubmit} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.md,
    backgroundColor: colors.background
  },
  error: {
    color: colors.danger,
    fontWeight: '600'
  }
});
