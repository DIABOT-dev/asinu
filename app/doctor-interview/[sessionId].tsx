import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  AppState,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import {
  Redirect,
  Stack,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Crypto from "expo-crypto";
import * as FileSystem from "expo-file-system/legacy";
import * as Speech from "expo-speech";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../src/components/ScaledText";
import { ScreenBackButton } from "../../src/components/ScreenHeaderButton";
import { AppAlertModal } from "../../src/components/AppAlertModal";
import {
  AiDataConsentModal,
  hasAiDataConsent,
} from "../../src/components/AiDataConsentModal";
import { useGuardedRouter } from "../../src/hooks/useGuardedRouter";
import { useThemeColors } from "../../src/hooks/useThemeColors";
import { useAuthStore } from "../../src/features/auth/auth.store";
import {
  ivrApi,
  type IvrSession,
  type IvrOption,
} from "../../src/features/doctor-ivr/ivr.api";
import {
  savePendingVoice,
  listPendingVoices,
  removePendingVoice,
  type PendingVoice,
} from "../../src/features/doctor-ivr/ivr-voice-queue";
import {
  CheckinCallAudio,
  type CallAudioState,
} from "../../src/features/checkin-call/checkin-call.audio";
import { canAcceptIvrSnapshot } from "../../src/features/doctor-ivr/ivr-state";
import { Audio } from "../../src/lib/audio";
import { ApiError, getApiErrorMessage } from "../../src/lib/apiClient";
import { DoctorIvrQuestion } from "../../src/features/doctor-ivr/DoctorIvrQuestion";
import { DoctorIvrBackdrop } from "../../src/features/doctor-ivr/DoctorIvrBackdrop";
import { radius, spacing } from "../../src/styles/theme";

export default function DoctorInterviewScreen() {
  const params = useLocalSearchParams<{ sessionId: string }>();
  const hydrated = useAuthStore((s) => s.hydrated),
    loading = useAuthStore((s) => s.loading),
    token = useAuthStore((s) => s.token),
    accountId = useAuthStore((s) => s.profile?.id);
  const { t } = useTranslation("home");
  const { colors } = useThemeColors();
  if (!hydrated || loading)
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.primary} />
        <Text style={{ color: colors.textPrimary }}>{t("ivr.preparing")}</Text>
      </View>
    );
  if (!token) return <Redirect href="/login" />;
  return (
    <AuthenticatedDoctorInterview
      key={JSON.stringify([accountId, params.sessionId])}
    />
  );
}
function AuthenticatedDoctorInterview() {
  const params = useLocalSearchParams<{ sessionId: string }>(),
    id = Array.isArray(params.sessionId)
      ? params.sessionId[0]
      : params.sessionId;
  const { t } = useTranslation("home"),
    router = useGuardedRouter();
  const owner = useAuthStore((s) => s.profile?.id),
    token = useAuthStore((s) => s.token);
  const [session, setSession] = useState<IvrSession | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false),
    [seconds, setSeconds] = useState(0),
    [voiceOption, setVoiceOption] = useState<IvrOption | null>(null),
    [pending, setPending] = useState<PendingVoice[]>([]);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [consentVisible, setConsentVisible] = useState(false),
    [aiConsent, setAiConsent] = useState(false),
    [audioState, setAudioState] = useState<CallAudioState>({
      phase: "idle",
      prompt: null,
      fallback: false,
    });
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const contentScroll = useRef<ScrollView | null>(null);
  const focused = useRef(false),
    screenEpoch = useRef(0),
    state = useRef(session),
    inFlight = useRef(false),
    recorder = useRef<
      | Awaited<ReturnType<typeof Audio.Recording.createAsync>>["recording"]
      | null
    >(null);
  const recordingStart = useRef(0),
    lastSound = useRef(0),
    heardSound = useRef(false),
    recordRetry = useRef<Record<string, number>>({}),
    voiceStartVersion = useRef(0);
  const finishRecording = useRef<() => Promise<void>>(async () => {}),
    pendingOption = useRef<IvrOption | null>(null),
    audio = useRef<CheckinCallAudio | null>(null),
    queueBusy = useRef(false);
  const files = useRef(new Set<string>()),
    closingPlayed = useRef(false);
  state.current = session;
  const promptWaiter = useRef<{ key: string; finish: () => void } | null>(null);
  const cue = useRef<
    Awaited<ReturnType<typeof Audio.Sound.createAsync>>["sound"] | null
  >(null);
  const waitForSpeech = useCallback(
    (key: string, text: string, limit: number) =>
      new Promise<void>((resolve) => {
        promptWaiter.current?.finish();
        const finish = () => {
          clearTimeout(timer);
          if (promptWaiter.current?.key === key) promptWaiter.current = null;
          resolve();
        };
        const timer = setTimeout(() => {
          void audio.current?.stop();
          finish();
        }, limit);
        promptWaiter.current = { key, finish };
        if (!audio.current) {
          finish();
          return;
        }
        void audio.current.play({ key, text, language: "vi" }).catch(finish);
      }),
    []
  );
  const recordingConsented = useRef(false);
  const close = () => {
    void audio.current?.stop();
    void stopRecording();
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/home");
  };
  const validId = /^[0-9a-f-]{36}$/iu.test(id || "");
  const accept = useCallback((value: IvrSession) => {
    if (focused.current && canAcceptIvrSnapshot(state.current, value)) {
      setSession(value);
      state.current = value;
    }
  }, []);
  const fail = (e: unknown) => {
    if (focused.current) setError(getApiErrorMessage(e, t, "ivr.error"));
  };
  const stopRecording = useCallback(async () => {
    voiceStartVersion.current++;
    const current = recorder.current;
    const tone = cue.current;
    cue.current = null;
    if (tone) {
      await tone.pauseAsync().catch(() => {});
      await tone.unloadAsync().catch(() => {});
    }
    recorder.current = null;
    if (current) {
      await current.stopAndUnloadAsync().catch(() => {});
      const uri = current.getURI();
      if (uri)
        await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: false,
    }).catch(() => {});
    if (focused.current) {
      setRecording(false);
      setSeconds(0);
    }
  }, []);
  const load = useCallback(async () => {
    if (!validId) return;
    const epoch = screenEpoch.current;
    try {
      const value = await ivrApi.get(id);
      if (focused.current && epoch === screenEpoch.current) {
        // A poll already in flight must not reveal the next question while
        // the saved answer is still being read back to the patient.
        if (!inFlight.current) accept(value);
        setLoading(false);
      }
    } catch (e) {
      if (focused.current && epoch === screenEpoch.current) {
        setError(getApiErrorMessage(e, t, "ivr.error"));
        setLoading(false);
      }
    }
  }, [id, t, validId, accept]);
  useEffect(() => {
    const cache = new Map<string, string>();
    let disposed = false;
    const player = new CheckinCallAudio({
      load: async (prompt) => {
        if (!prompt.key.startsWith("question:"))
          throw new Error("Device speech");
        const question = prompt.key.slice("question:".length);
        if (cache.has(question)) return cache.get(question)!;
        const value = await ivrApi.audio(id, question);
        const uri = `${FileSystem.cacheDirectory}ivr-${Crypto.randomUUID()}.${
          value.mimeType.includes("wav")
            ? "wav"
            : value.mimeType.includes("mp4") || value.mimeType.includes("m4a")
            ? "m4a"
            : "mp3"
        }`;
        files.current.add(uri);
        await FileSystem.writeAsStringAsync(uri, value.base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (disposed) {
          files.current.delete(uri);
          await FileSystem.deleteAsync(uri, { idempotent: true });
          throw new Error("Playback ended");
        }
        cache.set(question, uri);
        return uri;
      },
      invalidate: async (prompt) => {
        const question = prompt.key.slice("question:".length),
          uri = cache.get(question);
        cache.delete(question);
        if (uri) {
          files.current.delete(uri);
          await FileSystem.deleteAsync(uri, { idempotent: true });
        }
      },
      prepare: () =>
        Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        }),
      create: async (uri) => {
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: false }
        );
        await sound.setRateAsync(0.9);
        return sound;
      },
      stopSpeech: () => Speech.stop(),
      speak: (prompt, callbacks) =>
        Speech.speak(prompt.text, {
          language: "vi-VN",
          rate: 0.9,
          onStart: callbacks.onStart,
          onDone: callbacks.onDone,
          onError: callbacks.onError,
          onStopped: callbacks.onDone,
        }),
      onState: (value) => {
        if (focused.current) setAudioState(value);
        if (
          value.prompt?.key === promptWaiter.current?.key &&
          ["finished", "error", "idle"].includes(value.phase)
        )
          promptWaiter.current?.finish();
      },
    });
    audio.current = player;
    return () => {
      disposed = true;
      promptWaiter.current?.finish();
      audio.current = null;
      void player.dispose();
      for (const uri of files.current)
        void FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      files.current.clear();
    };
  }, [id, owner, token]);
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      screenEpoch.current++;
      void load();
      const subscription = AppState.addEventListener("change", (next) => {
        if (next !== "active") {
          focused.current = false;
          screenEpoch.current++;
          voiceStartVersion.current++;
          promptWaiter.current?.finish();
          void audio.current?.stop();
          void stopRecording();
        } else {
          focused.current = true;
          if (!inFlight.current) setBusy(false);
          setSelectedOption(null);
          setAudioState({ phase: "idle", prompt: null, fallback: false });
          setRecording(false);
          setVoiceOption(null);
          void load();
        }
      });
      return () => {
        focused.current = false;
        screenEpoch.current++;
        voiceStartVersion.current++;
        promptWaiter.current?.finish();
        subscription.remove();
        void audio.current?.stop();
        void stopRecording();
      };
    }, [load, stopRecording, owner, token])
  );
  useEffect(() => {
    if (!validId) {
      setLoading(false);
      setError(t("ivr.error"));
    }
  }, [validId, t]);
  const act = async (input: Record<string, unknown>, confirmation?: string) => {
    if (inFlight.current || !focused.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const epoch = screenEpoch.current;
    try {
      // Save immediately, including red flags. Hold only the visual transition
      // until the short readback ends; use the same serialized audio owner.
      void audio.current?.stop();
      const value = await ivrApi.act(id, input);
      if (focused.current && epoch === screenEpoch.current) {
        if (confirmation)
          await waitForSpeech(
            `selected:${input.request_id}`,
            confirmation,
            10000
          );
        if (focused.current && epoch === screenEpoch.current) accept(value);
      }
      return value;
    } catch (e) {
      fail(e);
      if (e instanceof ApiError && e.statusCode === 409) void load();
      return undefined;
    } finally {
      inFlight.current = false;
      if (focused.current) {
        setBusy(false);
        if (epoch !== screenEpoch.current) void load();
      }
    }
  };
  const refreshQueue = useCallback(async () => {
    if (!owner) return;
    const values = await listPendingVoices(String(owner), id);
    if (focused.current && useAuthStore.getState().profile?.id === owner)
      setPending((current) =>
        JSON.stringify(current) === JSON.stringify(values) ? current : values
      );
  }, [id, owner]);
  const retryUploads = useCallback(async () => {
    if (!owner || queueBusy.current || !focused.current || inFlight.current)
      return;
    queueBusy.current = true;
    try {
      for (const value of await listPendingVoices(String(owner), id)) {
        if (!focused.current || useAuthStore.getState().profile?.id !== owner)
          break;
        try {
          const updated = await ivrApi.voice(id, value.fields, value.uri);
          await removePendingVoice(value);
          if (focused.current && !inFlight.current) {
            accept(updated);
          }
        } catch (e) {
          if (
            e instanceof ApiError &&
            [401, 403, 404, 410].includes(e.statusCode)
          ) {
            fail(e);
            break;
          }
          break;
        }
      }
    } finally {
      queueBusy.current = false;
      await refreshQueue();
    }
  }, [id, owner, refreshQueue, accept]);
  useEffect(() => {
    void refreshQueue();
    const timer = setInterval(() => {
      if (focused.current) {
        void retryUploads();
        if (!inFlight.current && !recorder.current) void load();
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [load, refreshQueue, retryUploads]);
  const q = session?.content.questions.find(
      (q) => q.id === session.current_question_id
    ),
    index = q ? session!.content.questions.indexOf(q) : 0;
  const replay = useCallback(() => {
    const value = state.current,
      question = value?.content.questions.find(
        (q) => q.id === value.current_question_id
      );
    if (!focused.current || !question || recorder.current || inFlight.current)
      return;
    const text =
      question.speech_text ||
      `${index === 0 ? value?.content.greeting || "" : ""} ${
        question.text
      } ${question.options.map((o) => `${o.key}. ${o.label}.`).join(" ")}`;
    void audio.current?.play({
      key: `question:${question.id}`,
      text,
      language: "vi",
    });
  }, [index]);
  useEffect(() => {
    if (session?.status === "in_progress" && q && !recording && !voiceOption) {
      replay();
    }
    return () => {
      void audio.current?.stop();
    };
  }, [session?.status, q?.id, replay]);
  const select = async (option: IvrOption) => {
    const current = state.current;
    const question = current?.content.questions.find(
      (item) => item.id === current.current_question_id
    );
    if (
      inFlight.current ||
      !focused.current ||
      busy ||
      recording ||
      voiceOption ||
      pending.some((p) => p.fields.question_id === question?.id) ||
      !current ||
      !question ||
      !question.options.some((item) => item.id === option.id)
    )
      return;
    setSelectedOption(option.id);
    if (option.type === "voice") {
      inFlight.current = true;
      setBusy(true);
      void audio.current?.stop();
      pendingOption.current = option;
      setVoiceOption(option);
      const epoch = screenEpoch.current;
      try {
        const consented = await hasAiDataConsent();
        if (!focused.current || epoch !== screenEpoch.current) return;
        if (!consented) setAiConsent(true);
        else if (recordingConsented.current) await beginRecording();
        else setConsentVisible(true);
      } catch (e) {
        fail(e);
        if (focused.current) setVoiceOption(null);
      } finally {
        inFlight.current = false;
        if (focused.current) {
          setBusy(false);
          setSelectedOption(null);
        }
      }
      return;
    }
    try {
      await act(
        {
          action: "answer",
          question_id: question.id,
          option_id: option.id,
          request_id: Crypto.randomUUID(),
          revision: current.revision,
        },
        t("ivr.selected", { answer: option.label })
      );
    } finally {
      if (focused.current) setSelectedOption(null);
    }
  };
  const sendSkip = async (
    reason: "no_speech" | "no_response" | "user_skip"
  ) => {
    const value = state.current;
    if (!value?.current_question_id || inFlight.current || !focused.current)
      return;
    setVoiceOption(null);
    await act({
      action: "answer",
      question_id: value.current_question_id,
      revision: value.revision,
      request_id: Crypto.randomUUID(),
      skip_reason: reason,
    });
  };
  // In-app patients may need time to read, think or ask someone nearby.
  // Silence never submits an answer. Only an explicit tap may skip a question.
  useLayoutEffect(() => {
    contentScroll.current?.scrollTo({ y: 0, animated: false });
  }, [q?.id]);
  const beginRecording = async () => {
    recordingConsented.current = true;
    setConsentVisible(false);
    const option = pendingOption.current,
      value = state.current;
    if (!option || !value?.current_question_id || !focused.current) return;
    // AppAlertModal dismisses before invoking Agree. Restore the active option
    // so its recording limit (60 seconds for the final question) survives dismissal.
    setVoiceOption(option);
    const version = ++voiceStartVersion.current;
    setBusy(true);
    setError(null);
    try {
      await audio.current?.stop();
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setError(t("ivr.microphone"));
        setVoiceOption(null);
        return;
      }
      if (!focused.current || version !== voiceStartVersion.current) return;
      // Keep the instruction and beep outside the recording.
      await waitForSpeech(
        `instruction:${Crypto.randomUUID()}`,
        t("ivr.recordInstruction"),
        6000
      );
      if (!focused.current || version !== voiceStartVersion.current) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      const beep = (
        await Audio.Sound.createAsync(
          require("../../assets/sounds/ivr_beep.wav"),
          { shouldPlay: false }
        )
      ).sound;
      if (!focused.current || version !== voiceStartVersion.current) {
        await beep.unloadAsync();
        return;
      }
      cue.current = beep;
      beep.play();
      await new Promise<void>((resolve) => setTimeout(resolve, 180));
      if (cue.current === beep) cue.current = null;
      await beep.unloadAsync().catch(() => {});
      if (!focused.current || version !== voiceStartVersion.current) return;
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      heardSound.current = false;
      lastSound.current = Date.now();
      recordingStart.current = Date.now();
      const result = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (status) => {
          if (typeof status.metering === "number" && status.metering > -42) {
            heardSound.current = true;
            lastSound.current = Date.now();
          }
        }
      );
      if (!focused.current || version !== voiceStartVersion.current) {
        await result.recording.stopAndUnloadAsync();
        const uri = result.recording.getURI();
        if (uri) await FileSystem.deleteAsync(uri, { idempotent: true });
        return;
      }
      recorder.current = result.recording;
      setRecording(true);
      setSeconds(option.max_record_s || 30);
    } catch (e) {
      fail(e);
      setVoiceOption(null);
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(
        () => {}
      );
    } finally {
      if (focused.current) setBusy(false);
    }
  };
  finishRecording.current = async () => {
    const current = recorder.current,
      value = state.current,
      option = pendingOption.current;
    if (!current || !value || !option || !owner) return;
    recorder.current = null;
    inFlight.current = true;
    setBusy(true);
    setRecording(false);
    const elapsed = (Date.now() - recordingStart.current) / 1000,
      question = value.current_question_id!;
    try {
      await current.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
      });
      const uri = current.getURI();
      if (!uri) throw new Error("Missing recording");
      if (elapsed < 1 || !heardSound.current) {
        await FileSystem.deleteAsync(uri, { idempotent: true });
        recordRetry.current[question] =
          (recordRetry.current[question] || 0) + 1;
        setVoiceOption(null);
        inFlight.current = false;
        setBusy(false);
        if (recordRetry.current[question] < 2) {
          setError(t("ivr.silence"));
          setVoiceOption(option);
          setConsentVisible(true);
        } else await sendSkip("no_speech");
        return;
      }
      const fields = {
        question_id: question,
        option_id: option.id,
        request_id: Crypto.randomUUID(),
        revision: String(value.revision),
        duration_s: String(elapsed),
        recording_consent: "true",
      };
      const queued = await savePendingVoice(String(owner), id, uri, fields);
      await FileSystem.deleteAsync(uri, { idempotent: true });
      if (useAuthStore.getState().profile?.id !== owner) {
        await removePendingVoice(queued);
        return;
      }
      try {
        const updated = await ivrApi.voice(id, fields, queued.uri);
        await removePendingVoice(queued);
        accept(updated);
      } catch (e) {
        // Reserve this voice answer with a small request; the original remains in
        // the private app directory and retries with the same idempotency key.
        try {
          accept(
            await ivrApi.act(id, {
              ...fields,
              action: "answer",
              revision: value.revision,
              voice_pending: true,
              recording_consent: true,
            })
          );
        } catch {
          fail(e);
        }
      }
      setVoiceOption(null);
      await refreshQueue();
    } catch (e) {
      fail(e);
    } finally {
      inFlight.current = false;
      if (focused.current) {
        setBusy(false);
        setVoiceOption(null);
      }
    }
  };
  useEffect(() => {
    if (!recording) return;
    const maximum = voiceOption?.max_record_s || 30;
    const timer = setInterval(() => {
      const elapsed = (Date.now() - recordingStart.current) / 1000;
      setSeconds(Math.max(0, Math.ceil(maximum - elapsed)));
      if (
        elapsed >= maximum ||
        (heardSound.current && Date.now() - lastSound.current >= 3000) ||
        (!heardSound.current && elapsed >= 6)
      )
        void finishRecording.current();
    }, 200);
    return () => clearInterval(timer);
  }, [recording, voiceOption?.max_record_s]);
  useEffect(() => {
    if (
      !session ||
      !["completed", "reported"].includes(session.status) ||
      closingPlayed.current
    )
      return;
    closingPlayed.current = true;
    void audio.current?.play({
      key: "closing",
      text: [session.content.closing, session.safety_notice]
        .filter(Boolean)
        .join(" "),
      language: "vi",
    });
  }, [session?.status, session?.safety_notice]);
  return (
    <DoctorInterviewView
      state={{
        session,
        error,
        busy,
        loading,
        recording,
        seconds,
        voiceOption,
        pending,
        remindersOpen,
        consentVisible,
        aiConsent,
        audioState,
        selectedOption,
      }}
      actions={{
        close,
        load,
        retryUploads,
        act,
        select,
        replay,
        sendSkip,
        finishRecording,
        audio,
        setError,
        setRemindersOpen,
        setAiConsent,
        setConsentVisible,
        setVoiceOption,
        beginRecording,
      }}
      contentScroll={contentScroll}
    />
  );
}

