import { useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { H1SectionHeader } from '../../src/ui-kit/H1SectionHeader';
import { TextInput } from '../../src/components/TextInput';
import { Button } from '../../src/components/Button';
import { spacing } from '../../src/styles';
import { colors } from '../../src/styles/theme';
import { useLogsStore } from '../../src/features/logs/logs.store';
import { Screen } from '../../src/components/Screen';
import { validateWeightPayload } from '../../src/features/logs/logs.validation';

export default function WeightLogScreen() {
  const router = useRouter();
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
    <>
      <Stack.Screen
        options={{
          headerShown: true, // Bắt buộc hiện Header
          presentation: 'modal', // Hiệu ứng trượt lên
          title: 'Ghi chỉ số', // (Hoặc giữ nguyên title cũ nếu có)
          headerStyle: { backgroundColor: colors.background },
          headerTitleStyle: { color: colors.textPrimary },
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 0, padding: 10 }}>
              {/* Dùng Icon mũi tên, size 28 cho dễ bấm, màu đen cho tương phản tốt */}
              <Ionicons name="arrow-back" size={28} color={colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />
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
          <TextInput label="Ghi chú" value={notes} onChangeText={setNotes} multiline />
          {errors.weight ? <Text style={[styles.error, { fontFamily: 'System' }]}>{errors.weight}</Text> : null}
          {errors.bodyfat ? <Text style={[styles.error, { fontFamily: 'System' }]}>{errors.bodyfat}</Text> : null}
          <Button label="Lưu" onPress={handleSubmit} />
        </ScrollView>
      </Screen>
    </>
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
