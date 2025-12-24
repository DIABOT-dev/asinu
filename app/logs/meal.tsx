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
import { validateMealPayload } from '../../src/features/logs/logs.validation';

export default function MealLogScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [macros, setMacros] = useState('');
  const [kcal, setKcal] = useState('');
  const [notes, setNotes] = useState('');
  const [photoKey, setPhotoKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createMeal = useLogsStore((state) => state.createMeal);
  const insets = useSafeAreaInsets();
  const padTop = insets.top + spacing.lg;

  const handleSubmit = async () => {
    const result = validateMealPayload(title, macros, kcal, photoKey, notes);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    await createMeal(result.value);
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
          <H1SectionHeader title="Bua an" subtitle="Ghi nhanh" />
          <TextInput label="Ten bua" value={title} onChangeText={setTitle} placeholder="VD: Bua sang" error={errors.title} />
          <TextInput label="Macros" value={macros} onChangeText={setMacros} placeholder="Carb/Protein/Fat..." />
          <TextInput label="Kcal" keyboardType="numeric" value={kcal} onChangeText={setKcal} placeholder="Tuy chon" error={errors.kcal} />
          <TextInput label="Photo key" value={photoKey} onChangeText={setPhotoKey} placeholder="Tuy chon" />
          <TextInput label="Ghi chú" value={notes} onChangeText={setNotes} multiline />
          {errors.title ? <Text style={[styles.error, { fontFamily: 'System' }]}>{errors.title}</Text> : null}
          {errors.kcal ? <Text style={[styles.error, { fontFamily: 'System' }]}>{errors.kcal}</Text> : null}
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
