import { useState } from 'react';
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
import { validateBloodPressurePayload } from '../../src/features/logs/logs.validation';

export default function BloodPressureLogScreen() {
  const router = useRouter();
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
          <H1SectionHeader title="Huyết áp" subtitle="Ghi nhanh" />
          <TextInput label="Tâm thu" keyboardType="numeric" value={systolic} onChangeText={setSystolic} error={errors.bp} />
          <TextInput label="Tâm trương" keyboardType="numeric" value={diastolic} onChangeText={setDiastolic} error={errors.bp} />
          <TextInput label="Tags" value={tags} onChangeText={setTags} placeholder="Sau tập, Sáng" />
          {errors.bp ? <Text style={styles.error}>{errors.bp}</Text> : null}
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
  error: {
    color: colors.danger,
    fontWeight: '600'
  }
});
