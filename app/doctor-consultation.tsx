import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScaledText as Text } from '../src/components/ScaledText';
import { useAuthStore } from '../src/features/auth/auth.store';
import { apiClient } from '../src/lib/apiClient';
import { env } from '../src/lib/env';
import { useThemeColors } from '../src/hooks/useThemeColors';
import { useGuardedRouter } from '../src/hooks/useGuardedRouter';
import { showToast } from '../src/stores/toast.store';
import { radius, spacing } from '../src/styles';

type DoctorTaskResponse = { ok: boolean; data?: { task_id: string } };

export default function DoctorConsultationScreen() {
  const { t } = useTranslation('home');
  const router = useRouter();
  const { colors } = useThemeColors();
  const profile = useAuthStore((state) => state.profile);
  const [summary, setSummary] = useState('');
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!summary.trim() || !consentAccepted || isSubmitting) {
      showToast(t('doctorConsultationRequired'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient<DoctorTaskResponse>('/api/doctor/tasks', {
        method: 'POST',
        body: {
          tenant_id: env.doctorTenantId,
          specialty: 'general-practice',
          service_flow: 'clinical',
          priority: 'normal',
          source_channel: 'asinu-mobile',
          service_code: 'doctor-consultation',
          summary: summary.trim(),
          consent_version: profile?.consentVersion || 'v1.0.0',
        },
      });
      showToast(t('doctorConsultationSuccess'), 'success');
      router.back();
    } catch {
      showToast(t('doctorConsultationError'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          <Text style={[styles.backText, { color: colors.textPrimary }]}>{t('common:back')}</Text>
        </Pressable>
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={[styles.icon, { backgroundColor: colors.primary + '18' }]}>
            <Ionicons name="medkit-outline" size={30} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{t('doctorConsultationTitle')}</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('doctorConsultationSubtitle')}</Text>
        </View>
        <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t('doctorConsultationSummaryLabel')}</Text>
          <TextInput
            multiline
            maxLength={5000}
            onChangeText={setSummary}
            placeholder={t('doctorConsultationSummaryPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, { color: colors.textPrimary, borderColor: colors.border, backgroundColor: colors.background }]}
            textAlignVertical="top"
            value={summary}
          />
          <Pressable onPress={() => setConsentAccepted((value) => !value)} style={styles.consentRow}>
            <Ionicons
              name={consentAccepted ? 'checkbox' : 'square-outline'}
              size={24}
              color={consentAccepted ? colors.primary : colors.textSecondary}
            />
            <Text style={[styles.consentText, { color: colors.textSecondary }]}>{t('doctorConsultationConsent')}</Text>
          </Pressable>
          <Pressable
            disabled={isSubmitting}
            onPress={() => void submit()}
            style={[styles.submit, { backgroundColor: colors.primary, opacity: isSubmitting ? 0.65 : 1 }]}
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('doctorConsultationSubmit')}</Text>}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xl },
  backButton: { alignItems: 'center', flexDirection: 'row', gap: spacing.xs, minHeight: 44 },
  backText: { fontSize: 15, fontWeight: '600' },
  hero: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.sm },
  icon: { alignItems: 'center', borderRadius: radius.md, height: 58, justifyContent: 'center', width: 58 },
  title: { fontSize: 26, fontWeight: '800', marginTop: spacing.xs },
  subtitle: { fontSize: 15, lineHeight: 23 },
  formCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, gap: spacing.md },
  label: { fontSize: 16, fontWeight: '700' },
  input: { borderRadius: radius.md, borderWidth: 1, fontSize: 16, minHeight: 150, padding: spacing.md },
  consentRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  consentText: { flex: 1, fontSize: 14, lineHeight: 21 },
  submit: { alignItems: 'center', borderRadius: radius.md, justifyContent: 'center', minHeight: 52, paddingHorizontal: spacing.md },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