export type DoctorInterviewViewState = {
  session: IvrSession | null;
  error: string | null;
  busy: boolean;
  loading: boolean;
  recording: boolean;
  seconds: number;
  voiceOption: IvrOption | null;
  pending: PendingVoice[];
  remindersOpen: boolean;
  consentVisible: boolean;
  aiConsent: boolean;
  audioState: CallAudioState;
  selectedOption: string | null;
};
export type DoctorInterviewViewActions = {
  close: () => void;
  load: () => Promise<void>;
  retryUploads: () => Promise<void>;
  act: (input: Record<string, unknown>) => Promise<unknown>;
  select: (option: IvrOption) => Promise<void>;
  replay: () => void;
  sendSkip: (
    reason: "no_speech" | "no_response" | "user_skip"
  ) => Promise<void>;
  finishRecording: { current: () => Promise<void> };
  audio: { current: Pick<CheckinCallAudio, "play" | "stop"> | null };
  setError: Dispatch<SetStateAction<string | null>>;
  setRemindersOpen: Dispatch<SetStateAction<boolean>>;
  setAiConsent: Dispatch<SetStateAction<boolean>>;
  setConsentVisible: Dispatch<SetStateAction<boolean>>;
  setVoiceOption: Dispatch<SetStateAction<IvrOption | null>>;
  beginRecording: () => Promise<void>;
};

