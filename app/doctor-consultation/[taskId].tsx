import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Linking,
  Image,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { ScaledTextInput as TextInput } from "../../src/components/ScaledTextInput";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useGuardedRouter as useRouter } from "../../src/hooks/useGuardedRouter";
import { apiClient, getApiErrorMessage } from "../../src/lib/apiClient";
import { env } from "../../src/lib/env";
import { tokenStore } from "../../src/lib/tokenStore";
import { showToast } from "../../src/stores/toast.store";
import { radius, spacing } from "../../src/styles";

type TaskMessage = {
  id: string;
  sender_type: "patient" | "doctor";
  message_type: "question" | "consultation" | "reply" | "follow_up" | "voice";
  content: string | null;
  created_at: string;
  delivered_at?: string;
  read_at?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  is_deleted?: boolean;
  is_deleted_for_me?: boolean;
  is_edited?: boolean;
  is_pinned?: boolean;
  delivery_status?: "sent" | "seen";
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

type VoiceMessage = {
  name?: string;
  mime_type?: string;
  size_bytes?: number;
  duration_ms?: number;
  url: string;
};

const parseVoice = (content: string | null): VoiceMessage | null => {
  if (!content || !content.startsWith("[ASINU_VOICE]")) return null;
  try {
    return JSON.parse(content.slice("[ASINU_VOICE]".length)) as VoiceMessage;
  } catch {
    return null;
  }
};

let _Audio: typeof import("expo-av").Audio | null = null;
const getAudio = async () => {
  if (!_Audio) _Audio = (await import("expo-av")).Audio;
  return _Audio;
};

type ThreadResponse = {
  ok: boolean;
  data?: {
    task_id: string;
    summary: string | null;
    messages: TaskMessage[];
    typing?: {
      actor_type: string | null;
      expires_at: string | null;
      is_typing: boolean;
    };
    task_status?: {
      status: string;
      rateable: boolean;
      consultation_summary?: ConsultationSummary | null;
      follow_up_until?: string | null;
      follow_up_open?: boolean;
    } | null;
  };
};

type ConsultationSummary = {
  problem_summary: string;
  assessment: string;
  next_steps: string;
  warning_signs: string;
  follow_up_recommendation: string;
};

type TaskStatusResponse = NonNullable<
  NonNullable<ThreadResponse["data"]>["task_status"]
>;

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

const formatHeaderDate = (
  dateString?: string,
  todayLabel = "Hôm nay",
  locale = "vi-VN",
) => {
  const date = dateString ? new Date(dateString) : new Date();
  const validDate = isNaN(date.getTime()) ? new Date() : date;
  const now = new Date();
  if (
    validDate.getFullYear() === now.getFullYear() &&
    validDate.getMonth() === now.getMonth() &&
    validDate.getDate() === now.getDate()
  ) {
    return todayLabel;
  }
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(validDate);
};

function MedicalBackground({ isDark }: { isDark: boolean }) {
  const primaryColor = isDark ? "#14B8A6" : "#2DD4BF";
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Top Left Cross */}
      <View style={{ position: "absolute", top: 130, left: 24 }}>
        <Svg width={30} height={30} viewBox="0 0 24 24">
          <Path
            d="M9 3 C9 2.45 9.45 2 10 2 L14 2 C14.55 2 15 2.45 15 3 L15 9 L21 9 C21.55 9 22 9.45 22 10 L22 14 C22 14.55 21.55 15 21 15 L15 15 L15 21 C15 21.55 14.55 22 14 22 L10 22 C9.45 22 9 21.55 9 21 L9 15 L3 15 C2.45 15 2 14.55 2 14 L2 10 C2 9.45 2.45 9 3 9 L9 9 Z"
            fill={primaryColor}
            opacity={isDark ? 0.08 : 0.16}
          />
        </Svg>
      </View>

      {/* Mid Left Cross */}
      <View style={{ position: "absolute", top: 380, left: 22 }}>
        <Svg width={36} height={36} viewBox="0 0 24 24">
          <Path
            d="M9 3 C9 2.45 9.45 2 10 2 L14 2 C14.55 2 15 2.45 15 3 L15 9 L21 9 C21.55 9 22 9.45 22 10 L22 14 C22 14.55 21.55 15 21 15 L15 15 L15 21 C15 21.55 14.55 22 14 22 L10 22 C9.45 22 9 21.55 9 21 L9 15 L3 15 C2.45 15 2 14.55 2 14 L2 10 C2 9.45 2.45 9 3 9 L9 9 Z"
            fill={primaryColor}
            opacity={isDark ? 0.07 : 0.14}
          />
        </Svg>
      </View>

      {/* Mid Left Heartbeat Pulse Wave */}
      <View style={{ position: "absolute", top: 430, left: -20 }}>
        <Svg width={220} height={100} viewBox="0 0 220 100">
          <Path
            d="M0 50 L60 50 L70 35 L78 70 L88 20 L98 80 L108 42 L116 55 L125 50 L220 50"
            stroke={primaryColor}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity={isDark ? 0.1 : 0.22}
          />
        </Svg>
      </View>

      {/* Bottom Left Dot Grid */}
      <View style={{ position: "absolute", bottom: 120, left: 24 }}>
        <Svg width={70} height={90}>
          {[0, 1, 2, 3, 4].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <Circle
                key={`${r}-${c}`}
                cx={c * 16 + 4}
                cy={r * 16 + 4}
                r={2.5}
                fill={primaryColor}
                opacity={isDark ? 0.1 : 0.22}
              />
            )),
          )}
        </Svg>
      </View>

      {/* Bottom Right Cross */}
      <View style={{ position: "absolute", bottom: 180, right: 28 }}>
        <Svg width={42} height={42} viewBox="0 0 24 24">
          <Path
            d="M9 3 C9 2.45 9.45 2 10 2 L14 2 C14.55 2 15 2.45 15 3 L15 9 L21 9 C21.55 9 22 9.45 22 10 L22 14 C22 14.55 21.55 15 21 15 L15 15 L15 21 C15 21.55 14.55 22 14 22 L10 22 C9.45 22 9 21.55 9 21 L9 15 L3 15 C2.45 15 2 14.55 2 14 L2 10 C2 9.45 2.45 9 3 9 L9 9 Z"
            fill={primaryColor}
            opacity={isDark ? 0.08 : 0.16}
          />
        </Svg>
      </View>
    </View>
  );
}

