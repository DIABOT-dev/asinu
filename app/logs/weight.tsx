import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { spacing, colors } from '../../src/styles';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { Screen } from '../../src/components/Screen';
import { validateWeightPayload } from '../../src/features/logs/logs.validation';

export default function WeightLogScreen() {
  const [weight, setWeight] = useState('');
  const [bodyfat, setBodyfat] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createWeight = useLogsStore((state) => state.createWeight);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const bmi = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(heightCm);
    if (!Number.isFinite(w) || !Number.isFinite(h) || h === 0) return null;
    const hMeter = h / 100;
    return (w / (hMeter * hMeter)).toFixed(1);
  }, [heightCm, weight]);

  const handleSubmit = async () => {
    const result = validateWeightPayload(weight, bodyfat, notes);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await createWeight(result.value);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        <H1SectionHeader title="Can nang" subtitle="Ghi nhanh" />
        <TextInput label="Can nang (kg)" keyboardType="numeric" value={weight} onChangeText={setWeight} error={errors.weight} />
        <TextInput
          label="Body fat (%)"
          keyboardType="numeric"
          value={bodyfat}
          onChangeText={setBodyfat}
          placeholder="Tuy chon"
          error={errors.bodyfat}
        />
        <TextInput
          label="Chieu cao (cm)"
          keyboardType="numeric"
          value={heightCm}
          onChangeText={setHeightCm}
          placeholder="De tinh BMI (khong gui)"
        />
        {bmi ? <Text style={[styles.helper, { fontFamily: 'System' }]}>BMI uoc tinh: {bmi}</Text> : null}
        <TextInput label="Ghi chu" value={notes} onChangeText={setNotes} multiline />
        {errors.weight ? <Text style={[styles.error, { fontFamily: 'System' }]}>{errors.weight}</Text> : null}
        {errors.bodyfat ? <Text style={[styles.error, { fontFamily: 'System' }]}>{errors.bodyfat}</Text> : null}
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
  helper: {
    color: colors.textSecondary
  },
  error: {
    color: colors.danger,
    fontWeight: '600'
  }
});
