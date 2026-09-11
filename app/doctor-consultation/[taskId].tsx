import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
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
  Linking,
  Image,
} from "react-native";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { apiClient } from "../../src/lib/apiClient";
import { env } from "../../src/lib/env";
import { profileApi } from "../../src/features/profile/profile.api";
import { showToast } from "../../src/stores/toast.store";
import { radius, spacing } from "../../src/styles";

type TaskMessage = {
  id: string;
  sender_type: "patient" | "doctor";
  message_type: "question" | "consultation" | "reply" | "follow_up";
  content: string;
  created_at: string;
};

type Attachment = {
  name: string;
  mime_type: string;
  size_bytes: number;
  url: string;
};
const parseAttachment = (content: string): Attachment | null => {
  if (!content.startsWith("[ASINU_ATTACHMENT]")) return null;
  try {
    return JSON.parse(content.slice("[ASINU_ATTACHMENT]".length)) as Attachment;
  } catch {
    return null;
  }
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

const DOCTOR_AVATAR_URI =
  "https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80";

const createClientMessageId = () => {
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
};

const formatMessageTime = (dateString?: string) => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    const hours = date.getHours().toString().padStart(2, "0");
    const minutes = date.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  } catch {
    return "";
  }
};

const formatHeaderDate = (dateString?: string, todayLabel = "Hôm nay") => {
  const date = dateString ? new Date(dateString) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;
  const day = validDate.getDate();
  const month = validDate.getMonth() + 1;
  const year = validDate.getFullYear();
  return `${todayLabel}, ${day} thg ${month}, ${year}`;
};