export default function DoctorConsultationThreadScreen() {
  const { t, i18n } = useTranslation("home");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { taskId: rawTaskId, tenantId: rawTenantId } = useLocalSearchParams<{
    taskId: string;
    tenantId?: string;
  }>();
  const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
  const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
  const activeTenantId = tenantId || env.doctorTenantId;
  const { colors, isDark } = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [doctorTyping, setDoctorTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [recording, setRecording] = useState(false);
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const recordingRef = useRef<any>(null);
  const recordingStartedAtRef = useRef(0);
  const soundRef = useRef<any>(null);
  const [rating, setRating] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [rateable, setRateable] = useState(false);
  const [taskStatus, setTaskStatus] = useState<TaskStatusResponse | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadThread = async (showLoading = false) => {
    if (!taskId) return;
    if (showLoading) setLoading(true);
    try {
      const response = await apiClient<ThreadResponse>(
        `/api/doctor/tasks/${encodeURIComponent(
          taskId,
        )}/messages?tenant_id=${encodeURIComponent(activeTenantId)}`,
      );
      setSummary(response.data?.summary ?? null);
      setMessages(response.data?.messages ?? []);
      setDoctorTyping(response.data?.typing?.is_typing === true);
      const unreadDoctorMessages = (response.data?.messages ?? [])
        .filter(
          (message) => message.sender_type === "doctor" && !message.read_at,
        )
        .map((message) => message.id);
      if (unreadDoctorMessages.length) {
        void apiClient(
          `/api/doctor/tasks/${encodeURIComponent(taskId)}/messages/action`,
          {
            method: "POST",
            body: {
              tenant_id: activeTenantId,
              action: "read",
              message_ids: unreadDoctorMessages,
            },
          },
        ).catch(() => undefined);
      }
      setRateable(response.data?.task_status?.rateable === true);
      setTaskStatus(response.data?.task_status ?? null);
    } catch {
      if (showLoading) showToast(t("doctorConsultationThreadError"), "error");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    let disposed = false;
    let connected = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    const fallbackTimer = setInterval(() => {
      if (!connected) void loadThread();
    }, 5000);

    const connect = async () => {
      const token = await tokenStore.loadToken();
      if (disposed || !taskId || !token) return;
      try {
        const baseUrl = env.apiBaseUrl
          .replace(/^http/i, "ws")
          .replace(/\/$/, "");
        const url = `${baseUrl}/api/doctor/chat/ws?tenant_id=${encodeURIComponent(
          activeTenantId,
        )}&task_id=${encodeURIComponent(taskId)}`;
        socket = new WebSocket(url, ["asinu-chat", token]);
        socket.onopen = () => {
          connected = true;
          setRealtimeConnected(true);
        };
        socket.onmessage = (event) => {
          try {
            const envelope = JSON.parse(String(event.data)) as {
              type?: string;
              data?: {
                actor_type?: string | null;
                is_typing?: boolean;
              };
            };
            if (envelope.type === "chat.message.changed") {
              void loadThread();
            } else if (envelope.type === "chat.typing.changed") {
              setDoctorTyping(
                envelope.data?.actor_type === "doctor" &&
                  envelope.data?.is_typing === true,
              );
            }
          } catch {
            // The REST refresh below remains the safe source of truth.
          }
        };
        socket.onerror = () => {
          connected = false;
          setRealtimeConnected(false);
        };
        socket.onclose = () => {
          connected = false;
          setRealtimeConnected(false);
          if (!disposed) {
            reconnectTimer = setTimeout(() => void connect(), 5000);
          }
        };
      } catch {
        connected = false;
        setRealtimeConnected(false);
        if (!disposed) reconnectTimer = setTimeout(() => void connect(), 5000);
      }
    };

    void loadThread(true);
    void connect();
    return () => {
      disposed = true;
      connected = false;
      setRealtimeConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      clearInterval(fallbackTimer);
      socket?.close();
    };
  }, [taskId, activeTenantId]);

  useEffect(
    () => () => {
      void soundRef.current?.unloadAsync?.();
      void recordingRef.current?.stopAndUnloadAsync?.();
    },
    [],
  );

  useEffect(() => {
    requestAnimationFrame(() =>
      scrollRef.current?.scrollToEnd({ animated: true }),
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
            message_type:
              taskStatus?.status === "completed" ? "follow_up" : "reply",
            client_message_id: createClientMessageId(),
          },
        },
      );
      setDraft("");
      await loadThread();
    } catch {
      showToast(t("doctorConsultationMessageError"), "error");
    } finally {
      setSending(false);
    }
  };

  const runMessageAction = async (
    messageId: string,
    action: "edit" | "unsend" | "delete_for_me" | "pin" | "unpin",
    content?: string,
  ) => {
    if (!taskId) return;
    try {
      await apiClient(
        `/api/doctor/tasks/${encodeURIComponent(taskId)}/messages/action`,
        {
          method: "POST",
          body: {
            tenant_id: activeTenantId,
            action,
            message_id: messageId,
            ...(content ? { content } : {}),
          },
        },
      );
      setEditingMessageId(null);
      setEditingDraft("");
      await loadThread();
    } catch {
      showToast(t("doctorConsultationMessageError"), "error");
    }
  };

  const showMessageActions = (message: TaskMessage) => {
    if (message.is_deleted || message.is_deleted_for_me) return;
    const ownMessage = message.sender_type === "patient";
    const content = message.content ?? "";
    const isRichMessage = Boolean(
      parseAttachment(content) || parseVoice(content),
    );
    const buttons: Array<{
      text: string;
      style?: "cancel" | "destructive";
      onPress?: () => void;
    }> = [];
    if (ownMessage && !isRichMessage) {
      buttons.push({
        text: t("doctorConsultationEditMessage"),
        onPress: () => {
          setEditingMessageId(message.id);
          setEditingDraft(message.content ?? "");
        },
      });
      buttons.push({
        text: t("doctorConsultationUnsendMessage"),
        style: "destructive",
        onPress: () => void runMessageAction(message.id, "unsend"),
      });
    }
    buttons.push({
      text: t("doctorConsultationDeleteForMe"),
      style: "destructive",
      onPress: () => void runMessageAction(message.id, "delete_for_me"),
    });
    buttons.push({
      text: message.is_pinned
        ? t("doctorConsultationUnpinMessage")
        : t("doctorConsultationPinMessage"),
      onPress: () =>
        void runMessageAction(message.id, message.is_pinned ? "unpin" : "pin"),
    });
    buttons.push({ text: t("doctorConsultationCancel"), style: "cancel" });
    Alert.alert(t("doctorConsultationMessageActions"), undefined, buttons);
  };

  const startVoiceRecording = async () => {
    if (recording || sending || !conversationOpen) return;
    try {
      const Audio = await getAudio();
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        showToast(t("doctorConsultationMicrophonePermission"), "error");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const result = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = result.recording;
      recordingStartedAtRef.current = Date.now();
      setRecording(true);
    } catch {
      showToast(t("doctorConsultationVoiceError"), "error");
    }
  };

  const stopVoiceRecording = async () => {
    const activeRecording = recordingRef.current;
    if (!activeRecording || !taskId) return;
    setRecording(false);
    setSending(true);
    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      recordingRef.current = null;
      await (await getAudio()).setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) throw new Error("VOICE_FILE_MISSING");
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: `voice-message-${Date.now()}.m4a`,
        type: "audio/m4a",
      } as any);
      formData.append("tenant_id", activeTenantId);
      formData.append(
        "duration_ms",
        String(Date.now() - recordingStartedAtRef.current),
      );
      await apiClient(`/api/doctor/tasks/${encodeURIComponent(taskId)}/voice`, {
        method: "POST",
        body: formData,
        headers: { "X-Client-Message-Id": createClientMessageId() },
      });
      await loadThread();
    } catch {
      showToast(t("doctorConsultationVoiceError"), "error");
    } finally {
      setSending(false);
    }
  };

  const playVoice = async (messageId: string, url: string) => {
    try {
      if (playingMessageId === messageId) {
        await soundRef.current?.pauseAsync?.();
        setPlayingMessageId(null);
        return;
      }
      await soundRef.current?.unloadAsync?.();
      const Audio = await getAudio();
      const result = await Audio.Sound.createAsync(
        { uri: url },
        { shouldPlay: true },
      );
      soundRef.current = result.sound;
      setPlayingMessageId(messageId);
      result.sound.setOnPlaybackStatusUpdate((status: any) => {
        if (status.didJustFinish) setPlayingMessageId(null);
      });
    } catch {
      showToast(t("doctorConsultationVoiceError"), "error");
    }
  };

  const handlePickImage = async () => {
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast(
          i18n.language === "vi"
            ? "Vui lòng cấp quyền truy cập thư viện ảnh"
            : "Please grant photo library access",
          "error",
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
            taskId,
          )}/attachments?tenant_id=${encodeURIComponent(activeTenantId)}`,
          {
            method: "POST",
            body: formData,
            headers: { "X-Client-Message-Id": createClientMessageId() },
          },
        );
        await loadThread();
        showToast(t("doctorConsultationImageSent"), "success");
      }
    } catch (error) {
      showToast(
        getApiErrorMessage(error, t, "doctorConsultationAttachmentError"),
        "error",
      );
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
        },
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
    t("doctorConsultationToday"),
    i18n.language === "en" ? "en-US" : "vi-VN",
  );
  const terminalStatuses = [
    "cancelled",
    "expired",
    "emergency_referred",
    "forwarded",
  ];
  const conversationOpen =
    !taskStatus ||
    (!terminalStatuses.includes(taskStatus.status) &&
      (taskStatus.status !== "completed" ||
        taskStatus.follow_up_open === true));
  const statusLabel = taskStatus?.status
    ? t(`doctorConsultationStatus_${taskStatus.status}`, {
        defaultValue: t("doctorConsultationStatusUnknown"),
      })
    : t("doctorConsultationWaiting");
  const statusIsTerminal =
    !taskStatus ||
    ["completed", ...terminalStatuses].includes(taskStatus.status);

  useEffect(() => {
    if (!taskId || !conversationOpen) return;
    const isTyping = draft.trim().length > 0;
    const timer = setTimeout(() => {
      void apiClient(
        `/api/doctor/tasks/${encodeURIComponent(taskId)}/messages/action`,
        {
          method: "POST",
          body: {
            tenant_id: activeTenantId,
            action: "typing",
            is_typing: isTyping,
          },
        },
      ).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [activeTenantId, conversationOpen, draft, taskId]);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: isDark ? colors.background : "#F0FAF7" },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Decorative medical background elements */}
      <MedicalBackground isDark={isDark} />

      {/* Floating Top Header Card */}
      <View style={[styles.headerCardWrapper, { paddingTop: insets.top + 6 }]}>
        <View
          style={[
            styles.headerCard,
            {
              backgroundColor: isDark ? colors.surface : "#FFFFFF",
              borderColor: isDark ? colors.border : "#E2EEEC",
            },
          ]}
        >
          <View style={styles.headerMainRow}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={10}
              style={[
                styles.backCircle,
                { backgroundColor: isDark ? colors.surfaceMuted : "#E6F7F5" },
              ]}
            >
              <Ionicons name="arrow-back" size={20} color="#00A88F" />
            </Pressable>

            <View style={styles.headerInfo}>
              <Text
                style={[
                  styles.headerTitle,
                  { color: isDark ? colors.textPrimary : "#0F172A" },
                ]}
                numberOfLines={1}
              >
                {t("doctorConsultationConversation")}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.headerTaskId,
                  { color: isDark ? colors.textSecondary : "#94A3B8" },
                ]}
              >
                {t("doctorConsultationTaskLabel")}
              </Text>
            </View>

            <View
              style={[
                styles.headerAvatarPlaceholder,
                { backgroundColor: isDark ? colors.surfaceMuted : "#E6F7F5" },
              ]}
            >
              <Ionicons
                name="person-outline"
                size={22}
                color={isDark ? colors.textSecondary : "#00A88F"}
              />
            </View>
          </View>

          {/* Status pill right below avatar, aligned to right */}
          <View style={styles.headerStatusRow}>
            <View
              style={[
                styles.onlinePill,
                {
                  backgroundColor: statusIsTerminal
                    ? isDark
                      ? "rgba(100, 116, 139, 0.2)"
                      : "#F1F5F9"
                    : isDark
                      ? "rgba(16, 185, 129, 0.15)"
                      : "#EDFDF8",
                },
              ]}
            >
              <View
                style={[
                  styles.onlinePillDot,
                  { backgroundColor: statusIsTerminal ? "#94A3B8" : "#10B981" },
                ]}
              />
              <Text
                style={[
                  styles.onlinePillText,
                  { color: statusIsTerminal ? "#64748B" : "#059669" },
                ]}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
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
                    backgroundColor: isDark ? colors.surface : "#E4EFF8",
                  },
                ]}
              >
                <Text
                  style={[
                    styles.datePillText,
                    { color: isDark ? colors.textSecondary : "#475569" },
                  ]}
                >
                  {dateHeader}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.statusCard,
                {
                  backgroundColor: isDark ? colors.surface : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#A7F3D0",
                },
              ]}
            >
              <View style={styles.statusHeading}>
                <Ionicons name="pulse" size={22} color="#00A88F" />
                <Text style={styles.statusLabel}>{statusLabel}</Text>
              </View>
              <Text
                style={[
                  styles.statusHint,
                  { color: isDark ? colors.textSecondary : "#475569" },
                ]}
              >
                {conversationOpen
                  ? taskStatus?.status === "completed"
                    ? t("doctorConsultationFollowUpOpen")
                    : t("doctorConsultationStatusTrackingHint")
                  : t("doctorConsultationConversationClosed")}
              </Text>
            </View>

            {taskStatus?.consultation_summary ? (
              <View
                style={[
                  styles.summaryCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.summaryHeading}>
                  <Ionicons
                    name="document-text-outline"
                    size={20}
                    color="#008B76"
                  />
                  <Text
                    style={[styles.summaryTitle, { color: colors.textPrimary }]}
                  >
                    {t("doctorConsultationOutcomeTitle")}
                  </Text>
                </View>
                {(
                  [
                    ["problem_summary", "doctorConsultationOutcomeProblem"],
                    ["assessment", "doctorConsultationOutcomeAssessment"],
                    ["next_steps", "doctorConsultationOutcomeNextSteps"],
                    ["warning_signs", "doctorConsultationOutcomeWarningSigns"],
                    [
                      "follow_up_recommendation",
                      "doctorConsultationOutcomeFollowUp",
                    ],
                  ] as const
                ).map(([field, label]) => (
                  <View style={styles.summaryItem} key={field}>
                    <Text
                      style={[
                        styles.summaryItemLabel,
                        { color: colors.textSecondary },
                      ]}
                    >
                      {t(label)}
                    </Text>
                    <Text
                      style={[
                        styles.summaryItemValue,
                        { color: colors.textPrimary },
                      ]}
                    >
                      {taskStatus.consultation_summary?.[field]}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {/* Initial Request Bubble (Patient sent) */}
            {summary && (
              <View style={[styles.bubbleWrapper, styles.patientWrapper]}>
                <View
                  style={[
                    styles.patientCard,
                    {
                      backgroundColor: isDark
                        ? "rgba(224, 248, 244, 0.18)"
                        : "#E0F7F4",
                      borderColor: isDark ? colors.border : "#B2DFDB",
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
                      { color: isDark ? colors.textPrimary : "#0F172A" },
                    ]}
                  >
                    {summary}
                  </Text>
                  <View style={styles.messageFooterRight}>
                    <Text
                      style={[
                        styles.timestampText,
                        { color: isDark ? colors.textSecondary : "#64748B" },
                      ]}
                    >
                      {formatMessageTime(messages[0]?.created_at)}
                    </Text>
                    <Ionicons
                      name="checkmark-done"
                      size={16}
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
              const content = message.content ?? "";
              const attachment = parseAttachment(content);
              const voice = parseVoice(content);
              const joinUrl = content.match(/https:\/\/[^\s]+/)?.[0] ?? null;
              const timeStr = formatMessageTime(message.created_at);

              if (fromPatient) {
                return (
                  <View
                    key={message.id || index}
                    style={[styles.bubbleWrapper, styles.patientWrapper]}
                  >
                    <Pressable
                      delayLongPress={350}
                      onLongPress={() => showMessageActions(message)}
                      style={[
                        styles.patientBubble,
                        {
                          backgroundColor: isDark
                            ? "rgba(224, 248, 244, 0.18)"
                            : "#E0F7F4",
                          borderColor: isDark ? colors.border : "#B2DFDB",
                        },
                      ]}
                    >
                      {editingMessageId === message.id ? (
                        <View style={styles.editMessageBox}>
                          <TextInput
                            autoFocus
                            maxLength={5000}
                            onChangeText={setEditingDraft}
                            style={[
                              styles.editMessageInput,
                              { color: colors.textPrimary },
                            ]}
                            value={editingDraft}
                          />
                          <View style={styles.editMessageActions}>
                            <Pressable
                              onPress={() => setEditingMessageId(null)}
                            >
                              <Text style={styles.editCancelText}>
                                {t("doctorConsultationCancel")}
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() =>
                                void runMessageAction(
                                  message.id,
                                  "edit",
                                  editingDraft.trim(),
                                )
                              }
                            >
                              <Text style={styles.editSaveText}>
                                {t("doctorConsultationSave")}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : message.is_deleted || message.is_deleted_for_me ? (
                        <Text
                          style={[
                            styles.deletedMessageText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("doctorConsultationMessageUnsent")}
                        </Text>
                      ) : attachment ? (
                        <View style={styles.attachmentContent}>
                          <Pressable
                            accessibilityRole="imagebutton"
                            accessibilityLabel={attachment.name}
                            onPress={() => void Linking.openURL(attachment.url)}
                          >
                            <Image
                              source={{ uri: attachment.url }}
                              style={styles.messageAttachment}
                            />
                          </Pressable>
                          <View style={styles.attachmentBottomRow}>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.attachmentName,
                                {
                                  color: isDark
                                    ? colors.textSecondary
                                    : "#334155",
                                },
                              ]}
                            >
                              {attachment.name}
                            </Text>
                            <View style={styles.messageFooterRight}>
                              {timeStr ? (
                                <Text
                                  style={[
                                    styles.timestampText,
                                    {
                                      color: isDark
                                        ? colors.textSecondary
                                        : "#64748B",
                                    },
                                  ]}
                                >
                                  {timeStr}
                                </Text>
                              ) : null}
                              <Ionicons
                                name="checkmark-done"
                                size={16}
                                color={
                                  message.delivery_status === "seen"
                                    ? "#3B82F6"
                                    : "#00A88F"
                                }
                                style={styles.checkIcon}
                              />
                              {message.delivery_status === "seen" ? (
                                <Text
                                  style={[
                                    styles.deliveryStatusText,
                                    { color: "#3B82F6" },
                                  ]}
                                >
                                  {t("doctorConsultationMessageSeen")}
                                </Text>
                              ) : null}
                            </View>
                          </View>
                        </View>
                      ) : voice ? (
                        <>
                          <Pressable
                            accessibilityRole="button"
                            onPress={() =>
                              void playVoice(message.id, voice.url)
                            }
                            style={styles.voiceMessageButton}
                          >
                            <Ionicons
                              name={
                                playingMessageId === message.id
                                  ? "pause"
                                  : "play"
                              }
                              size={18}
                              color="#00A88F"
                            />
                            <Text
                              style={[
                                styles.voiceMessageText,
                                { color: colors.textPrimary },
                              ]}
                            >
                              {voice.duration_ms
                                ? `${Math.max(1, Math.round(voice.duration_ms / 1000))}s`
                                : t("doctorConsultationVoiceMessage")}
                            </Text>
                          </Pressable>
                          <View style={styles.messageFooterRight}>
                            <Text
                              style={[
                                styles.timestampText,
                                {
                                  color: isDark
                                    ? colors.textSecondary
                                    : "#64748B",
                                },
                              ]}
                            >
                              {timeStr}
                            </Text>
                            <Ionicons
                              name="checkmark-done"
                              size={16}
                              color={
                                message.delivery_status === "seen"
                                  ? "#3B82F6"
                                  : "#00A88F"
                              }
                            />
                          </View>
                        </>
                      ) : (
                        <>
                          <Text
                            style={[
                              styles.messageBodyText,
                              {
                                color: isDark ? colors.textPrimary : "#0F172A",
                              },
                            ]}
                          >
                            {content}
                          </Text>
                          <View style={styles.messageFooterRight}>
                            {timeStr ? (
                              <Text
                                style={[
                                  styles.timestampText,
                                  {
                                    color: isDark
                                      ? colors.textSecondary
                                      : "#64748B",
                                  },
                                ]}
                              >
                                {timeStr}
                              </Text>
                            ) : null}
                            <Ionicons
                              name="checkmark-done"
                              size={16}
                              color={
                                message.delivery_status === "seen"
                                  ? "#3B82F6"
                                  : "#00A88F"
                              }
                              style={styles.checkIcon}
                            />
                            {message.delivery_status === "seen" ? (
                              <Text
                                style={[
                                  styles.deliveryStatusText,
                                  { color: "#3B82F6" },
                                ]}
                              >
                                {t("doctorConsultationMessageSeen")}
                              </Text>
                            ) : null}
                          </View>
                        </>
                      )}
                    </Pressable>
                  </View>
                );
              }

              // Specialist message with avatar on the left
              return (
                <View
                  key={message.id || index}
                  style={[styles.bubbleWrapper, styles.doctorWrapper]}
                >
                  <View
                    style={[
                      styles.doctorMsgAvatar,
                      {
                        backgroundColor: isDark
                          ? colors.surfaceMuted
                          : "#E8F5F3",
                      },
                    ]}
                  >
                    <Ionicons
                      name="person-outline"
                      size={18}
                      color={isDark ? colors.textSecondary : "#008B76"}
                    />
                  </View>
                  <Pressable
                    delayLongPress={350}
                    onLongPress={() => showMessageActions(message)}
                    style={[
                      styles.doctorBubble,
                      {
                        backgroundColor: isDark ? colors.surface : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#EAEAEA",
                      },
                    ]}
                  >
                    {/* Specialist name label */}
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

                    {message.is_deleted || message.is_deleted_for_me ? (
                      <Text
                        style={[
                          styles.deletedMessageText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        {t("doctorConsultationMessageUnsent")}
                      </Text>
                    ) : editingMessageId === message.id ? (
                      <View style={styles.editMessageBox}>
                        <TextInput
                          autoFocus
                          maxLength={5000}
                          onChangeText={setEditingDraft}
                          style={[
                            styles.editMessageInput,
                            { color: colors.textPrimary },
                          ]}
                          value={editingDraft}
                        />
                        <View style={styles.editMessageActions}>
                          <Pressable onPress={() => setEditingMessageId(null)}>
                            <Text style={styles.editCancelText}>
                              {t("doctorConsultationCancel")}
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() =>
                              void runMessageAction(
                                message.id,
                                "edit",
                                editingDraft.trim(),
                              )
                            }
                          >
                            <Text style={styles.editSaveText}>
                              {t("doctorConsultationSave")}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ) : attachment ? (
                      <View style={styles.attachmentContent}>
                        <Pressable
                          accessibilityRole="imagebutton"
                          accessibilityLabel={attachment.name}
                          onPress={() => void Linking.openURL(attachment.url)}
                        >
                          <Image
                            source={{ uri: attachment.url }}
                            style={styles.messageAttachment}
                          />
                        </Pressable>
                        <Text
                          style={[
                            styles.attachmentName,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {attachment.name}
                        </Text>
                      </View>
                    ) : voice ? (
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => void playVoice(message.id, voice.url)}
                        style={styles.voiceMessageButton}
                      >
                        <Ionicons
                          name={
                            playingMessageId === message.id ? "pause" : "play"
                          }
                          size={18}
                          color="#00A88F"
                        />
                        <Text
                          style={[
                            styles.voiceMessageText,
                            { color: colors.textPrimary },
                          ]}
                        >
                          {voice.duration_ms
                            ? `${Math.max(1, Math.round(voice.duration_ms / 1000))}s`
                            : t("doctorConsultationVoiceMessage")}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text
                        style={[
                          styles.messageBodyText,
                          { color: colors.textPrimary },
                        ]}
                      >
                        {content}
                      </Text>
                    )}

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
                  </Pressable>
                </View>
              );
            })}
            {doctorTyping ? (
              <View style={styles.typingIndicator}>
                <View style={styles.typingDots}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </View>
                <Text
                  style={[styles.typingText, { color: colors.textSecondary }]}
                >
                  {t("doctorConsultationDoctorTyping")}
                </Text>
              </View>
            ) : null}

            {/* Rating Section if available */}
            {rateable && (
              <View
                style={[
                  styles.ratingCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text
                  style={[styles.ratingTitle, { color: colors.textPrimary }]}
                >
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

        {/* Composer Toolbar */}
        {conversationOpen ? (
          <View
            style={[
              styles.composerWrapper,
              {
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: isDark ? colors.surface : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#E2E8F0",
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
                  size={24}
                  color={isDark ? colors.textSecondary : "#64748B"}
                />
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  recording
                    ? t("doctorConsultationStopVoice")
                    : t("doctorConsultationRecordVoice")
                }
                disabled={sending}
                onPress={() =>
                  recording
                    ? void stopVoiceRecording()
                    : void startVoiceRecording()
                }
                style={[
                  styles.imagePickerBtn,
                  recording && styles.recordingButton,
                ]}
              >
                <Ionicons
                  name={recording ? "stop" : "mic-outline"}
                  size={22}
                  color={
                    recording
                      ? "#EF4444"
                      : isDark
                        ? colors.textSecondary
                        : "#6F7F8E"
                  }
                />
              </Pressable>

              <TextInput
                multiline
                maxLength={5000}
                onChangeText={setDraft}
                placeholder={t("doctorConsultationReplyPlaceholder")}
                placeholderTextColor={isDark ? colors.textSecondary : "#94A3B8"}
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
                  opacity: !draft.trim() || sending ? 0.6 : 1,
                },
              ]}
            >
              {sending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name="paper-plane"
                  size={20}
                  color="#fff"
                  style={{ marginLeft: 2 }}
                />
              )}
            </Pressable>
          </View>
        ) : (
          <View
            style={[
              styles.closedComposer,
              {
                backgroundColor: isDark ? colors.surface : "#FFFFFF",
                borderTopColor: isDark ? colors.border : "#E2E8F0",
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]}
          >
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text
              style={[
                styles.closedComposerText,
                { color: colors.textSecondary },
              ]}
            >
              {t("doctorConsultationConversationClosed")}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  headerCardWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    zIndex: 10,
  },
  headerCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    shadowColor: "#0D9488",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  headerMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backCircle: {
    alignItems: "center",
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  headerTaskId: {
    fontSize: 13,
    marginTop: 2,
  },
  headerAvatarPlaceholder: {
    alignItems: "center",
    borderRadius: 21,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  headerStatusRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 4,
  },
  onlinePill: {
    alignItems: "center",
    borderRadius: 12,
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  onlinePillDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  onlinePillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  messagesScroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  datePillContainer: {
    alignItems: "center",
    marginVertical: 12,
  },
  datePill: {
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 6,
  },
  datePillText: {
    fontSize: 13,
    fontWeight: "600",
  },
  statusCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    marginBottom: 16,
    padding: 16,
    shadowColor: "#0D9488",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  statusHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
  },
  statusLabel: {
    color: "#00A88F",
    fontSize: 16,
    fontWeight: "700",
  },
  statusHint: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  summaryCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  summaryHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.xs,
  },
  summaryTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
  },
  summaryItem: {
    gap: 3,
  },
  summaryItemLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  summaryItemValue: {
    fontSize: 14,
    lineHeight: 21,
  },
  bubbleWrapper: {
    marginBottom: 12,
    width: "100%",
  },
  patientWrapper: {
    alignItems: "flex-end",
  },
  doctorWrapper: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: 8,
  },
  doctorMsgAvatar: {
    alignItems: "center",
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36,
    marginTop: 2,
  },
  patientCard: {
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: "82%",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  initialRequestTag: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  initialRequestContent: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 24,
  },
  patientBubble: {
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: "82%",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  doctorBubble: {
    borderRadius: 20,
    borderWidth: 1,
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
    borderRadius: 14,
    height: 220,
    width: 220,
    marginBottom: 6,
  },
  attachmentContent: {
    alignItems: "flex-start",
  },
  attachmentBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: 220,
    marginTop: 4,
  },
  attachmentName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
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
    fontSize: 12,
    fontWeight: "500",
  },
  checkIcon: {
    marginLeft: 2,
  },
  deliveryStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  deletedMessageText: {
    fontSize: 14,
    fontStyle: "italic",
  },
  editMessageBox: {
    gap: 8,
    minWidth: 210,
  },
  editMessageInput: {
    borderColor: "#B2DFDB",
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editMessageActions: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    justifyContent: "flex-end",
  },
  editCancelText: {
    color: "#64748B",
    fontSize: 12,
    fontWeight: "600",
  },
  editSaveText: {
    color: "#008B76",
    fontSize: 12,
    fontWeight: "800",
  },
  voiceMessageButton: {
    alignItems: "center",
    backgroundColor: "rgba(0, 168, 143, 0.08)",
    borderRadius: 18,
    flexDirection: "row",
    gap: 8,
    minWidth: 120,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  voiceMessageText: {
    fontSize: 14,
    fontWeight: "700",
  },
  typingIndicator: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.sm,
    marginLeft: 42,
  },
  typingDots: {
    alignItems: "center",
    backgroundColor: "#E8F5F3",
    borderRadius: 14,
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  typingDot: {
    backgroundColor: "#00A88F",
    borderRadius: 3,
    height: 5,
    width: 5,
  },
  typingText: {
    fontSize: 11,
    fontWeight: "600",
  },
  recordingButton: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 18,
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
  composerWrapper: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: "transparent",
  },
  closedComposer: {
    alignItems: "center",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: Platform.OS === "ios" ? 82 : 60,
    paddingHorizontal: spacing.md,
    paddingTop: 12,
  },
  closedComposerText: {
    fontSize: 13,
    fontWeight: "600",
  },
  inputContainer: {
    alignItems: "center",
    borderRadius: 28,
    borderWidth: 1,
    flex: 1,
    flexDirection: "row",
    minHeight: 52,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  imagePickerBtn: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    minHeight: 40,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
  },
  sendCircleButton: {
    alignItems: "center",
    backgroundColor: "#2DD4BF",
    borderRadius: 25,
    elevation: 4,
    height: 50,
    justifyContent: "center",
    shadowColor: "#00A88F",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    width: 50,
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
