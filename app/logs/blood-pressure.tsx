import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { spacing, colors } from '../../src/styles';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { Screen } from '../../src/components/Screen';
import { validateBloodPressurePayload } from '../../src/features/logs/logs.validation';

export default function BloodPressureLogScreen() {
  const [systolic, setSystolic] = useState('');
  const [diastolic, setDiastolic] = useState('');
  const [tags, setTags] = useState('Sau tập');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createBloodPressure = useLogsStore((state) => state.createBloodPressure);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const handleSubmit = async () => {
    const result = validateBloodPressurePayload(systolic, diastolic, tags.split(',').map((t) => t.trim()));
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await createBloodPressure(result.value);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.container, { paddingTop: padTop }]}>
        <H1SectionHeader title="Huyết áp" subtitle="Ghi nhanh" />
        <TextInput label="Tâm thu" keyboardType="numeric" value={systolic} onChangeText={setSystolic} error={errors.bp} />
        <TextInput label="Tâm trương" keyboardType="numeric" value={diastolic} onChangeText={setDiastolic} error={errors.bp} />
        <TextInput label="Tags" value={tags} onChangeText={setTags} placeholder="Sau tập, Sáng" />
        {errors.bp ? <Text style={styles.error}>{errors.bp}</Text> : null}
        <Button label="Lưu" onPress={handleSubmit} />
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