export default function DoctorConsultationThreadScreen() {
  const { t, i18n } = useTranslation("home");
  const router = useRouter();
  const { taskId: rawTaskId, tenantId: rawTenantId } =
    useLocalSearchParams<{ taskId: string; tenantId?: string }>();
  const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
  const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
  const activeTenantId = tenantId || env.doctorTenantId;
  const { colors, isDark } = useThemeColors();
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
        )}/messages?tenant_id=${encodeURIComponent(activeTenantId)}`
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
  }, [taskId, activeTenantId]);

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
            tenant_id: activeTenantId,
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

  const handlePickImage = async () => {
    try {
      const ImagePicker = await import("expo-image-picker");
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast(
          i18n.language === "vi"
            ? "Vui lòng cấp quyền truy cập thư viện ảnh"
            : "Please grant photo library access",
          "error"
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const formData = new FormData();
        formData.append("file", {
          uri: asset.uri,
          name: asset.fileName || `doctor-consultation-${Date.now()}.jpg`,
          type: asset.mimeType || "image/jpeg",
        } as any);
        setSending(true);
        await apiClient(
          `/api/doctor/tasks/${encodeURIComponent(
            taskId
          )}/attachments?tenant_id=${encodeURIComponent(activeTenantId)}`,
          {
            method: "POST",
            body: formData,
            headers: { "X-Client-Message-Id": createClientMessageId() },
          }
        );
        await loadThread();
        showToast(
          i18n.language === "vi"
            ? "Đã gửi ảnh cho bác sĩ"
            : "Image sent to your doctor",
          "success"
        );
      }
    } catch {
      showToast(
        i18n.language === "vi"
          ? "Không thể gửi ảnh. Vui lòng thử lại."
          : "Could not send image. Please try again.",
        "error"
      );
    } finally {
      setSending(false);
    }
  };

  const handleSendMedicalRecord = async () => {
    if (!taskId || sending) return;
    setSending(true);
    try {
      // Send a snapshot as a normal patient message so it is persisted in the
      // canonical thread and is visible in Doctor Console immediately.
      // The Doctor Console also loads the full read-only profile separately.
      const patientProfile = await profileApi.fetchProfile();
      const isVietnamese = i18n.language === "vi";
      const list = (items?: string[]) =>
        items?.filter(Boolean).join(", ") ||
        (isVietnamese ? "Chưa ghi nhận" : "Not recorded");
      const lines = isVietnamese
        ? [
            "[MEDICAL_RECORD_SUMMARY]",
            `Họ tên: ${patientProfile.name || "Chưa cập nhật"}`,
            `Tuổi: ${patientProfile.age ?? "Chưa cập nhật"}`,
            `Giới tính: ${patientProfile.gender || "Chưa cập nhật"}`,
            `Chiều cao: ${patientProfile.heightCm ?? "Chưa cập nhật"} cm`,
            `Cân nặng: ${patientProfile.weightKg ?? "Chưa cập nhật"} kg`,
            `Nhóm máu: ${patientProfile.bloodType || "Chưa cập nhật"}`,
            `Bệnh nền/triệu chứng mạn: ${list(patientProfile.chronicDiseases)}`,
            "Lưu ý: Đây là thông tin bệnh nhân đã khai báo, cần được bác sĩ xác nhận.",
          ]
        : [
            "[MEDICAL_RECORD_SUMMARY]",
            `Name: ${patientProfile.name || "Not provided"}`,
            `Age: ${patientProfile.age ?? "Not provided"}`,
            `Gender: ${patientProfile.gender || "Not provided"}`,
            `Height: ${patientProfile.heightCm ?? "Not provided"} cm`,
            `Weight: ${patientProfile.weightKg ?? "Not provided"} kg`,
            `Blood type: ${patientProfile.bloodType || "Not provided"}`,
            `Chronic conditions/symptoms: ${list(
              patientProfile.chronicDiseases
            )}`,
            "Note: This information was self-reported by the patient and should be verified by the doctor.",
          ];

      await apiClient(
        `/api/doctor/tasks/${encodeURIComponent(taskId)}/messages`,
        {
          method: "POST",
          body: {
            tenant_id: activeTenantId,
            content: lines.join("\n"),
            message_type: "follow_up",
            client_message_id: createClientMessageId(),
          },
        }
      );
      await loadThread();
      showToast(t("doctorConsultationMedicalRecordSent"), "success");
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
            tenant_id: activeTenantId,
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

  const firstMessageDate = messages[0]?.created_at;
  const dateHeader = formatHeaderDate(
    firstMessageDate,
    t("doctorConsultationToday")
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[
        styles.screen,
        { backgroundColor: isDark ? colors.background : "#F7F9FB" },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Top Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: colors.surface,
            borderBottomColor: isDark ? colors.border : "#EEF2F6",
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[
            styles.backCircle,
            { backgroundColor: isDark ? colors.surfaceMuted : "#E8F5F3" },
          ]}
        >
          <Ionicons name="arrow-back" size={20} color="#00A88F" />
        </Pressable>

        <View style={styles.headerInfo}>
          <Text
            style={[styles.headerTitle, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {t("doctorConsultationConversation")}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.headerTaskId,
              { color: isDark ? colors.textSecondary : "#9AA6B2" },
            ]}
          >
            {taskId}
          </Text>
        </View>

        <View style={styles.doctorHeaderStatus}>
          <View style={styles.headerAvatarWrapper}>
            <Image
              source={{ uri: DOCTOR_AVATAR_URI }}
              style={styles.headerAvatar}
            />
            <View style={styles.onlineBadgeDot} />
          </View>
          <View
            style={[
              styles.onlinePill,
              {
                backgroundColor: isDark ? "rgba(16, 185, 129, 0.2)" : "#EDFDF8",
              },
            ]}
          >
            <View style={styles.onlinePillDot} />
            <Text style={styles.onlinePillText}>
              {t("doctorConsultationOnline")}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#00A88F" />
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messagesScroll}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: false })
          }
        >
          {/* Centered Date Pill */}
          <View style={styles.datePillContainer}>
            <View
              style={[
                styles.datePill,
                {
                  backgroundColor: isDark ? colors.surface : "#E8EFF5",
                },
              ]}
            >
              <Text
                style={[
                  styles.datePillText,
                  { color: isDark ? colors.textSecondary : "#718292" },
                ]}
              >
                {dateHeader}
              </Text>
            </View>
          </View>

          {/* Initial Request Bubble (Patient sent) */}
          {summary && (
            <View style={[styles.bubbleWrapper, styles.patientWrapper]}>
              <View
                style={[
                  styles.patientCard,
                  {
                    backgroundColor: isDark
                      ? "rgba(224, 248, 244, 0.15)"
                      : "#E7F8F4",
                    borderColor: isDark ? colors.border : "#CEEFE8",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.initialRequestTag,
                    { color: isDark ? "#48CBB5" : "#00A88F" },
                  ]}
                >
                  {t("doctorConsultationInitialRequest")}
                </Text>
                <Text
                  style={[
                    styles.initialRequestContent,
                    { color: colors.textPrimary },
                  ]}
                >
                  {summary}
                </Text>
                <View style={styles.messageFooterRight}>
                  <Text
                    style={[
                      styles.timestampText,
                      { color: isDark ? colors.textSecondary : "#8E9EAC" },
                    ]}
                  >
                    {formatMessageTime(messages[0]?.created_at)}
                  </Text>
                  <Ionicons
                    name="checkmark-done"
                    size={15}
                    color="#00A88F"
                    style={styles.checkIcon}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Chat Messages */}
          {messages.map((message, index) => {
            const fromPatient = message.sender_type === "patient";
            const attachment = parseAttachment(message.content);
            const joinUrl =
              message.content.match(/https:\/\/[^\s]+/)?.[0] ?? null;
            const timeStr = formatMessageTime(message.created_at);

            if (fromPatient) {
              return (
                <View
                  key={message.id || index}
                  style={[styles.bubbleWrapper, styles.patientWrapper]}
                >
                  <View
                    style={[
                      styles.patientBubble,
                      {
                        backgroundColor: isDark
                          ? "rgba(224, 248, 244, 0.15)"
                          : "#E7F8F4",
                        borderColor: isDark ? colors.border : "#CEEFE8",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageBodyText,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {attachment ? (
                        <Pressable
                          onPress={() => void Linking.openURL(attachment.url)}
                        >
                          <Image
                            source={{ uri: attachment.url }}
                            style={styles.messageAttachment}
                          />
                          <Text
                            style={[
                              styles.attachmentName,
                              { color: colors.textSecondary },
                            ]}
                          >
                            {attachment.name}
                          </Text>
                        </Pressable>
                      ) : (
                        message.content
                      )}
                    </Text>
                    <View style={styles.messageFooterRight}>
                      {timeStr ? (
                        <Text
                          style={[
                            styles.timestampText,
                            {
                              color: isDark ? colors.textSecondary : "#8E9EAC",
                            },
                          ]}
                        >
                          {timeStr}
                        </Text>
                      ) : null}
                      <Ionicons
                        name="checkmark-done"
                        size={15}
                        color="#00A88F"
                        style={styles.checkIcon}
                      />
                    </View>
                  </View>
                </View>
              );
            }

            // Doctor message with avatar on the left
            return (
              <View
                key={message.id || index}
                style={[styles.bubbleWrapper, styles.doctorWrapper]}
              >
                <View style={styles.doctorAvatarCol}>
                  <Image
                    source={{ uri: DOCTOR_AVATAR_URI }}
                    style={styles.doctorMsgAvatar}
                  />
                </View>
                <View
                  style={[
                    styles.doctorBubble,
                    {
                      backgroundColor: isDark ? colors.surface : "#FFFFFF",
                      borderColor: isDark ? colors.border : "#EAEAEA",
                    },
                  ]}
                >
                  {/* Doctor Name label */}
                  {index === 0 ||
                  messages[index - 1]?.sender_type === "patient" ? (
                    <Text
                      style={[
                        styles.doctorHeaderName,
                        { color: isDark ? "#48CBB5" : "#008B76" },
                      ]}
                    >
                      {t("doctorConsultationDoctor")}
                    </Text>
                  ) : null}

                  <Text
                    style={[
                      styles.messageBodyText,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {attachment ? (
                      <Pressable
                        onPress={() => void Linking.openURL(attachment.url)}
                      >
                        <Image
                          source={{ uri: attachment.url }}
                          style={styles.messageAttachment}
                        />
                        <Text
                          style={[
                            styles.attachmentName,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {attachment.name}
                        </Text>
                      </Pressable>
                    ) : (
                      message.content
                    )}
                  </Text>

                  {joinUrl ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => void Linking.openURL(joinUrl)}
                      style={[
                        styles.videoLink,
                        {
                          borderColor: "#00A88F",
                          backgroundColor: isDark
                            ? "rgba(0,168,143,0.12)"
                            : "#F0FAF8",
                        },
                      ]}
                    >
                      <Ionicons
                        name="videocam-outline"
                        size={18}
                        color="#00A88F"
                      />
                      <Text
                        style={[styles.videoLinkText, { color: "#00A88F" }]}
                      >
                        {t("doctorConsultationJoinVideo")}
                      </Text>
                    </Pressable>
                  ) : null}

                  {timeStr ? (
                    <View style={styles.messageFooterLeft}>
                      <Text
                        style={[
                          styles.timestampText,
                          {
                            color: isDark ? colors.textSecondary : "#8E9EAC",
                          },
                        ]}
                      >
                        {timeStr}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}

          {/* Rating Section if available */}
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
                        backgroundColor: "#00A88F",
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

      {/* Floating Action: Gửi hồ sơ y tế */}
      <View style={styles.floatingActionContainer} pointerEvents="box-none">
        <Pressable
          disabled={sending}
          onPress={() => void handleSendMedicalRecord()}
          style={[
            styles.floatingActionButton,
            {
              backgroundColor: isDark ? colors.surface : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
        >
          <View style={styles.floatingActionIconBox}>
            <MaterialCommunityIcons
              name="paperclip"
              size={24}
              color="#008B76"
            />
            <View style={styles.floatingActionPlus}>
              <Ionicons name="add-circle" size={14} color="#00A88F" />
            </View>
          </View>
        </Pressable>
        <Text
          style={[
            styles.floatingActionLabel,
            { color: isDark ? colors.textSecondary : "#6B7A88" },
          ]}
        >
          {t("doctorConsultationSendMedicalRecord")}
        </Text>
      </View>

      {/* Composer Toolbar */}
      <View
        style={[
          styles.composerWrapper,
          {
            backgroundColor: isDark ? colors.surface : "#FFFFFF",
            borderTopColor: isDark ? colors.border : "#F0F4F7",
          },
        ]}
      >
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: isDark ? colors.background : "#F5F8FA",
              borderColor: isDark ? colors.border : "transparent",
            },
          ]}
        >
          <Pressable
            onPress={() => void handlePickImage()}
            style={styles.imagePickerBtn}
            hitSlop={8}
            accessibilityLabel={t("doctorConsultationAttachPhoto")}
          >
            <Ionicons
              name="image-outline"
              size={22}
              color={isDark ? colors.textSecondary : "#6F7F8E"}
            />
          </Pressable>

          <TextInput
            multiline
            maxLength={5000}
            onChangeText={setDraft}
            placeholder={t("doctorConsultationReplyPlaceholder")}
            placeholderTextColor={isDark ? colors.textSecondary : "#8E9EAC"}
            style={[
              styles.textInput,
              {
                color: colors.textPrimary,
              },
            ]}
            value={draft}
          />
        </View>

        <Pressable
          disabled={!draft.trim() || sending}
          onPress={() => void send()}
          style={[
            styles.sendCircleButton,
            {
              opacity: !draft.trim() || sending ? 0.45 : 1,
            },
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Ionicons
              name="paper-plane"
              size={18}
              color="#fff"
              style={{ marginLeft: 2 }}
            />
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
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === "ios" ? 54 : spacing.xl,
    paddingBottom: spacing.sm + 4,
    gap: spacing.sm,
  },
  backCircle: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerTaskId: {
    fontSize: 11,
    marginTop: 2,
  },
  doctorHeaderStatus: {
    alignItems: "center",
  },
  headerAvatarWrapper: {
    position: "relative",
  },
  headerAvatar: {
    borderColor: "#E5F7F4",
    borderRadius: 20,
    borderWidth: 1.5,
    height: 40,
    width: 40,
  },
  onlineBadgeDot: {
    backgroundColor: "#10B981",
    borderColor: "#FFFFFF",
    borderRadius: 5,
    borderWidth: 1.5,
    bottom: 0,
    height: 10,
    position: "absolute",
    right: 0,
    width: 10,
  },
  onlinePill: {
    alignItems: "center",
    borderRadius: 10,
    flexDirection: "row",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  onlinePillDot: {
    backgroundColor: "#10B981",
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  onlinePillText: {
    color: "#059669",
    fontSize: 10,
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  messagesScroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 72,
  },
  datePillContainer: {
    alignItems: "center",
    marginBottom: spacing.md,
  },
  datePill: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  bubbleWrapper: {
    marginBottom: spacing.md,
    width: "100%",
  },
  patientWrapper: {
    alignItems: "flex-end",
  },
  doctorWrapper: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.xs + 2,
  },
  doctorAvatarCol: {
    paddingTop: 2,
  },
  doctorMsgAvatar: {
    borderRadius: 18,
    height: 36,
    width: 36,
  },
  patientCard: {
    borderRadius: 20,
    borderWidth: 0.5,
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  initialRequestTag: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 4,
  },
  initialRequestContent: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
  },
  patientBubble: {
    borderRadius: 20,
    borderWidth: 0.5,
    maxWidth: "80%",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  doctorBubble: {
    borderRadius: 20,
    borderWidth: 0.5,
    flex: 1,
    maxWidth: "85%",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  doctorHeaderName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  messageBodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageAttachment: {
    borderRadius: 12,
    height: 180,
    marginBottom: 6,
    width: 220,
  },
  attachmentName: {
    fontSize: 12,
  },
  messageFooterRight: {
    alignItems: "center",
    alignSelf: "flex-end",
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },
  messageFooterLeft: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },
  timestampText: {
    fontSize: 11,
    fontWeight: "500",
  },
  checkIcon: {
    marginLeft: 2,
  },
  videoLink: {
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  videoLinkText: {
    fontSize: 14,
    fontWeight: "700",
  },
  floatingActionContainer: {
    alignItems: "center",
    bottom: 80,
    position: "absolute",
    right: 18,
    zIndex: 10,
  },
  floatingActionButton: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 0.5,
    elevation: 4,
    height: 56,
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    width: 56,
  },
  floatingActionIconBox: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  floatingActionPlus: {
    bottom: -3,
    position: "absolute",
    right: -5,
  },
  floatingActionLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  composerWrapper: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? 28 : spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  inputContainer: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    minHeight: 48,
    paddingHorizontal: 12,
  },
  imagePickerBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingRight: 6,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  sendCircleButton: {
    alignItems: "center",
    backgroundColor: "#00A88F",
    borderRadius: 24,
    elevation: 2,
    height: 48,
    justifyContent: "center",
    shadowColor: "#00A88F",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
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
