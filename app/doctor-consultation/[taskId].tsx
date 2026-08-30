import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { apiClient } from "../../src/lib/apiClient";
import { env } from "../../src/lib/env";
import { showToast } from "../../src/stores/toast.store";
import { radius, spacing } from "../../src/styles";

type TaskMessage = {
  id: string;
  sender_type: "patient" | "doctor";
  message_type: "question" | "consultation" | "reply" | "follow_up";
  content: string;
  created_at: string;
};

type ThreadResponse = {
  ok: boolean;
  data?: {
    task_id: string;
    summary: string | null;
    messages: TaskMessage[];
    task_status?: { status: string; rateable: boolean } | null;
  };
};

const createClientMessageId = () => {
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

export default function DoctorConsultationThreadScreen() {
  const { t } = useTranslation("home");
  const router = useRouter();
  const { taskId: rawTaskId } = useLocalSearchParams<{ taskId: string }>();
  const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
  const { colors } = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [rateable, setRateable] = useState(false);

  const loadThread = async (showLoading = false) => {
    if (!taskId) return;
    if (showLoading) setLoading(true);
    try {
      const response = await apiClient<ThreadResponse>(
        `/api/doctor/tasks/${encodeURIComponent(
          taskId
        )}/messages?tenant_id=${encodeURIComponent(env.doctorTenantId)}`
      );
      setSummary(response.data?.summary ?? null);
      setMessages(response.data?.messages ?? []);
      setRateable(response.data?.task_status?.rateable === true);
    } catch {
      if (showLoading) showToast(t("doctorConsultationThreadError"), "error");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void loadThread(true);
    const timer = setInterval(() => void loadThread(), 5000);
    return () => clearInterval(timer);
  }, [taskId]);

  useEffect(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true })
    );
  }, [messages.length]);

  const send = async () => {
    const content = draft.trim();
    if (!taskId || !content || sending) return;
    setSending(true);
    try {
      await apiClient(
        `/api/doctor/tasks/${encodeURIComponent(taskId)}/messages`,
        {
          method: "POST",
          body: {
            tenant_id: env.doctorTenantId,
            content,
            message_type: "reply",
            client_message_id: createClientMessageId(),
          },
        }
      );
      setDraft("");
      await loadThread();
    } catch {
      showToast(t("doctorConsultationMessageError"), "error");
    } finally {
      setSending(false);
    }
  };

  const submitRating = async () => {
    if (!taskId || rating < 1 || ratingSubmitting) return;
    setRatingSubmitting(true);
    try {
      await apiClient(
        `/api/doctor/tasks/${encodeURIComponent(taskId)}/rating`,
        {
          method: "POST",
          body: {
            tenant_id: env.doctorTenantId,
            score: rating,
            ...(ratingComment.trim() ? { comment: ratingComment.trim() } : {}),
            request_id: createClientMessageId(),
          },
        }
      );
      setRatingSubmitted(true);
      showToast(t("doctorConsultationRatingSuccess"), "success");
    } catch {
      showToast(t("doctorConsultationRatingNotReady"), "error");
    } finally {
      setRatingSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={[
          styles.header,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>
            {t("doctorConsultationConversation")}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.taskCode, { color: colors.textSecondary }]}
          >
            {taskId}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {summary && (
            <View
              style={[
                styles.bubble,
                styles.patientBubble,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sender, { color: colors.textSecondary }]}>
                {t("doctorConsultationInitialRequest")}
              </Text>
              <Text style={[styles.messageText, { color: colors.textPrimary }]}>
                {summary}
              </Text>
            </View>
          )}
          {messages.map((message) => {
            const fromPatient = message.sender_type === "patient";
            return (
              <View
                key={message.id}
                style={[
                  styles.bubble,
                  fromPatient ? styles.patientBubble : styles.doctorBubble,
                  {
                    backgroundColor: fromPatient
                      ? colors.surface
                      : colors.primary + "18",
                    borderColor: fromPatient
                      ? colors.border
                      : colors.primary + "55",
                  },
                ]}
              >
                <Text style={[styles.sender, { color: colors.textSecondary }]}>
                  {fromPatient
                    ? t("doctorConsultationYou")
                    : t("doctorConsultationDoctor")}
                </Text>
                <Text
                  style={[styles.messageText, { color: colors.textPrimary }]}
                >
                  {message.content}
                </Text>
              </View>
            );
          })}
          {rateable && (
            <View
              style={[
                styles.ratingCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.ratingTitle, { color: colors.textPrimary }]}>
                {t("doctorConsultationRateDoctor")}
              </Text>
              <Text
                style={[styles.ratingHint, { color: colors.textSecondary }]}
              >
                {t("doctorConsultationRatingHint")}
              </Text>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((score) => (
                  <Pressable
                    key={score}
                    disabled={ratingSubmitted}
                    onPress={() => setRating(score)}
                    hitSlop={6}
                  >
                    <Ionicons
                      name={score <= rating ? "star" : "star-outline"}
                      size={30}
                      color="#f59e0b"
                    />
                  </Pressable>
                ))}
              </View>
              {!ratingSubmitted && (
                <>
                  <TextInput
                    maxLength={1000}
                    onChangeText={setRatingComment}
                    placeholder={t("doctorConsultationRatingPlaceholder")}
                    placeholderTextColor={colors.textSecondary}
                    style={[
                      styles.ratingInput,
                      {
                        color: colors.textPrimary,
                        backgroundColor: colors.background,
                        borderColor: colors.border,
                      },
                    ]}
                    value={ratingComment}
                  />
                  <Pressable
                    disabled={rating < 1 || ratingSubmitting}
                    onPress={() => void submitRating()}
                    style={[
                      styles.ratingButton,
                      {
                        backgroundColor: colors.primary,
                        opacity: rating < 1 || ratingSubmitting ? 0.55 : 1,
                      },
                    ]}
                  >
                    {ratingSubmitting ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.ratingButtonText}>
                        {t("doctorConsultationSubmitRating")}
                      </Text>
                    )}
                  </Pressable>
                </>
              )}
            </View>
          )}
        </ScrollView>
      )}

      <View
        style={[
          styles.composer,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <TextInput
          multiline
          maxLength={5000}
          onChangeText={setDraft}
          placeholder={t("doctorConsultationReplyPlaceholder")}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.input,
            {
              color: colors.textPrimary,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
          value={draft}
        />
        <Pressable
          disabled={!draft.trim() || sending}
          onPress={() => void send()}
          style={[
            styles.sendButton,
            {
              backgroundColor: colors.primary,
              opacity: !draft.trim() || sending ? 0.55 : 1,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="send" size={20} color="#fff" />
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    alignItems: "center",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  backButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 19, fontWeight: "800" },
  taskCode: { fontSize: 12, marginTop: 2 },
  center: { alignItems: "center", flex: 1, justifyContent: "center" },
  messages: { flexGrow: 1, gap: spacing.sm, padding: spacing.md },
  bubble: {
    borderRadius: radius.lg,
    borderWidth: 1,
    maxWidth: "86%",
    padding: spacing.md,
  },
  patientBubble: { alignSelf: "flex-end" },
  doctorBubble: { alignSelf: "flex-start" },
  sender: { fontSize: 12, fontWeight: "700", marginBottom: spacing.xs },
  messageText: { fontSize: 15, lineHeight: 22 },
  composer: {
    alignItems: "flex-end",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    fontSize: 15,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  sendButton: {
    alignItems: "center",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  ratingCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  ratingTitle: { fontSize: 16, fontWeight: "800" },
  ratingHint: { fontSize: 13, lineHeight: 19 },
  stars: { flexDirection: "row", gap: spacing.sm },
  ratingInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  ratingButton: {
    alignItems: "center",
    borderRadius: radius.md,
    justifyContent: "center",
    minHeight: 46,
  },
  ratingButtonText: { color: "#fff", fontSize: 15, fontWeight: "800" },
});
