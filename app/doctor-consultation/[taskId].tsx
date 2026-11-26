import {
  DoctorIvrEntry,
  DoctorIvrInvitation,
} from "../../src/features/doctor-ivr/DoctorIvrEntry";
import { ConsultationCallScreen } from "../../src/features/doctor-consultation/ConsultationCallScreen";
import {
  consultationBrowserUrl,
  parseConsultationRoom,
  type ConsultationCall,
  type ConsultationCallMode,
} from "../../src/features/doctor-consultation/consultation-call";
import { runNativePermission } from "../../src/lib/native-permissions";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { Stack, useIsFocused, useLocalSearchParams } from "expo-router";
import { Fragment, type ReactNode, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type TextInput as NativeTextInput,
  View,
  Linking,
  Image,
} from "react-native";
import Svg, { Path, Circle } from "react-native-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { ScaledTextInput as TextInput } from "../../src/components/ScaledTextInput";
import { TypingDots } from "../../src/components/TypingIndicator";
import { AppAlertModal } from "../../src/components/AppAlertModal";
import {
  AppActionSheetModal,
  type AppActionSheetAction,
} from "../../src/components/AppActionSheetModal";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useGuardedRouter as useRouter } from "../../src/hooks/useGuardedRouter";
import { apiClient, getApiErrorMessage } from "../../src/lib/apiClient";
import { env } from "../../src/lib/env";
import { tokenStore } from "../../src/lib/tokenStore";
import { showToast } from "../../src/stores/toast.store";
import { radius, spacing } from "../../src/styles";

const messageReactions = ["👍", "❤️", "😊", "😂", "😆", "😍", "😮", "😕", "😢", "😡", "🙏", "👏"] as const;
type ReactionEmoji = (typeof messageReactions)[number];
type MessageQuote = {
  id: string;
  sender_type: "patient" | "doctor" | "system";
  content: string | null;
  kind?: "text" | "attachment" | "voice";
};

type TaskMessage = {
  id: string;
  sender_type: "patient" | "doctor" | "system";
  sender_ref?: string | null;
  ivr_session_id?: string | null;
  ivr_session_status?: string | null;
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
  pinned_at?: string | null;
  reactions?: Array<{ emoji: ReactionEmoji; count: number; reacted_by_me: boolean }>;
  reply_to_message_id?: string | null;
  reply_to?: MessageQuote | null;
  delivery_status?: "sent" | "seen";
};

type ConsultationDoctor = {
  id: string;
  name: string;
  avatar_url: string | null;
};
type DoctorPresence = {
  doctor_ref: string;
  status: "online" | "offline";
  expires_at: string | null;
};
type InitialRequest = {
  description: string;
  answers: Array<{ step: string; question: string; answer: string }>;
  risk_label: string;
};
const isSystemMessage = (message: TaskMessage) =>
  message.sender_type === "system" ||
  (message.sender_type === "doctor" &&
    ["doctor-sla-worker", "doctor-ivr-worker"].includes(message.sender_ref ?? ""));

const isUnsent = (message: TaskMessage) => Boolean(message.is_deleted || message.deleted_at);
const isPinned = (message: TaskMessage) => message.is_pinned ?? Boolean(message.pinned_at);
const pinTime = (message: TaskMessage) => Date.parse(message.pinned_at ?? message.created_at) || 0;

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

import { Audio } from "@/lib/audio";

type ThreadResponse = {
  ok: boolean;
  data?: {
    task_id: string;
    summary: string | null;
    initial_request?: InitialRequest | null;
    messages: TaskMessage[];
    doctor_presence?: DoctorPresence | null;
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
      reopen_open?: boolean;
      doctor?: ConsultationDoctor | null;
      call_available?: boolean;
      video_room?: { provider: "jitsi"; join_url: string } | null;
    } | null;
  };
};