// The live route and development gallery render this exact native view.
// Only their state/actions differ; this component performs no API or storage calls.
export function DoctorInterviewView({
  state,
  actions,
  contentScroll,
}: {
  state: DoctorInterviewViewState;
  actions: DoctorInterviewViewActions;
  contentScroll?: RefObject<ScrollView | null>;
}) {
  const {
    session,
    error,
    busy,
    loading,
    recording,
    seconds,
    voiceOption,
    pending,
    remindersOpen,
    consentVisible,
    aiConsent,
    audioState,
    selectedOption,
  } = state;
  const {
    close,
    load,
    retryUploads,
    act,
    select,
    replay,
    sendSkip,
    finishRecording,
    audio,
    setError,
    setRemindersOpen,
    setAiConsent,
    setConsentVisible,
    setVoiceOption,
    beginRecording,
  } = actions;
  const { t } = useTranslation("home"),
    insets = useSafeAreaInsets(),
    { colors, isDark } = useThemeColors();
  const q = session?.content.questions.find(
    (question) => question.id === session.current_question_id
  );
  const index = q ? session!.content.questions.indexOf(q) : 0;
  const textColor = { color: colors.textPrimary };
  const button = (
    label: string,
    handler: () => void,
    secondary = false,
    disabled = false
  ) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy || disabled}
      onPress={handler}
      accessibilityState={{ disabled: busy || disabled, busy }}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: secondary ? colors.surface : colors.primaryDark,
          borderColor: secondary ? colors.primary + "30" : colors.primaryDark,
          opacity: busy || disabled ? 0.5 : pressed ? 0.82 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.buttonText,
          { color: secondary ? colors.primaryText : "#f8fffd" },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
  const terminal =
    !!session && !["draft", "sent", "in_progress"].includes(session.status);
  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: isDark ? colors.background : "#f3fbf8" },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <DoctorIvrBackdrop />
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 6,
          },
        ]}
      >
        <ScreenBackButton
          onPress={close}
          style={{ backgroundColor: colors.surface }}
        />
        <View style={styles.flex}>
          <Text style={[styles.headerText, textColor]}>{t("ivr.title")}</Text>
          {session && (
            <Text
              style={[styles.headerSubtitle, { color: colors.textSecondary }]}
              numberOfLines={2}
            >
              {t("ivr.doctor", {
                name: session.doctor_name.replace(
                  /^(?:bác sĩ|bs\.?|dr\.?)\s+/iu,
                  ""
                ),
              })}
            </Text>
          )}
        </View>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.brandMark}
          accessibilityIgnoresInvertColors
        />
      </View>
      <ScrollView
        ref={contentScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
      >
        {loading && <ActivityIndicator size="large" color={colors.primary} />}
        {error && (
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text accessibilityRole="alert" style={textColor}>
              {error}
            </Text>
            {button(
              t("ivr.retry"),
              () => {
                setError(null);
                void load();
                void retryUploads();
              },
              true
            )}
          </View>
        )}
        {!!pending.length && (
          <View
            style={[
              styles.notice,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text style={textColor}>{t("ivr.pendingUpload")}</Text>
            {button(t("ivr.retryUpload"), () => void retryUploads(), true)}
          </View>
        )}
        {session?.status === "draft" && (
          <>
            <ActivityIndicator color={colors.primary} />
            <Text style={textColor}>{t("ivr.preparing")}</Text>
            {button(t("ivr.retry"), () => void load(), true)}
          </>
        )}
        {session?.status === "sent" && (
          <>
            <View
              style={[
                styles.hero,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.primary + "25",
                  shadowColor: colors.primaryText,
                },
              ]}
            >
              <View
                style={[
                  styles.heroIcon,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Image
                  source={require("../../assets/icon.png")}
                  style={styles.invitationLogo}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.question, styles.centerText, textColor]}>
                {t("ivr.invitation")}
              </Text>
              <Text
                style={[
                  styles.body,
                  styles.centerText,
                  { color: colors.textSecondary },
                ]}
              >
                {t("ivr.intro")}
              </Text>
              <View
                style={[
                  styles.sessionPill,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Ionicons
                  name="list-outline"
                  size={18}
                  color={colors.primaryText}
                />
                <Text
                  style={[styles.sessionInfo, { color: colors.primaryText }]}
                >
                  {t("ivr.questionCount", {
                    count: session.content.questions.length,
                  })}
                </Text>
              </View>
              {button(t("ivr.start"), () => void act({ action: "start" }))}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: remindersOpen }}
              onPress={() => setRemindersOpen((value) => !value)}
              style={styles.laterToggle}
            >
              <Ionicons
                name="time-outline"
                size={20}
                color={colors.textSecondary}
              />
              <Text
                style={[styles.secondaryLabel, { color: colors.textSecondary }]}
              >
                {t("ivr.remind")}
              </Text>
              <Ionicons
                name={remindersOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
            {remindersOpen &&
              [15, 60, "tonight"].map((delay) => (
                <View key={delay}>
                  {button(
                    t(
                      delay === 15
                        ? "ivr.in15"
                        : delay === 60
                        ? "ivr.in60"
                        : "ivr.tonight"
                    ),
                    () => void act({ action: "snooze", minutes: delay }),
                    true
                  )}
                </View>
              ))}
            {session.remind_at && (
              <Text style={{ color: colors.primary }}>
                {t("ivr.reminderSaved")}
              </Text>
            )}
          </>
        )}
        {session?.status === "in_progress" && q && (
          <>
            <DoctorIvrQuestion
              question={q}
              index={index}
              total={session.content.questions.length}
              disabled={
                busy ||
                recording ||
                !!voiceOption ||
                pending.some((p) => p.fields.question_id === q.id)
              }
              selectedOptionId={selectedOption}
              audioPhase={audioState.phase}
              recording={recording}
              onSelect={(option) => void select(option)}
              onReplay={replay}
              onStopAudio={() => void audio.current?.stop()}
            />
            {!recording &&
              !q.fixed &&
              !q.options.some((option) => option.unknown) && (
                <Pressable
                  accessibilityRole="button"
                  disabled={
                    busy ||
                    !!voiceOption ||
                    pending.some((p) => p.fields.question_id === q.id)
                  }
                  onPress={() => void sendSkip("user_skip")}
                  style={({ pressed }) => [
                    styles.skip,
                    { opacity: pressed || busy || !!voiceOption ? 0.5 : 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.secondaryLabel,
                      { color: colors.textSecondary },
                    ]}
                  >
                    {t("ivr.skip")}
                  </Text>
                </Pressable>
              )}
            {voiceOption && !recording && (
              <Text style={[styles.body, textColor]}>
                {t("ivr.recordReady")}
              </Text>
            )}
            {recording && (
              <View
                onLayout={() =>
                  contentScroll?.current?.scrollToEnd({ animated: true })
                }
                style={[
                  styles.recorder,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.primary + "30",
                  },
                ]}
              >
                <View
                  style={[
                    styles.recordingRing,
                    {
                      backgroundColor: colors.primaryLight,
                      borderColor: colors.primary + "25",
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.recordingIcon,
                      { backgroundColor: colors.surface },
                    ]}
                  >
                    <Ionicons name="mic" color={colors.primaryText} size={36} />
                  </View>
                </View>
                <Text
                  style={[
                    styles.body,
                    styles.centerText,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("ivr.recordHint")}
                </Text>
                <View style={styles.recordingTime}>
                  <View
                    style={[
                      styles.recordingDot,
                      { backgroundColor: colors.danger },
                    ]}
                  />
                  <Text
                    style={[styles.question, textColor]}
                    accessibilityLiveRegion="polite"
                  >
                    {t("ivr.recording", { seconds })}
                  </Text>
                </View>
                <View
                  style={[
                    styles.recordingTrack,
                    { backgroundColor: colors.primaryLight },
                  ]}
                >
                  <View
                    style={[
                      styles.recordingFill,
                      {
                        backgroundColor: colors.primary,
                        width: `${Math.min(
                          100,
                          Math.max(
                            0,
                            (seconds / (voiceOption?.max_record_s || 30)) * 100
                          )
                        )}%`,
                      },
                    ]}
                  />
                </View>
                {button(
                  t("ivr.finishRecording"),
                  () => void finishRecording.current()
                )}
              </View>
            )}
            {index > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("ivr.previous")}
                accessibilityState={{
                  disabled: busy || recording || !!voiceOption,
                }}
                disabled={busy || recording || !!voiceOption}
                onPress={() =>
                  void act({ action: "back", revision: session.revision })
                }
                style={({ pressed }) => [
                  styles.previous,
                  {
                    opacity:
                      pressed || busy || recording || !!voiceOption ? 0.5 : 1,
                  },
                ]}
              >
                <Ionicons
                  name="arrow-back"
                  size={19}
                  color={colors.textSecondary}
                />
                <Text
                  style={[
                    styles.secondaryLabel,
                    { color: colors.textSecondary },
                  ]}
                >
                  {t("ivr.previous")}
                </Text>
              </Pressable>
            )}
          </>
        )}
        {terminal && session && (
          <View
            style={[
              styles.hero,
              {
                backgroundColor: colors.surface,
                borderColor: colors.primary + "25",
                shadowColor: colors.primaryText,
              },
            ]}
          >
            {["completed", "reported", "replied", "closed"].includes(
              session.status
            ) ? (
              <Image
                source={require("../../assets/images/checkin-call/checkin_success_art.png")}
                style={styles.resultArt}
                resizeMode="contain"
                accessible={false}
              />
            ) : (
              <View
                style={[
                  styles.heroIcon,
                  { backgroundColor: colors.primaryLight },
                ]}
              >
                <Ionicons
                  name="document-text-outline"
                  size={40}
                  color={colors.primaryText}
                />
              </View>
            )}
            <Text style={[styles.question, styles.centerText, textColor]}>
              {t(
                session.doctor_reply
                  ? "ivr.result"
                  : ["completed", "reported"].includes(session.status)
                  ? "ivr.finished"
                  : "ivr.ended"
              )}
            </Text>
            <Text
              style={[
                styles.body,
                !session.doctor_reply && styles.centerText,
                textColor,
              ]}
            >
              {session.doctor_reply ||
                t(
                  ["completed", "reported"].includes(session.status)
                    ? "ivr.waitDoctor"
                    : "ivr.contactDoctor"
                )}
            </Text>
            {!!session.safety_notice && (
              <Text style={[styles.body, { color: colors.danger }]}>
                {session.safety_notice}
              </Text>
            )}
            {session.doctor_reply &&
              button(
                t("ivr.listenResult"),
                () =>
                  void audio.current?.play({
                    key: "reply",
                    text: session.doctor_reply!,
                    language: "vi",
                  }),
                true
              )}
            {session.status === "replied" &&
              button(t("ivr.understood"), () => void act({ action: "ack" }))}
            {button(t("ivr.close"), close, true)}
          </View>
        )}
        {session?.status !== "in_progress" &&
          (audioState.phase === "playing" || audioState.phase === "loading") &&
          button(t("ivr.stopAudio"), () => void audio.current?.stop(), true)}
      </ScrollView>
      <AiDataConsentModal
        visible={aiConsent}
        onAgree={() => {
          setAiConsent(false);
          setConsentVisible(true);
        }}
        onDecline={() => {
          setAiConsent(false);
          setVoiceOption(null);
        }}
      />
      <AppAlertModal
        visible={consentVisible}
        title={t("ivr.consentTitle")}
        message={t("ivr.consentBody")}
        onDismiss={() => {
          setConsentVisible(false);
          setVoiceOption(null);
        }}
        buttons={[
          {
            text: t("ivr.cancel"),
            style: "cancel",
            onPress: () => {
              setConsentVisible(false);
              setVoiceOption(null);
            },
          },
          { text: t("ivr.agree"), onPress: () => void beginRecording() },
        ]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerText: { fontSize: 18, fontWeight: "700", letterSpacing: -0.2 },
  headerSubtitle: { fontSize: 14, lineHeight: 20, marginTop: 2 },
  brandMark: { width: 40, height: 40, borderRadius: radius.md },
  content: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.lg,
    flexGrow: 1,
  },
  hero: {
    padding: spacing.xxl,
    borderRadius: radius.xxl,
    borderWidth: 1,
    gap: spacing.lg,
    marginTop: spacing.md,
    shadowOpacity: 0.05,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  heroIcon: {
    width: 96,
    height: 96,
    borderRadius: radius.full,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  invitationLogo: { width: 68, height: 68, borderRadius: radius.lg },
  resultArt: { width: 210, height: 110, alignSelf: "center" },
  centerText: { textAlign: "center" },
  sessionPill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  sessionInfo: { fontSize: 16, fontWeight: "600" },
  question: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.4,
  },
  body: { fontSize: 20, lineHeight: 30 },
  button: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: radius.full,
    padding: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "stretch",
  },
  buttonText: { fontSize: 20, fontWeight: "600", textAlign: "center" },
  secondaryLabel: { fontSize: 16, lineHeight: 23, flexShrink: 1 },
  skip: {
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  recorder: {
    borderWidth: 1,
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  recordingRing: {
    width: 104,
    height: 104,
    borderRadius: radius.full,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  recordingIcon: {
    width: 76,
    height: 76,
    borderRadius: radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  recordingTime: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  recordingDot: { width: 8, height: 8, borderRadius: radius.full },
  recordingTrack: { height: 6, overflow: "hidden", borderRadius: radius.full },
  recordingFill: { height: 6, borderRadius: radius.full },
  laterToggle: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.sm,
  },
  previous: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  notice: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
});
