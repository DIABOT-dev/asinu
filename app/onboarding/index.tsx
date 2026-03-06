import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { useAuthStore } from '../../src/features/auth/auth.store';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { apiClient } from '../../src/lib/apiClient';
import { useLanguageStore } from '../../src/stores/language.store';
import { colors, radius, spacing } from '../../src/styles';

// ─── Types ──────────────────────────────────────────────────────────

type AIQuestion = {
  done: false;
  question: string;
  type: 'single' | 'multi' | 'text';
  options?: string[];
  allow_other?: boolean;
  field?: string;
};

type AIDone = {
  done: true;
  profile: Record<string, unknown>;
};

type AIResponse = AIQuestion | AIDone;

type ConversationMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type HistoryEntry = {
  messages: ConversationMessage[];
  question: AIQuestion;
};

// ─── Helpers ────────────────────────────────────────────────────────


// ─── Component ──────────────────────────────────────────────────────

export default function OnboardingScreen() {
  const { t } = useTranslation('onboarding');
  const { t: tc } = useTranslation('common');
  const { language, setLanguage } = useLanguageStore();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<AIQuestion | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [otherText, setOtherText] = useState('');
  const [freeText, setFreeText] = useState('');
  const [fetching, setFetching] = useState(true);   // loading next question from AI
  const [saving, setSaving] = useState(false);       // saving final profile

  // Dùng ref để track language trước đó — tránh fire khi mount lần đầu
  const prevLangRef = useRef(language);

  const questionCount = history.length + 1;

  // ── Fetch next question ──────────────────────────────────────────

  async function fetchNext(msgs: ConversationMessage[]) {
    setFetching(true);
    setSelected([]);
    setOtherText('');
    setFreeText('');
    try {
      const res = await apiClient<AIResponse>('/api/mobile/onboarding/next', {
        method: 'POST',
        body: { messages: msgs, language },
      });

      if (!res.ok) {
        Alert.alert(t('errorTitle'), t('errorAI'));
        return;
      }

      if (res.done) {
        await saveProfile(res.profile);
        return;
      }

      setCurrentQuestion(res as AIQuestion);
      setMessages(msgs);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } catch {
      Alert.alert(t('errorTitle'), t('errorNetwork'));
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => {
    fetchNext([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khi user đổi ngôn ngữ → re-fetch câu hỏi hiện tại trong ngôn ngữ mới
  // messages giữ nguyên (history các câu đã trả lời không mất)
  useEffect(() => {
    if (prevLangRef.current === language) return;
    prevLangRef.current = language;
    if (!fetching && !saving) {
      fetchNext(messages);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // ── Save final profile ───────────────────────────────────────────

  async function saveProfile(profile: Record<string, unknown>) {
    setSaving(true);
    try {
      await apiClient('/api/mobile/onboarding/complete', {
        method: 'POST',
        body: { profile },
      });
      await bootstrap();
      router.replace('/(tabs)/home');
    } catch {
      Alert.alert(t('errorTitle'), t('pleaseTryAgain'));
    } finally {
      setSaving(false);
    }
  }

  // ── Answer validation ────────────────────────────────────────────

  const isValid = useMemo(() => {
    if (!currentQuestion) return false;
    const { type, allow_other } = currentQuestion;
    if (type === 'text') return freeText.trim().length > 0;
    if (type === 'single') return selected.length === 1 || (!!allow_other && otherText.trim().length > 0);
    if (type === 'multi') return selected.length > 0 || (!!allow_other && otherText.trim().length > 0);
    return false;
  }, [currentQuestion, selected, freeText, otherText]);

  // ── Build answer string for AI ────────────────────────────────────

  function buildAnswerContent(): string {
    if (!currentQuestion) return '';
    const { type, allow_other } = currentQuestion;
    if (type === 'text') return freeText.trim();
    if (type === 'single') {
      if (selected[0]) return allow_other && otherText.trim() ? `${selected[0]}, ${otherText.trim()}` : selected[0];
      return otherText.trim();
    }
    // multi
    const parts = [...selected];
    if (allow_other && otherText.trim()) parts.push(otherText.trim());
    return parts.join(', ');
  }

  // ── Handle next ───────────────────────────────────────────────────

  async function handleNext() {
    if (!currentQuestion || !isValid) return;

    const answer = buildAnswerContent();
    const newMessages: ConversationMessage[] = [
      ...messages,
      { role: 'assistant', content: currentQuestion.question },
      { role: 'user',      content: answer },
    ];

    setHistory(prev => [...prev, { messages, question: currentQuestion }]);
    await fetchNext(newMessages);
  }

  // ── Handle back ───────────────────────────────────────────────────

  function handleBack() {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory(h => h.slice(0, -1));
    setMessages(prev.messages);
    setCurrentQuestion(prev.question);
    setSelected([]);
    setOtherText('');
    setFreeText('');
  }

  // ── Selection helpers ─────────────────────────────────────────────

  function toggleOption(value: string, noneValue?: string) {
    setSelected(prev => {
      // Deselect if already selected
      if (prev.includes(value)) return prev.filter(v => v !== value);

      // Select "Không có" / "None" clears others
      if (noneValue && value === noneValue) return [value];

      // Selecting anything else removes "Không có" / "None"
      let next = [...prev, value];
      if (noneValue) next = next.filter(v => v !== noneValue);
      return next;
    });
  }

  // ── Render ────────────────────────────────────────────────────────

  const NONE = language === 'vi' ? 'Không có' : 'None';
  const options: string[] = currentQuestion?.options ?? [];

  const progress = Math.min((questionCount - 1) / 10, 0.9);

  if (saving) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>{t('saving')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Language toggle */}
        <View style={styles.languageToggle}>
          {(['vi', 'en'] as const).map(lang => (
            <Pressable
              key={lang}
              onPress={() => setLanguage(lang)}
              style={[styles.langBtn, language === lang && styles.langBtnActive]}
            >
              <Text style={[styles.langBtnText, language === lang && styles.langBtnTextActive]}>
                {lang.toUpperCase()}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Progress */}
        <View style={styles.progressWrap}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {fetching ? t('thinking') : t('questionLabel', { n: questionCount })}
          </Text>
        </View>

        <Text style={styles.header}>{t('title')}</Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>

        {/* Question card */}
        <View style={styles.card}>
          {fetching ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>{t('thinking')}</Text>
            </View>
          ) : currentQuestion ? (
            <>
              <Text style={styles.question}>{currentQuestion.question}</Text>

              {/* Single / Multi options */}
              {(currentQuestion.type === 'single' || currentQuestion.type === 'multi') && (
                <View style={styles.options}>
                  {options.map(opt => {
                    const active = selected.includes(opt);
                    return (
                      <Pressable
                        key={opt}
                        onPress={() =>
                          currentQuestion.type === 'multi'
                            ? toggleOption(opt, NONE)
                            : setSelected([opt])
                        }
                        android_ripple={{ color: colors.primary + '22' }}
                        style={({ pressed }) => [
                          styles.optionCard,
                          active && styles.optionCardActive,
                          pressed && styles.optionCardPressed,
                        ]}
                      >
                        <Text style={[styles.optionText, active && styles.optionTextActive]}>
                          {opt}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Free-form input — show directly when allow_other */}
              {(currentQuestion.type === 'single' || currentQuestion.type === 'multi') &&
                currentQuestion.allow_other && (
                  <RNTextInput
                    style={styles.textInput}
                    placeholder={t('otherPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={otherText}
                    onChangeText={setOtherText}
                    returnKeyType="done"
                  />
                )}

              {/* Free text input */}
              {currentQuestion.type === 'text' && (
                <RNTextInput
                  style={styles.textInput}
                  placeholder={t('typePlaceholder')}
                  placeholderTextColor={colors.textSecondary}
                  value={freeText}
                  onChangeText={setFreeText}
                  multiline
                  returnKeyType="done"
                />
              )}
            </>
          ) : null}
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label={tc('back')}
          variant="ghost"
          onPress={handleBack}
          disabled={fetching || saving || history.length === 0}
        />
        <Button
          label={tc('continue')}
          onPress={handleNext}
          disabled={fetching || saving || !isValid}
        />
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.md,
      backgroundColor: colors.background,
    },
    scroll: {
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.xl,
      gap: spacing.lg,
    },
    languageToggle: {
      flexDirection: 'row',
      alignSelf: 'flex-end',
      gap: spacing.xs,
    },
    langBtn: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    langBtnActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    langBtnText: {
      fontSize: typography.size.sm,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    langBtnTextActive: {
      color: '#fff',
    },
    progressWrap: {
      gap: spacing.xs,
    },
    progressTrack: {
      height: 6,
      borderRadius: radius.md,
      backgroundColor: colors.surfaceMuted,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressFill: {
      height: '100%',
      backgroundColor: colors.primary,
    },
    progressText: {
      fontSize: typography.size.sm,
      color: colors.textSecondary,
    },
    header: {
      fontSize: typography.size.xl,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
    },
    card: {
      backgroundColor: colors.surface,
      padding: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
      minHeight: 120,
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
    },
    loadingText: {
      color: colors.textSecondary,
      fontSize: typography.size.sm,
    },
    question: {
      fontSize: typography.size.lg,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    options: {
      gap: spacing.sm,
    },
    optionCard: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    optionCardActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '14',
    },
    optionCardPressed: {
      opacity: 0.85,
    },
    optionText: {
      color: colors.textPrimary,
      fontSize: typography.size.md,
      fontWeight: '600',
    },
    optionTextActive: {
      color: colors.primary,
    },
    textInput: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: typography.size.md,
      color: colors.textPrimary,
      backgroundColor: colors.surfaceMuted,
      minHeight: 48,
    },
    footer: {
      flexDirection: 'row',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      gap: spacing.md,
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
  });
}