type TaskListResponse = {
  ok: boolean;
  data?: {
    tasks?: Array<{
      task_id: string;
      status?: string | null;
      follow_up_until?: string | null;
    }>;
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

type CallRequestResponse = {
  request_id: string;
  mode: ConsultationCallMode;
  status: "ringing" | "accepted" | "declined" | "cancelled" | "expired" | "unavailable";
  expires_at: string;
  video_room?: { provider: "jitsi"; join_url: string } | null;
};

const requestConsultationCall = async (
  taskId: string,
  tenantId: string,
  requestId: string,
  action: { action: "request"; mode: ConsultationCallMode } | { action: "status" | "cancel" },
) => {
  const response = await apiClient<{ ok: boolean; data: CallRequestResponse }>(
    `/api/doctor/tasks/${encodeURIComponent(taskId)}/call-requests`,
    { method: "POST", body: { tenant_id: tenantId, request_id: requestId, ...action } },
  );
  return response.data;
};

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
  dateString: string | undefined,
  todayLabel: string,
  locale: string
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
  return null;
}

export default function DoctorConsultationThreadScreen() {
  const { t, i18n } = useTranslation("home");
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const focused = useIsFocused();
  const { taskId: rawTaskId, tenantId: rawTenantId } = useLocalSearchParams<{
    taskId: string;
    tenantId?: string;
  }>();
  const taskId = Array.isArray(rawTaskId) ? rawTaskId[0] : rawTaskId;
  const tenantId = Array.isArray(rawTenantId) ? rawTenantId[0] : rawTenantId;
  const activeTenantId = tenantId || env.doctorTenantId;
  const { colors, isDark } = useThemeColors();
  const scrollRef = useRef<ScrollView>(null);
  const followLatest = useRef(true);
  const messageOffsets = useRef(new Map<string, number>());
  const [summary, setSummary] = useState<string | null>(null);
  const [initialRequest, setInitialRequest] = useState<InitialRequest | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [doctorTyping, setDoctorTyping] = useState(false);
  const [doctorPresence, setDoctorPresence] = useState<DoctorPresence | null>(null);
  const presenceEventVersion = useRef(0);
  const [draft, setDraft] = useState("");
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const composerInputRef = useRef<NativeTextInput>(null);
  const replyTarget = messages.find((message) =>
    message.id === replyToId && !message.is_deleted && !message.deleted_at && !message.is_deleted_for_me
  );
  const patientTypingRef = useRef<{
    renew: () => void;
    stop: () => void;
  } | null>(null);
  const typingSendQueue = useRef<Promise<unknown>>(Promise.resolve());
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [messageActionBusy, setMessageActionBusy] = useState(false);
  const messageActionInFlight = useRef(false);
  const editedMessage = messages.find(
    (message) => message.id === editingMessageId
  );
  const hasMessageEditChanges =
    Boolean(editedMessage) &&
    Boolean(editingDraft.trim()) &&
    editingDraft.trim() !== (editedMessage?.content ?? "").trim();
  const editMessageSaveDisabled = messageActionBusy || !hasMessageEditChanges;
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
  const taskStatusRef = useRef(taskStatus);
  taskStatusRef.current = taskStatus;
  const threadLoadRef = useRef({ version: 0, pending: false, refreshRequested: false });
  const messageSyncRef = useRef({ started: 0, applied: 0, pending: false, refreshRequested: false });
  const [statusClock, setStatusClock] = useState(() => Date.now());
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [busyModalVisible, setBusyModalVisible] = useState(false);
  const [callingMode, setCallingMode] = useState<ConsultationCallMode | null>(null);
  const [consultationCall, setConsultationCall] = useState<ConsultationCall | null>(null);
  const [pendingCall, setPendingCall] = useState<CallRequestResponse | null>(null);
  const [cancellingCall, setCancellingCall] = useState(false);
  const callRequestRef = useRef<symbol | null>(null);
  const [actionMessage, setActionMessage] = useState<TaskMessage | null>(null);
  const busyModalShownRef = useRef(false);

  const messagesEndpoint = `/api/doctor/tasks/${encodeURIComponent(taskId ?? "")}/messages`;
  const tenantQuery = `tenant_id=${encodeURIComponent(activeTenantId)}`;

  const applyMessages = (data: ThreadResponse["data"], order: number) => {
    if (!data || order <= messageSyncRef.current.applied) return;
    messageSyncRef.current.applied = order;
    setSummary(data.summary ?? null);
    setInitialRequest(data.initial_request ?? null);
    setMessages(data.messages);
    setDoctorTyping(data.typing?.is_typing === true);
    const unread = data.messages
      .filter((message) => message.sender_type !== "patient" &&
        !message.is_deleted_for_me && !isUnsent(message) && !message.read_at)
      .map((message) => message.id);
    if (unread.length) {
      void apiClient(`${messagesEndpoint}/action`, {
        method: "POST",
        body: { tenant_id: activeTenantId, action: "read", message_ids: unread },
      }).catch(() => undefined);
    }
  };

  const loadMessageUpdates = async () => {
    if (!taskId) return;
    const sync = messageSyncRef.current;
    if (sync.pending) {
      sync.refreshRequested = true;
      return;
    }
    sync.pending = true;
    const order = ++sync.started;
    const token = tokenStore.getToken();
    const current = () => sync === messageSyncRef.current && token === tokenStore.getToken();
    try {
      const response = await apiClient<ThreadResponse>(`${messagesEndpoint}?${tenantQuery}&view=messages`, {
        retry: { attempts: 2 },
      });
      if (!current() || !response.data) return;
      applyMessages(response.data, order);
      setLoading(false);
    } catch {
      if (current()) void loadThread(false, true);
    } finally {
      sync.pending = false;
      if (current() && sync.refreshRequested) {
        sync.refreshRequested = false;
        void loadMessageUpdates();
      }
    }
  };

  const loadThread = async (showLoading = false, refreshIfBusy = false) => {
    if (!taskId) return;
    if (threadLoadRef.current.pending) {
      if (refreshIfBusy) threadLoadRef.current.refreshRequested = true;
      return;
    }
    const request = ++threadLoadRef.current.version;
    const messageOrder = ++messageSyncRef.current.started;
    const presenceVersionAtFetch = presenceEventVersion.current;
    threadLoadRef.current.pending = true;
    const token = tokenStore.getToken();
    const current = () => request === threadLoadRef.current.version;
    if (showLoading) setLoading(true);
    try {
      const response = await apiClient<ThreadResponse>(
        `${messagesEndpoint}?${tenantQuery}`,
        {
          // A tunnel/backend cold start should not surface as a false chat
          // loading error on the first render.
          retry: { attempts: 3, initialDelayMs: 500, backoffFactor: 2 },
        }
      );
      if (!current() || token !== tokenStore.getToken()) return;
      applyMessages(response.data, messageOrder);
      if (presenceVersionAtFetch === presenceEventVersion.current) {
        setDoctorPresence(response.data?.doctor_presence ?? null);
      }
      // The Doctor integration can be temporarily unavailable while ASINU
      // still serves persisted messages. Recover the lifecycle from ASINU's
      // task list so an expired/completed case remains read-only instead of
      // looking like an unknown active conversation.
      let resolvedTaskStatus = response.data?.task_status ?? null;
      if (!resolvedTaskStatus) {
        try {
          const taskList = await apiClient<TaskListResponse>(
            `/api/doctor/tasks?tenant_id=${encodeURIComponent(activeTenantId)}`,
            {
              retry: { attempts: 2, initialDelayMs: 400, backoffFactor: 2 },
            }
          );
          const task = taskList.data?.tasks?.find(
            (candidate) => candidate.task_id === taskId
          );
          if (task?.status) {
            const followUpUntil = task.follow_up_until ?? null;
            resolvedTaskStatus = {
              status: task.status,
              rateable: task.status === "completed",
              follow_up_until: followUpUntil,
              follow_up_open: Boolean(
                task.status === "completed" &&
                  followUpUntil &&
                  new Date(followUpUntil).getTime() > Date.now()
              ),
            };
          }
        } catch {
          // Keep the fail-closed state when the fallback is unavailable.
        }
      }

      if (!current() || token !== tokenStore.getToken()) return;
      setRateable(resolvedTaskStatus?.rateable === true);
      setTaskStatus(resolvedTaskStatus);
      if (
        (resolvedTaskStatus?.status === "expired" ||
          (resolvedTaskStatus?.status === "cancelled" &&
            resolvedTaskStatus.reopen_open === true)) &&
        !busyModalShownRef.current
      ) {
        busyModalShownRef.current = true;
        setBusyModalVisible(true);
      }
    } catch (error) {
      if (current() && token === tokenStore.getToken() && showLoading) {
        showToast(
          getApiErrorMessage(error, t, "doctorConsultationThreadError"),
          "error"
        );
      }
    } finally {
      if (current()) {
        const thread = threadLoadRef.current;
        thread.pending = false;
        if (showLoading) setLoading(false);
        if (thread.refreshRequested) {
          thread.refreshRequested = false;
          void loadThread();
        }
      }
    }
  };

  useEffect(() => {
    followLatest.current = true;
    messageOffsets.current.clear();
    setReplyToId(null);
    setCallingMode(null);
    setConsultationCall(null);
    setPendingCall(null);
    setCancellingCall(false);
  }, [taskId, activeTenantId]);

  useEffect(() => {
    if (!focused || !taskId) return;
    let disposed = false;
    let connected = false;
    let connecting = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let appState = AppState.currentState;
    setCallingMode(null);
    setCancellingCall(false);
    const fallbackTimer = setInterval(() => {
      // A live chat socket does not mean the newly enqueued task is ready yet.
      if (
        appState === "active" &&
        (!connected ||
          !taskStatusRef.current?.status ||
          ["new", "queued", "assigned"].includes(taskStatusRef.current.status))
      )
        void loadThread();
    }, 5000);

    const scheduleReconnect = () => {
      if (disposed || appState !== "active" || reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, 5000);
    };

    const connect = async () => {
      if (disposed || appState !== "active" || !taskId || socket || connecting) return;
      connecting = true;
      try {
        const token = await tokenStore.loadToken();
        if (disposed || appState !== "active" || !token) return;
        if (token !== tokenStore.getToken()) {
          scheduleReconnect();
          return;
        }
        const baseUrl = env.apiBaseUrl
          .replace(/^http/i, "ws")
          .replace(/\/$/, "");
        const url = `${baseUrl}/api/doctor/chat/ws?tenant_id=${encodeURIComponent(
          activeTenantId
        )}&task_id=${encodeURIComponent(taskId)}`;
        const connection = new WebSocket(url, ["asinu-chat", token]);
        socket = connection;
        connection.onopen = () => {
          if (disposed || appState !== "active" || socket !== connection) {
            connection.close();
            return;
          }
          connected = true;
          setRealtimeConnected(true);
          void loadThread(false, true);
        };
        connection.onmessage = (event) => {
          if (disposed || socket !== connection || token !== tokenStore.getToken()) return;
          try {
            const envelope = JSON.parse(String(event.data)) as {
              type?: string;
              data?: Partial<DoctorPresence> & {
                actor_type?: string | null;
                is_typing?: boolean;
              };
            };
            if (
              envelope.type === "chat.message.changed" ||
              envelope.type === "chat.ivr.invitation.changed"
            ) {
              void loadMessageUpdates();
            } else if (envelope.type === "chat.task.status.changed") {
              void loadThread(false, true);
            } else if (
              envelope.type === "chat.typing.changed" &&
              envelope.data?.actor_type === "doctor"
            ) {
              setDoctorTyping(envelope.data.is_typing === true);
            } else if (envelope.type === "chat.doctor.presence.changed") {
              const pulse = envelope.data;
              const doctorId = taskStatusRef.current?.doctor?.id;
              if (
                pulse?.doctor_ref &&
                (!doctorId || doctorId === pulse.doctor_ref) &&
                (pulse.status === "offline" ||
                  (pulse.status === "online" && typeof pulse.expires_at === "string"))
              ) {
                presenceEventVersion.current++;
                setDoctorPresence({
                  doctor_ref: pulse.doctor_ref,
                  status: pulse.status,
                  expires_at: pulse.status === "online" ? pulse.expires_at ?? null : null,
                });
              }
            }
          } catch {
            // The REST refresh below remains the safe source of truth.
          }
        };
        connection.onerror = () => {
          if (socket !== connection) return;
          connected = false;
          setRealtimeConnected(false);
          connection.close();
        };
        connection.onclose = () => {
          if (socket !== connection) return;
          socket = null;
          connected = false;
          setRealtimeConnected(false);
          scheduleReconnect();
        };
      } catch {
        connected = false;
        setRealtimeConnected(false);
        scheduleReconnect();
      } finally {
        connecting = false;
      }
    };

    const resetConnection = () => {
      connected = false;
      setRealtimeConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      const previous = socket;
      socket = null;
      previous?.close();
    };
    const unsubscribeSession = tokenStore.subscribeSession(() => {
      resetConnection();
      callRequestRef.current = null;
      setCallingMode(null);
      setCancellingCall(false);
      setConsultationCall(null);
      setPendingCall(null);
      if (appState === "active" && tokenStore.getToken()) void connect();
    });
    const appStateSubscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = appState === "active";
      appState = nextState;
      if (nextState !== "active") {
        resetConnection();
        return;
      }
      if (!wasActive) {
        void loadThread(false, true);
        void connect();
      }
    });

    setDoctorPresence(null);
    void loadThread(loading);
    void connect();
    return () => {
      disposed = true;
      callRequestRef.current = null;
      threadLoadRef.current.version++;
      threadLoadRef.current.pending = false;
      threadLoadRef.current.refreshRequested = false;
      messageSyncRef.current = { started: 0, applied: 0, pending: false, refreshRequested: false };
      unsubscribeSession();
      appStateSubscription.remove();
      clearInterval(fallbackTimer);
      resetConnection();
    };
  }, [taskId, activeTenantId, focused]);

  useEffect(
    () => () => {
      void soundRef.current?.unloadAsync?.();
      void recordingRef.current?.stopAndUnloadAsync?.();
    },
    []
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (followLatest.current) scrollRef.current?.scrollToEnd({ animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages.length]);

  const handleThreadScroll = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentSize, contentOffset, layoutMeasurement } = nativeEvent;
    followLatest.current = contentSize.height - contentOffset.y - layoutMeasurement.height < 80;
  };

  const jumpToMessage = (messageId: string) => {
    const offset = messageOffsets.current.get(messageId);
    if (offset === undefined || !scrollRef.current) return;
    followLatest.current = false;
    scrollRef.current.scrollTo({ y: Math.max(offset - spacing.sm, 0), animated: true });
  };

  const send = async () => {
    const content = draft.trim();
    if (!taskId || !content || sending || !conversationOpen) return;
    const repliedTo = replyTarget?.id;
    patientTypingRef.current?.stop();
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
            ...(repliedTo ? { reply_to_message_id: repliedTo } : {}),
          },
        }
      );
      setDraft("");
      setReplyToId((current) => current === repliedTo ? null : current);
      followLatest.current = true;
      await loadThread(false, true);
    } catch {
      showToast(t("doctorConsultationMessageError"), "error");
    } finally {
      setSending(false);
    }
  };

  const runMessageAction = async (
    messageId: string,
    action: "edit" | "unsend" | "delete_for_me" | "pin" | "unpin" | "react",
    content?: string,
    reaction?: ReactionEmoji | null
  ) => {
    if (!taskId || messageActionInFlight.current || (action === "react" && !conversationOpen)) {
      return;
    }
    if (
      action === "edit" &&
      (messageId !== editingMessageId ||
        !hasMessageEditChanges ||
        content?.trim() !== editingDraft.trim())
    ) {
      return;
    }
    messageActionInFlight.current = true;
    setMessageActionBusy(true);
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
            ...(action === "react" ? { reaction: reaction ?? null } : {}),
          },
        }
      );
      if (action !== "react") {
        setEditingMessageId(null);
        setEditingDraft("");
      }
      await loadThread(false, true);
    } catch {
      showToast(t("doctorConsultationMessageError"), "error");
    } finally {
      messageActionInFlight.current = false;
      setMessageActionBusy(false);
    }
  };

  const showMessageActions = (message: TaskMessage) => {
    if (message.is_deleted || message.deleted_at || message.is_deleted_for_me) return;
    setActionMessage(message);
  };

  const startVoiceRecording = async () => {
    if (recording || sending || !conversationOpen) return;
    try {
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
        Audio.RecordingOptionsPresets.HIGH_QUALITY
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
    if (!activeRecording || !taskId || !conversationOpen) return;
    const repliedTo = replyTarget?.id;
    setRecording(false);
    setSending(true);
    try {
      await activeRecording.stopAndUnloadAsync();
      const uri = activeRecording.getURI();
      recordingRef.current = null;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      if (!uri) throw new Error("VOICE_FILE_MISSING");
      const formData = new FormData();
      formData.append("file", {
        uri,
        name: `voice-message-${Date.now()}.m4a`,
        type: "audio/m4a",
      } as any);
      formData.append("tenant_id", activeTenantId);
      if (repliedTo) formData.append("reply_to_message_id", repliedTo);
      formData.append(
        "duration_ms",
        String(Date.now() - recordingStartedAtRef.current)
      );
      await apiClient(`/api/doctor/tasks/${encodeURIComponent(taskId)}/voice`, {
        method: "POST",
        body: formData,
        headers: { "X-Client-Message-Id": createClientMessageId() },
      });
      setReplyToId((current) => current === repliedTo ? null : current);
      followLatest.current = true;
      await loadThread(false, true);
    } catch {
      showToast(t("doctorConsultationVoiceError"), "error");
    } finally {
      setSending(false);
    }
  };

  const resolveMediaUrl = async (
    messageId: string,
    url: string,
    kind: "voice" | "attachment"
  ) => {
    const expiry = Number(/[?&]expires_at=(\d+)(?:&|$)/.exec(url)?.[1]);
    if (!expiry || expiry > Date.now() / 1000 + 30) return url;
    const token = tokenStore.getToken();
    const response = await apiClient<ThreadResponse>(
      `/api/doctor/tasks/${encodeURIComponent(
        taskId
      )}/messages?tenant_id=${encodeURIComponent(activeTenantId)}`
    );
    if (tokenStore.getToken() !== token) throw new Error("Session changed");
    const message = response.data?.messages?.find(
      (message) => message.id === messageId
    );
    const media =
      kind === "voice"
        ? parseVoice(message?.content || "")
        : parseAttachment(message?.content || "");
    if (!media?.url) throw new Error("File is unavailable");
    return media.url;
  };

  const openAttachment = async (messageId: string, url: string) => {
    try {
      await Linking.openURL(
        await resolveMediaUrl(messageId, url, "attachment")
      );
    } catch {
      showToast(t("doctorConsultationAttachmentError"), "error");
    }
  };

  const renderAttachmentPreview = (attachment: Attachment, messageId: string) => {
    const isImage = attachment.mime_type?.startsWith("image/");
    return (
      <Pressable
        accessibilityRole={isImage ? "imagebutton" : "button"}
        accessibilityLabel={attachment.name}
        onPress={() => void openAttachment(messageId, attachment.url)}
        style={isImage ? undefined : styles.messageDocument}
      >
        {isImage ? (
          <Image source={{ uri: attachment.url }} style={styles.messageAttachment} />
        ) : (
          <>
            <Ionicons accessible={false} name="document-text-outline" size={20} color={colors.primaryText} />
            <Text style={[styles.messageDocumentLabel, { color: colors.primaryText }]}>
              {t("doctorConsultationOpenDocument")}
            </Text>
          </>
        )}
      </Pressable>
    );
  };

  const playVoice = async (messageId: string, url: string) => {
    try {
      if (playingMessageId === messageId) {
        await soundRef.current?.pauseAsync?.();
        setPlayingMessageId(null);
        return;
      }
      await soundRef.current?.unloadAsync?.();
      const result = await Audio.Sound.createAsync(
        { uri: await resolveMediaUrl(messageId, url, "voice") },
        { shouldPlay: true }
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
    if (!taskId || sending || !conversationOpen) return;
    const repliedTo = replyTarget?.id;
    try {
      const permission = await runNativePermission(
        () => ImagePicker.requestMediaLibraryPermissionsAsync(),
        { key: "photo-library" }
      );
      if (!permission.granted) {
        showToast(t("doctorConsultationPhotoPermission"), "error");
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
        if (repliedTo) formData.append("reply_to_message_id", repliedTo);
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
        setReplyToId((current) => current === repliedTo ? null : current);
        followLatest.current = true;
        await loadThread(false, true);
        showToast(t("doctorConsultationImageSent"), "success");
      }
    } catch (error) {
      showToast(
        getApiErrorMessage(error, t, "doctorConsultationAttachmentError"),
        "error"
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

  const visibleMessages = messages.filter((message) => !message.is_deleted_for_me);
  const messagesById = new Map(visibleMessages.map((message) => [message.id, message]));
  const pinnedMessage = visibleMessages.reduce<TaskMessage | null>((latest, message) => {
    if (!isPinned(message) || isUnsent(message) || isSystemMessage(message)) return latest;
    return !latest || pinTime(message) >= pinTime(latest) ? message : latest;
  }, null);
  const dateLabel = (date?: string) => formatHeaderDate(
    date,
    t("doctorConsultationToday"),
    i18n.language === "en" ? "en-US" : "vi-VN"
  );
  const terminalStatuses = [
    "cancelled",
    "expired",
    "failed",
    "emergency_referred",
    "forwarded",
  ];
  const followUpOpen = Boolean(
    taskStatus?.status === "completed" &&
      taskStatus.follow_up_open === true &&
      (!taskStatus.follow_up_until ||
        new Date(taskStatus.follow_up_until).getTime() > statusClock)
  );
  const currentStatus = taskStatus?.status;
  const statusUnknown = !currentStatus;
  const reopenOpen = Boolean(
    ["cancelled", "expired"].includes(currentStatus ?? "") &&
      taskStatus?.reopen_open === true &&
      (!taskStatus?.follow_up_until ||
        new Date(taskStatus.follow_up_until).getTime() > statusClock)
  );
  const conversationOpen = currentStatus
    ? (reopenOpen || !terminalStatuses.includes(currentStatus)) &&
      (currentStatus !== "completed" || followUpOpen)
    : false;
  const statusLabel = taskStatus?.status
    ? t(`doctorConsultationStatus_${taskStatus.status}`)
    : t("doctorConsultationStatusSyncing");
  const statusIsTerminal = Boolean(
    currentStatus && ["completed", ...terminalStatuses].includes(currentStatus)
  );
  useEffect(() => {
    if (statusIsTerminal) {
      setConsultationCall(null);
      setPendingCall(null);
    }
  }, [statusIsTerminal]);

  const assignedDoctor = taskStatus?.doctor;
  const showDoctorPresence = conversationOpen && (Boolean(assignedDoctor) || currentStatus === "waiting_user");
  const presenceForDoctor = doctorPresence?.doctor_ref === assignedDoctor?.id ? doctorPresence : null;
  const doctorPresenceExpiresAt = presenceForDoctor?.status === "online"
    ? Date.parse(presenceForDoctor.expires_at ?? "")
    : 0;
  const doctorOnline = doctorPresenceExpiresAt > Date.now();
  const headerStatusLabel = showDoctorPresence
    ? t(doctorOnline
      ? "doctorConsultationExpertOnline"
      : presenceForDoctor
        ? "doctorConsultationExpertOffline"
        : "doctorConsultationExpertStatusUnknown")
    : statusLabel;

  const messageActions: AppActionSheetAction[] = [];
  if (actionMessage) {
    if (conversationOpen && !sending && !recording) {
      messageActions.push({
        key: "reply",
        label: t("doctorConsultationReplyToMessage"),
        icon: "arrow-undo-outline",
        onPress: () => {
          setReplyToId(actionMessage.id);
          requestAnimationFrame(() => composerInputRef.current?.focus());
        },
      });
    }
    const ownMessage = actionMessage.sender_type === "patient";
    const content = actionMessage.content ?? "";
    const isRichMessage = Boolean(
      parseAttachment(content) || parseVoice(content)
    );
    if (ownMessage && !isRichMessage) {
      messageActions.push({
        key: "edit",
        label: t("doctorConsultationEditMessage"),
        icon: "create-outline",
        onPress: () => {
          setEditingMessageId(actionMessage.id);
          setEditingDraft(actionMessage.content ?? "");
        },
      });
      messageActions.push({
        key: "unsend",
        label: t("doctorConsultationUnsendMessage"),
        icon: "arrow-undo-outline",
        destructive: true,
        onPress: () => void runMessageAction(actionMessage.id, "unsend"),
      });
    }
    messageActions.push({
      key: "delete_for_me",
      label: t("doctorConsultationDeleteForMe"),
      icon: "trash-outline",
      destructive: true,
      onPress: () => void runMessageAction(actionMessage.id, "delete_for_me"),
    });
    messageActions.push({
      key: "pin",
      label: isPinned(actionMessage)
        ? t("doctorConsultationUnpinMessage")
        : t("doctorConsultationPinMessage"),
      icon: "pin-outline",
      onPress: () =>
        void runMessageAction(
          actionMessage.id,
          isPinned(actionMessage) ? "unpin" : "pin"
        ),
    });
  }

  const authorOf = (message: Pick<TaskMessage, "sender_type" | "sender_ref">) =>
    message.sender_type === "patient"
      ? t("doctorConsultationYou")
      : message.sender_type === "system"
        ? t("doctorConsultationSystem")
        : (message.sender_ref === assignedDoctor?.id && assignedDoctor?.name) ||
          t("doctorConsultationDoctor");

  const replyPreview = (message: Pick<MessageQuote, "content" | "kind">) => {
    if (message.kind === "voice" || message.content?.startsWith("[ASINU_VOICE]"))
      return t("doctorConsultationVoiceMessage");
    if (message.kind === "attachment" || message.content?.startsWith("[ASINU_ATTACHMENT]"))
      return t("doctorConsultationReplyAttachment");
    return message.content?.trim() || t("doctorConsultationReplyUnavailable");
  };

  const changeReaction = (message: TaskMessage, emoji: ReactionEmoji) => {
    const selected = message.reactions?.some((item) => item.emoji === emoji && item.reacted_by_me);
    void runMessageAction(message.id, "react", undefined, selected ? null : emoji);
  };

  const renderMessageQuote = (message: TaskMessage) => {
    if (!message.reply_to_message_id || isUnsent(message)) return null;
    const quote = message.reply_to;
    const original = quote ? messagesById.get(quote.id) : undefined;
    const canJump = !!original && !isUnsent(original);
    return (
      <Pressable
        accessibilityRole={canJump ? "button" : undefined}
        accessibilityHint={canJump ? t("doctorConsultationJumpToMessage") : undefined}
        disabled={!canJump}
        onPress={() => {
          if (canJump) jumpToMessage(original.id);
        }}
        style={[styles.messageQuote, { backgroundColor: colors.surfaceMuted }]}
      >
        <Text numberOfLines={1} style={[styles.quoteAuthor, { color: colors.textPrimary }]}>
          {quote ? authorOf(original ?? quote) : t("doctorConsultationReplyToMessage")}
        </Text>
        <Text numberOfLines={2} style={[styles.quoteText, { color: colors.textSecondary }]}>
          {quote ? replyPreview(quote) : t("doctorConsultationReplyUnavailable")}
        </Text>
      </Pressable>
    );
  };

  const renderMessageReactions = (message: TaskMessage) => {
    if (!message.reactions?.length || isUnsent(message))
      return null;
    return (
      <View style={styles.messageReactionRow}>
        {message.reactions.map(({ emoji, count, reacted_by_me }) => (
          <Pressable
            key={emoji}
            accessibilityRole="button"
            accessibilityLabel={`${t("doctorConsultationReact")} ${emoji} ${count}`}
            accessibilityState={{ selected: reacted_by_me, disabled: !conversationOpen || messageActionBusy }}
            disabled={!conversationOpen || messageActionBusy}
            hitSlop={4}
            onPress={() => changeReaction(message, emoji)}
            style={[styles.messageReactionChip, {
              backgroundColor: colors.surface,
              borderColor: reacted_by_me ? colors.primary : colors.border,
            }]}
          >
            <Text style={[styles.messageReactionText, { color: colors.textPrimary }]}>
              {emoji}{count > 1 ? ` ${count}` : ""}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  };

  const renderMessageBubble = (message: TaskMessage, content: ReactNode) => {
    const fromPatient = message.sender_type === "patient";
    return (
      <View style={fromPatient ? styles.patientBubbleStack : styles.doctorBubbleStack}>
        <Pressable
          delayLongPress={350}
          onLongPress={() => showMessageActions(message)}
          style={[
            styles.messageBubble,
            fromPatient
              ? {
                  backgroundColor: isDark ? "rgba(224, 248, 244, 0.18)" : "#E0F7F4",
                  borderColor: isDark ? colors.border : "#B2DFDB",
                }
              : {
                  backgroundColor: isDark ? colors.surface : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#EAEAEA",
                },
          ]}
        >
          {content}
        </Pressable>
        {renderMessageReactions(message)}
      </View>
    );
  };

  const renderDatePill = (label: string) => (
    <View style={styles.datePillContainer}>
      <View style={[styles.datePill, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={[styles.datePillText, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );

  const renderEditedLabel = (message: TaskMessage) =>
    !isUnsent(message) && (message.is_edited || message.edited_at) ? (
      <Text style={[styles.editedLabel, { color: colors.textSecondary }]}>
        {t("doctorConsultationMessageEdited")}
      </Text>
    ) : null;

  const canCall = taskStatus?.call_available === true && !statusIsTerminal;

  const openCall = async (
    videoRoom: CallRequestResponse["video_room"],
    mode: ConsultationCallMode,
    invitation?: string,
  ) => {
    const room = videoRoom?.provider === "jitsi" && parseConsultationRoom(videoRoom.join_url);
    if (!room) {
      showToast(t("doctorConsultationCallUnavailable"), "error");
      return;
    }
    if (invitation) {
      const invitedRoom = parseConsultationRoom(invitation);
      if (!invitedRoom || invitedRoom.url.origin !== room.url.origin || invitedRoom.roomName !== room.roomName) {
        showToast(t("doctorConsultationCallUnavailable"), "error");
        return;
      }
    }
    const call = { ...room, mode };
    if (Platform.OS === "web") await Linking.openURL(consultationBrowserUrl(call));
    else {
      composerInputRef.current?.blur();
      setConsultationCall(call);
    }
  };

  const showCallOutcome = (status: CallRequestResponse["status"]) => {
    if (status === "declined") showToast(t("doctorConsultationCallDeclined"), "info");
    else if (status === "expired") showToast(t("doctorConsultationCallMissed"), "info");
    else if (status === "unavailable") showToast(t("doctorConsultationCallUnavailable"), "error");
  };

  useEffect(() => {
    if (!taskId || !pendingCall || !focused || statusIsTerminal || cancellingCall) return;
    const token = tokenStore.getToken();
    const deadline = Date.parse(pendingCall.expires_at);
    let disposed = false;
    let polling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let appState = AppState.currentState;
    const current = () => !disposed && token === tokenStore.getToken() && appState === "active";
    const poll = async () => {
      if (!current() || polling) return;
      polling = true;
      let waiting = true;
      try {
        const result = await requestConsultationCall(taskId, activeTenantId, pendingCall.request_id, { action: "status" });
        if (!current() || callRequestRef.current || result.status === "ringing") return;
        waiting = false;
        setPendingCall(null);
        if (result.status === "accepted") await openCall(result.video_room, result.mode);
        else showCallOutcome(result.status);
      } catch (error) {
        if (!current() || callRequestRef.current) return;
        const unavailable = (error as { code?: string } | null)?.code === "CONSULTATION_CALL_UNAVAILABLE";
        if (unavailable || !waiting || Date.now() > deadline + 5000) {
          waiting = false;
          setPendingCall(null);
          showToast(t(unavailable ? "doctorConsultationCallUnavailable" : "doctorConsultationCallError"), "error");
        }
      } finally {
        polling = false;
        if (waiting && current()) timer = setTimeout(poll, 1500);
      }
    };
    timer = setTimeout(poll, 1000);
    const subscription = AppState.addEventListener("change", (state) => {
      appState = state;
      clearTimeout(timer);
      if (state === "active") void poll();
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [taskId, activeTenantId, pendingCall, focused, statusIsTerminal, cancellingCall]);

  const startCall = async (mode: ConsultationCallMode, invitation?: string) => {
    if (!taskId || statusIsTerminal || (!canCall && !invitation) || consultationCall || pendingCall || callRequestRef.current) return;
    const token = tokenStore.getToken();
    const request = Symbol();
    callRequestRef.current = request;
    setCallingMode(mode);
    const current = () => callRequestRef.current === request && tokenStore.getToken() === token;
    try {
      if (invitation) {
        const response = await apiClient<ThreadResponse>(`${messagesEndpoint}?${tenantQuery}`);
        if (!current()) return;
        const liveStatus = response.data?.task_status;
        if (liveStatus) setTaskStatus(liveStatus);
        await openCall(liveStatus?.call_available ? liveStatus.video_room : null, mode, invitation);
        return;
      }
      const result = await requestConsultationCall(taskId, activeTenantId, createClientMessageId(), { action: "request", mode });
      if (!current()) return;
      if (result.status === "ringing") setPendingCall(result);
      else if (result.status === "accepted") await openCall(result.video_room, result.mode);
      else showCallOutcome(result.status);
    } catch (error) {
      if (!current()) return;
      const unavailable = (error as { code?: string } | null)?.code === "CONSULTATION_CALL_UNAVAILABLE";
      showToast(t(unavailable ? "doctorConsultationCallUnavailable" : "doctorConsultationCallError"), "error");
    } finally {
      if (callRequestRef.current === request) {
        callRequestRef.current = null;
        setCallingMode(null);
      }
    }
  };

  const cancelCall = async () => {
    if (!taskId || !pendingCall || callRequestRef.current) return;
    const request = Symbol();
    const token = tokenStore.getToken();
    callRequestRef.current = request;
    setCancellingCall(true);
    const current = () => callRequestRef.current === request && token === tokenStore.getToken();
    try {
      await requestConsultationCall(taskId, activeTenantId, pendingCall.request_id, { action: "cancel" });
      if (current()) setPendingCall(null);
    } catch {
      if (current()) showToast(t("doctorConsultationCallCancelFailed"), "error");
    } finally {
      if (callRequestRef.current === request) {
        callRequestRef.current = null;
        setCancellingCall(false);
      }
    }
  };

  const renderDoctorAvatar = (doctor: ConsultationDoctor | null | undefined, inMessage = false) => (
    <View style={[
      styles.doctorAvatar,
      inMessage && styles.doctorMessageAvatar,
      { backgroundColor: colors.primaryLight },
    ]}>
      <Ionicons accessible={false} name={doctor || inMessage ? "person-outline" : "medical-outline"} size={19} color={colors.primaryText} />
      {doctor?.avatar_url && <Image source={{ uri: doctor.avatar_url }} style={styles.doctorAvatarImage} />}
    </View>
  );

  useEffect(() => {
    const remaining = doctorPresenceExpiresAt - Date.now();
    if (!(remaining > 0)) return;
    const timer = setTimeout(() => setStatusClock(Date.now()), remaining + 30);
    return () => clearTimeout(timer);
  }, [doctorPresenceExpiresAt]);

  useEffect(() => {
    const followUpUntil = taskStatus?.follow_up_until;
    if (
      !followUpUntil ||
      !["completed", "cancelled", "expired"].includes(taskStatus?.status ?? "")
    )
      return;
    const expiresAt = new Date(followUpUntil).getTime();
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      setStatusClock(Date.now());
      return;
    }
    const timer = setTimeout(
      () => setStatusClock(Date.now()),
      expiresAt - Date.now() + 50
    );
    return () => clearTimeout(timer);
  }, [taskStatus?.follow_up_until, taskStatus?.status]);

  useEffect(() => {
    if (conversationOpen) return;
    if (currentStatus && draft) setDraft("");
    if (recording) {
      const activeRecording = recordingRef.current;
      if (activeRecording) {
        void activeRecording.stopAndUnloadAsync?.().catch(() => undefined);
      }
      recordingRef.current = null;
      setRecording(false);
    }
  }, [conversationOpen, currentStatus, draft, recording]);

  useEffect(() => {
    if (!taskId || !conversationOpen) return;
    let lastSignalAt: number | null = null;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const publish = (isTyping: boolean) => {
      const token = tokenStore.getToken();
      if (!token) return;
      const signalAt = lastSignalAt;
      typingSendQueue.current = typingSendQueue.current
        .then(() => {
          if (tokenStore.getToken() !== token) return;
          if (isTyping && signalAt !== lastSignalAt) return;
          return apiClient(
            `/api/doctor/tasks/${encodeURIComponent(taskId)}/messages/action`,
            {
              method: "POST",
              timeoutMs: 3_000,
              body: {
                tenant_id: activeTenantId,
                action: "typing",
                is_typing: isTyping,
              },
            },
          );
        })
        .catch(() => undefined);
    };
    const stop = () => {
      clearTimeout(idleTimer);
      if (lastSignalAt === null) return;
      lastSignalAt = null;
      publish(false);
    };
    patientTypingRef.current = {
      renew: () => {
        const now = Date.now();
        if (lastSignalAt === null || now - lastSignalAt >= 2_000) {
          lastSignalAt = now;
          publish(true);
        }
        clearTimeout(idleTimer);
        idleTimer = setTimeout(stop, 3_000);
      },
      stop,
    };
    return () => {
      patientTypingRef.current = null;
      stop();
    };
  }, [activeTenantId, conversationOpen, taskId]);

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: isDark ? colors.background : "#F5FBFC" },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Decorative medical background elements */}
      <MedicalBackground isDark={isDark} />

      {/* Standard Top Header Bar matching all app screens */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: insets.top + 6,
            backgroundColor: isDark ? colors.surface : "#F5FBFC",
            borderBottomColor: isDark ? colors.border : "#E2ECE9",
          },
        ]}
      >
        <ScreenBackButton onPress={() => router.back()} />
        {renderDoctorAvatar(assignedDoctor)}

        <View style={styles.headerInfo}>
          <Text
            style={[
              styles.headerTitle,
              { color: isDark ? colors.textPrimary : "#0F172A" },
            ]}
            numberOfLines={1}
          >
            {assignedDoctor?.name ?? t("doctorConsultationConversation")}
          </Text>
          <View style={styles.headerStatusRow}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    (showDoctorPresence ? doctorOnline : !statusIsTerminal && !statusUnknown)
                      ? "#10B981"
                      : "#94A3B8",
                },
              ]}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.headerSubtitle,
                { color: isDark ? colors.textSecondary : "#64748B" },
              ]}
            >
              {headerStatusLabel}
            </Text>
          </View>
        </View>

        <View style={styles.headerCalls}>
          {([
            { mode: "voice", icon: "call-outline", label: t("doctorConsultationVoiceCall") },
            { mode: "video", icon: "videocam-outline", label: t("doctorConsultationVideoCall") },
          ] as const).map(({ mode, icon, label }) => (
            <Pressable
              key={mode}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: !canCall || callingMode !== null || !!pendingCall, busy: callingMode === mode }}
              disabled={!canCall || callingMode !== null || !!pendingCall}
              onPress={() => void startCall(mode)}
              style={({ pressed }) => [
                styles.headerCallButton,
                pressed && styles.headerCallPressed,
              ]}
            >
              {callingMode === mode ? <ActivityIndicator size="small" color={colors.primaryText} /> : (
                <Ionicons accessible={false} name={icon} size={21} color={canCall ? colors.primaryText : colors.textSecondary} />
              )}
            </Pressable>
          ))}
        </View>
      </View>

      {pendingCall && !statusIsTerminal ? (
        <View style={[styles.pendingCall, { backgroundColor: colors.surfaceMuted }]}>
          <ActivityIndicator size="small" color={colors.primaryText} />
          <Text style={[styles.pendingCallLabel, { color: colors.textPrimary }]} accessibilityLiveRegion="polite">
            {t(pendingCall.mode === "voice" ? "doctorConsultationRingingVoice" : "doctorConsultationRingingVideo")}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: cancellingCall, busy: cancellingCall }}
            disabled={cancellingCall}
            onPress={() => void cancelCall()}
            style={styles.pendingCallCancel}
          >
            <Text style={{ color: colors.danger }}>{t("common:cancel")}</Text>
          </Pressable>
        </View>
      ) : null}

      {currentStatus === "completed" && (
        <Pressable
          accessibilityRole="button"
          style={styles.reconsultationAction}
          onPress={() => router.push({
            pathname: "/doctor-consultation",
            params: { previousTaskId: taskId, tenantId: activeTenantId },
          })}
        >
          <Text style={[styles.reconsultationText, { color: colors.primaryText }]}>{t("doctorReconsult")}</Text>
        </Pressable>
      )}
      <DoctorIvrEntry
        tenantId={activeTenantId}
        taskId={taskId}
        linkedSessionIds={messages.map((message) => message.ivr_session_id)}
      />
      {!loading && pinnedMessage && (
        <Pressable
          accessibilityRole="button"
          accessibilityHint={t("doctorConsultationJumpToMessage")}
          onPress={() => jumpToMessage(pinnedMessage.id)}
          style={[
            styles.pinnedMessageBar,
            { backgroundColor: colors.surfaceMuted, borderBottomColor: colors.border },
          ]}
        >
          <Ionicons accessible={false} name="pin-outline" size={20} color={colors.primaryText} />
          <View style={styles.pinnedMessageContent}>
            <Text style={[styles.quoteAuthor, { color: colors.textPrimary }]}>
              {t("doctorConsultationPinnedMessage")}
            </Text>
            <Text numberOfLines={1} style={[styles.quoteText, { color: colors.textSecondary }]}>
              {replyPreview(pinnedMessage)}
            </Text>
          </View>
          <Ionicons accessible={false} name="chevron-down" size={18} color={colors.textSecondary} />
        </Pressable>
      )}
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
            scrollEventThrottle={32}
            onScroll={handleThreadScroll}
            onContentSizeChange={() => {
              if (followLatest.current) scrollRef.current?.scrollToEnd({ animated: false });
            }}
          >
            {renderDatePill(dateLabel(visibleMessages[0]?.created_at))}

            {currentStatus !== "started" &&
              currentStatus !== "in_progress" &&
              currentStatus !== "waiting_user" && (
              <View
                style={[
                  styles.statusCard,
                  {
                    backgroundColor: isDark
                      ? colors.surface
                      : statusIsTerminal || statusUnknown
                      ? "#F8FAFC"
                      : "#F0FDF4",
                    borderColor: isDark
                      ? colors.border
                      : statusIsTerminal || statusUnknown
                      ? "#E2E8F0"
                      : "#BBF7D0",
                  },
                ]}
              >
                <View style={styles.statusHeading}>
                  <Ionicons
                    name={
                      statusUnknown
                        ? "time-outline"
                        : statusIsTerminal
                        ? "checkmark-circle"
                        : "pulse"
                    }
                    size={18}
                    color={
                      statusIsTerminal || statusUnknown ? "#64748B" : "#00A88F"
                    }
                  />
                  <Text
                    style={[
                      styles.statusLabel,
                      {
                        color:
                          statusIsTerminal || statusUnknown
                            ? isDark
                              ? colors.textPrimary
                              : "#334155"
                            : "#00A88F",
                      },
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
                {conversationOpen && taskStatus?.status === "completed" && (
                  <Text style={[styles.statusHint, { color: colors.textSecondary }]}>
                    {t("doctorConsultationFollowUpOpen")}
                  </Text>
                )}
                {statusUnknown && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("common:retry")}
                    onPress={() => void loadThread(true)}
                    style={{
                      minHeight: 56,
                      alignSelf: "flex-start",
                      justifyContent: "center",
                      paddingHorizontal: 16,
                    }}
                  >
                    <Text
                      style={{ color: colors.primaryText, fontWeight: "600" }}
                    >
                      {t("common:retry")}
                    </Text>
                  </Pressable>
                )}
              </View>
            )}

            {taskStatus?.consultation_summary ? (
              <View style={styles.summaryCard}>
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

            {(summary || initialRequest) && (
              <View style={[styles.bubbleWrapper, styles.patientWrapper]}>
                <View style={[
                  styles.patientCard,
                  { backgroundColor: colors.primaryLight, borderColor: colors.border },
                ]}>
                  <Text accessibilityRole="header" style={[styles.initialRequestTag, { color: colors.primaryText }]}>
                    {t("doctorConsultationInitialRequest")}
                  </Text>
                  <Text style={[styles.initialRequestContent, { color: colors.textPrimary }]}>
                    {initialRequest?.description ?? summary}
                  </Text>
                  {initialRequest && (
                    <>
                      <Text accessibilityRole="header" style={[styles.initialRequestTag, { color: colors.primaryText }]}>
                        {t("doctorConsultationDeclaredAnswers")}
                      </Text>
                      {initialRequest.answers.map(({ step, question, answer }) => (
                        <View key={step} style={styles.initialAnswer}>
                          <Text style={[styles.initialQuestion, { color: colors.textPrimary }]}>{question}</Text>
                          <Text style={[styles.initialAnswerValue, { color: colors.textPrimary }]}>{answer}</Text>
                        </View>
                      ))}
                      <Text style={[styles.initialRisk, { color: colors.primaryText }]}>{initialRequest.risk_label}</Text>
                    </>
                  )}
                </View>
              </View>
            )}

            {/* Chat Messages */}
            {visibleMessages.map((message, index) => {
              const removed = isUnsent(message);
              const newDay = index > 0 &&
                new Date(message.created_at).toDateString() !==
                  new Date(visibleMessages[index - 1].created_at).toDateString();
              const row = (content: ReactNode) => (
                <Fragment key={message.id}>
                  {newDay && renderDatePill(dateLabel(message.created_at))}
                  <View onLayout={({ nativeEvent }) => {
                    messageOffsets.current.set(message.id, nativeEvent.layout.y);
                  }}>
                    {content}
                  </View>
                </Fragment>
              );
              if (message.ivr_session_id && !removed) {
                return row(
                  <DoctorIvrInvitation
                    sessionId={message.ivr_session_id}
                    status={message.ivr_session_status}
                  />
                );
              }
              const fromPatient = message.sender_type === "patient";
              const content = removed ? "" : message.content ?? "";
              const attachment = parseAttachment(content);
              const voice = parseVoice(content);
              const messageLink = !attachment && !voice && !removed
                ? content.match(/https:\/\/[^\s<>"']+/)?.[0] ?? null
                : null;
              const isCallInvitation = message.sender_type === "doctor" && messageLink !== null &&
                /\/asinu-doctor-[\da-f]{24}\/?$/i.test(messageLink.split(/[?#]/, 1)[0]);
              const messageText = isCallInvitation
                ? content.replace(messageLink, "").trimEnd()
                : content;
              const isVoiceCallLink =
                isCallInvitation &&
                /(?:#|&)config\.startAudioOnly=true(?:&|$)/.test(messageLink ?? "");
              const timeStr = formatMessageTime(message.created_at);

              if (isSystemMessage(message)) {
                if (removed) return null;
                return row(
                  <View style={[styles.systemMessage, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={styles.systemLabelRow}>
                      <Ionicons accessible={false} name="information-circle-outline" size={16} color={colors.textSecondary} />
                      <Text style={[styles.systemLabel, { color: colors.textSecondary }]}>{t("doctorConsultationSystem")}</Text>
                    </View>
                    <Text style={[styles.systemContent, { color: colors.textPrimary }]}>{content}</Text>
                  </View>
                );
              }

              if (fromPatient) {
                return row(
                  <View
                    style={[styles.bubbleWrapper, styles.patientWrapper]}
                  >
                    {renderMessageBubble(message, <>
                      {renderMessageQuote(message)}
                      {editingMessageId === message.id ? (
                        <View style={styles.editMessageBox}>
                          <TextInput
                            autoFocus
                            maxLength={5000}
                            editable={!messageActionBusy}
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
                              disabled={messageActionBusy}
                            >
                              <Text style={styles.editCancelText}>
                                {t("doctorConsultationCancel")}
                              </Text>
                            </Pressable>
                            <Pressable
                              disabled={editMessageSaveDisabled}
                              accessibilityRole="button"
                              accessibilityState={{
                                disabled: editMessageSaveDisabled,
                                busy: messageActionBusy,
                              }}
                              style={
                                editMessageSaveDisabled &&
                                styles.editSaveDisabled
                              }
                              onPress={() =>
                                void runMessageAction(
                                  message.id,
                                  "edit",
                                  editingDraft.trim()
                                )
                              }
                            >
                              <Text style={styles.editSaveText}>
                                {t("doctorConsultationSave")}
                              </Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : removed ? (
                        <Text
                          style={[
                            styles.deletedMessageText,
                            { color: colors.textSecondary },
                          ]}
                        >
                          {t("doctorConsultationOwnMessageUnsent")}
                        </Text>
                      ) : attachment ? (
                        <View style={styles.attachmentContent}>
                          {renderAttachmentPreview(attachment, message.id)}
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
                                ? t("doctorConsultationVoiceDuration", {
                                    seconds: Math.max(
                                      1,
                                      Math.round(voice.duration_ms / 1000)
                                    ),
                                  })
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
                      {renderEditedLabel(message)}
                    </>)}
                  </View>
                );
              }

              const messageDoctor = message.sender_ref === assignedDoctor?.id ? assignedDoctor : null;
              return row(
                <View
                  style={[styles.bubbleWrapper, styles.doctorWrapper]}
                >
                  {renderDoctorAvatar(messageDoctor, true)}
                  {renderMessageBubble(message, <>
                    <Text
                      style={[
                        styles.doctorHeaderName,
                        { color: isDark ? "#48CBB5" : "#008B76" },
                      ]}
                    >
                      {messageDoctor?.name ?? t("doctorConsultationDoctor")}
                    </Text>
                    {renderMessageQuote(message)}

                    {removed ? (
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
                          editable={!messageActionBusy}
                          onChangeText={setEditingDraft}
                          style={[
                            styles.editMessageInput,
                            { color: colors.textPrimary },
                          ]}
                          value={editingDraft}
                        />
                        <View style={styles.editMessageActions}>
                          <Pressable
                            disabled={messageActionBusy}
                            onPress={() => setEditingMessageId(null)}
                          >
                            <Text style={styles.editCancelText}>
                              {t("doctorConsultationCancel")}
                            </Text>
                          </Pressable>
                          <Pressable
                            disabled={editMessageSaveDisabled}
                            accessibilityRole="button"
                            accessibilityState={{
                              disabled: editMessageSaveDisabled,
                              busy: messageActionBusy,
                            }}
                            style={
                              editMessageSaveDisabled && styles.editSaveDisabled
                            }
                            onPress={() =>
                              void runMessageAction(
                                message.id,
                                "edit",
                                editingDraft.trim()
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
                        {renderAttachmentPreview(attachment, message.id)}
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
                            ? t("doctorConsultationVoiceDuration", {
                                seconds: Math.max(
                                  1,
                                  Math.round(voice.duration_ms / 1000)
                                ),
                              })
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
                        {messageText}
                      </Text>
                    )}

                    {messageLink ? (
                      <Pressable
                        accessibilityRole="link"
                        onPress={() => {
                          if (isCallInvitation) {
                            void startCall(isVoiceCallLink ? "voice" : "video", messageLink);
                          } else {
                            void Linking.openURL(messageLink);
                          }
                        }}
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
                          name={
                            !isCallInvitation
                              ? "link-outline"
                              : isVoiceCallLink ? "call-outline" : "videocam-outline"
                          }
                          size={18}
                          color="#00A88F"
                        />
                        <Text
                          style={[styles.videoLinkText, { color: "#00A88F" }]}
                        >
                          {t(
                            !isCallInvitation
                              ? "doctorConsultationOpenLink"
                              : isVoiceCallLink
                              ? "doctorConsultationJoinVoice"
                              : "doctorConsultationJoinVideo"
                          )}
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
                    {renderEditedLabel(message)}
                  </>)}
                </View>
              );
            })}
            {focused && doctorTyping ? (
              <View
                style={styles.typingIndicator}
                accessible
                accessibilityRole="text"
                accessibilityLabel={t("doctorConsultationDoctorTyping")}
              >
                {renderDoctorAvatar(assignedDoctor, true)}
                <Text
                  style={[styles.typingText, { color: colors.textSecondary }]}
                >
                  {t("doctorConsultationDoctorTyping")}
                </Text>
                <TypingDots color={colors.primaryText} />
              </View>
            ) : null}

            {/* Rating Section if available */}
            {rateable && (
              <View style={styles.ratingCard}>
                <Text
                  style={[styles.ratingTitle, { color: colors.textPrimary }]}
                >
                  {t("doctorConsultationRateDoctor")}
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
        {conversationOpen && replyTarget && (
          <View style={[styles.replyComposer, { backgroundColor: colors.surfaceMuted }]}>
            <View style={styles.replyComposerContent}>
              <Text numberOfLines={1} style={[styles.quoteAuthor, { color: colors.textPrimary }]}>
                {t("doctorConsultationReplyingTo", { name: authorOf(replyTarget) })}
              </Text>
              <Text numberOfLines={1} style={[styles.quoteText, { color: colors.textSecondary }]}>
                {replyPreview(replyTarget)}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("doctorConsultationCancelReply")}
              onPress={() => setReplyToId(null)}
              style={styles.replyDismiss}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>
        )}
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
                ref={composerInputRef}
                multiline
                maxLength={5000}
                onBlur={() => patientTypingRef.current?.stop()}
                onChangeText={(text) => {
                  setDraft(text);
                  if (text.trim()) patientTypingRef.current?.renew();
                  else patientTypingRef.current?.stop();
                }}
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
                <ActivityIndicator color={colors.primaryText} size="small" />
              ) : (
                <Ionicons
                  name="paper-plane"
                  size={20}
                  color={colors.primaryText}
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
            {statusUnknown ? (
              <ActivityIndicator color={colors.textSecondary} size="small" />
            ) : (
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={colors.textSecondary}
              />
            )}
            <Text
              style={[
                styles.closedComposerText,
                { color: colors.textSecondary },
              ]}
            >
              {t(
                statusUnknown
                  ? "doctorConsultationStatusSyncingHint"
                  : "doctorConsultationConversationClosed"
              )}
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
      <AppActionSheetModal
        visible={actionMessage !== null}
        title={t("doctorConsultationMessageActions")}
        cancelLabel={t("doctorConsultationCancel")}
        actions={messageActions}
        headerContent={actionMessage && conversationOpen && (
          <View style={styles.reactionChoices}>
            {messageReactions.map((emoji) => {
              const selected = actionMessage.reactions?.some((item) => item.emoji === emoji && item.reacted_by_me);
              return (
                <Pressable
                  key={emoji}
                  accessibilityRole="button"
                  accessibilityLabel={`${t("doctorConsultationReact")} ${emoji}`}
                  accessibilityState={{ selected }}
                  disabled={messageActionBusy}
                  onPress={() => {
                    setActionMessage(null);
                    changeReaction(actionMessage, emoji);
                  }}
                  style={[styles.reactionChoice, {
                    backgroundColor: colors.surfaceMuted,
                    borderColor: selected ? colors.primary : colors.border,
                  }]}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        onDismiss={() => setActionMessage(null)}
      />
      <AppAlertModal
        visible={busyModalVisible}
        stackButtons
        scrollable
        title={
          reopenOpen
            ? t("doctorConsultationReopenTitle")
            : t("doctorConsultationBusyTitle")
        }
        message={
          reopenOpen
            ? t("doctorConsultationReopenMessage")
            : t("doctorConsultationBusyMessage")
        }
        icon={{ name: "clock-alert-outline", color: "#D97706" }}
        onDismiss={() => setBusyModalVisible(false)}
        buttons={
          reopenOpen
            ? [
                {
                  text: t("doctorConsultationContinue"),
                  onPress: () => setBusyModalVisible(false),
                },
                {
                  text: t("doctorConsultationBusyDismiss"),
                  style: "cancel",
                },
              ]
            : [
                {
                  text: t("doctorConsultationChooseAnother"),
                  onPress: () => router.replace("/doctor-consultation"),
                },
                {
                  text: t("doctorConsultationBusyDismiss"),
                  style: "cancel",
                },
              ]
        }
      />
      {consultationCall && !statusIsTerminal ? (
        <ConsultationCallScreen
          call={consultationCall}
          doctorName={assignedDoctor?.name}
          onClose={() => setConsultationCall(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  pendingCall: { alignItems: "center", flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  pendingCallLabel: { flex: 1 },
  pendingCallCancel: { minHeight: 44, justifyContent: "center", paddingHorizontal: 8 },
  headerBar: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
    paddingHorizontal: 12,
    zIndex: 10,
  },
  headerInfo: {
    flex: 1,
    justifyContent: "center",
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  headerStatusRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
    marginTop: 2,
  },
  statusDot: {
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  headerSubtitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "500",
  },
  doctorAvatar: {
    alignItems: "center",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    overflow: "hidden",
    width: 40,
  },
  doctorMessageAvatar: {
    borderRadius: 18,
    height: 36,
    marginTop: 2,
    width: 36,
  },
  doctorAvatarImage: {
    position: "absolute",
    width: "100%",
    height: "100%",
  },
  headerCalls: {
    flexDirection: "row",
    gap: 4,
  },
  headerCallButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  headerCallPressed: {
    opacity: 0.75,
  },
  reconsultationAction: {
    alignSelf: "flex-start",
    justifyContent: "center",
    marginHorizontal: 16,
    minHeight: 44,
  },
  reconsultationText: {
    fontSize: 15,
    fontWeight: "700",
  },
  center: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  pinnedMessageBar: {
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  pinnedMessageContent: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  messagesScroll: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  datePillContainer: {
    alignItems: "center",
    marginVertical: 10,
  },
  datePill: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  datePillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  statusCard: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    padding: 12,
  },
  statusHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  statusLabel: {
    flex: 1,
    minWidth: 0,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  statusHint: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  summaryCard: {
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingVertical: spacing.md,
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
  systemMessage: {
    alignSelf: "center",
    borderRadius: 12,
    gap: 4,
    marginBottom: 12,
    maxWidth: "92%",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  systemLabelRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
    justifyContent: "center",
  },
  systemLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  systemContent: {
    fontSize: 14,
    textAlign: "center",
  },
  patientCard: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    minWidth: 0,
    maxWidth: "94%",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  initialRequestTag: {
    fontSize: 15,
    fontWeight: "700",
  },
  initialRequestContent: {
    fontSize: 17,
    fontWeight: "600",
  },
  initialAnswer: {
    gap: 2,
  },
  initialQuestion: {
    fontSize: 15,
    fontWeight: "600",
  },
  initialAnswerValue: {
    fontSize: 16,
  },
  initialRisk: {
    fontSize: 14,
    fontWeight: "600",
  },
  patientBubbleStack: {
    minWidth: 0,
    maxWidth: "85%",
  },
  doctorBubbleStack: {
    flex: 1,
    minWidth: 0,
  },
  messageBubble: {
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 0,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  doctorHeaderName: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  messageBodyText: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 22,
  },
  messageDocument: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    minHeight: 44,
  },
  messageDocumentLabel: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  messageAttachment: {
    aspectRatio: 1,
    borderRadius: 14,
    maxWidth: "100%",
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
    gap: 8,
    maxWidth: "100%",
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
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "flex-end",
    marginTop: 6,
    maxWidth: "100%",
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
  editedLabel: {
    fontSize: 12,
    marginTop: spacing.xs,
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
  editSaveDisabled: {
    opacity: 0.4,
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
    flexShrink: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  typingIndicator: {
    alignItems: "center",
    alignSelf: "flex-start",
    flexDirection: "row",
    gap: 8,
    marginBottom: spacing.sm,
  },
  typingText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  recordingButton: {
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
  messageQuote: {
    borderRadius: radius.md,
    gap: 2,
    marginBottom: spacing.xs,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  quoteAuthor: {
    fontSize: 13,
    fontWeight: "700",
  },
  quoteText: {
    fontSize: 13,
  },
  messageReactionRow: {
    alignSelf: "flex-end",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    justifyContent: "flex-end",
    marginEnd: 6,
    marginStart: 6,
    marginTop: -8,
    zIndex: 1,
  },
  messageReactionChip: {
    alignItems: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 24,
    minWidth: 24,
    paddingHorizontal: 5,
  },
  messageReactionText: {
    fontSize: 14,
  },
  reactionChoices: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginBottom: spacing.sm,
    maxWidth: 294,
  },
  reactionChoice: {
    alignItems: "center",
    borderRadius: radius.full,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  reactionEmoji: {
    fontSize: 20,
  },
  replyComposer: {
    alignItems: "center",
    borderRadius: radius.md,
    flexDirection: "row",
    marginHorizontal: 16,
    paddingStart: spacing.md,
  },
  replyComposerContent: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingVertical: spacing.xs,
  },
  replyDismiss: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
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
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
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
    borderRadius: 25,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  ratingCard: {
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingVertical: spacing.md,
  },
  ratingTitle: { fontSize: 16, fontWeight: "800" },
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
