import { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Stack, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Speech from "expo-speech";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  DoctorInterviewView,
  type DoctorInterviewViewState,
  type DoctorInterviewViewActions,
} from "../../../app/doctor-interview/[sessionId]";
import { ScaledText as Text } from "../../components/ScaledText";
import { ScreenBackButton } from "../../components/ScreenHeaderButton";
import { useGuardedRouter } from "../../hooks/useGuardedRouter";
import { useThemeColors } from "../../hooks/useThemeColors";
import { radius, spacing } from "../../styles/theme";
import {
  CheckinCallAudio,
  type CallAudioPrompt,
} from "../checkin-call/checkin-call.audio";
import type { IvrSession, IvrOption } from "./ivr.api";
import { DoctorIvrBackdrop } from "./DoctorIvrBackdrop";

export const DOCTOR_IVR_PREVIEW_SCENARIOS = [
  "invitation",
  "question",
  "recording30",
  "recording60",
  "waiting",
  "result",
  "error",
] as const;
type Scenario = (typeof DOCTOR_IVR_PREVIEW_SCENARIOS)[number];

// This controller only changes in-memory examples. The production native view
// is shared verbatim; there is no auth bypass, API call, upload or microphone use.
export function DoctorIvrPreview() {
  const [selected, setSelected] = useState<Scenario | null>(null);
  const router = useGuardedRouter(),
    { colors } = useThemeColors(),
    insets = useSafeAreaInsets();
  const { t } = useTranslation("home");
  useFocusEffect(
    useCallback(() => {
      if (!selected) return;
      const back = BackHandler.addEventListener("hardwareBackPress", () => {
        setSelected(null);
        return true;
      });
      return () => back.remove();
    }, [selected])
  );
  if (selected)
    return (
      <PreviewSession
        key={selected}
        scenario={selected}
        onClose={() => setSelected(null)}
      />
    );
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      <DoctorIvrBackdrop />
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <ScreenBackButton onPress={() => router.back()} />
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t("ivr.preview.title")}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.menu,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
      >
        <Text style={[styles.notice, { color: colors.textSecondary }]}>
          {t("ivr.preview.notice")}
        </Text>
        {DOCTOR_IVR_PREVIEW_SCENARIOS.map((scenario) => (
          <Pressable
            key={scenario}
            accessibilityRole="button"
            onPress={() => setSelected(scenario)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <View style={styles.copy}>
              <Text style={[styles.rowTitle, { color: colors.textPrimary }]}>
                {t(`ivr.preview.${scenario}`)}
              </Text>
              <Text style={{ color: colors.textSecondary }}>
                {t(`ivr.preview.${scenario}Hint`)}
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={22}
              color={colors.primaryText}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function PreviewSession({
  scenario,
  onClose,
}: {
  scenario: Scenario;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation("home");
  const makeOption = (id: string, key: number, label: string): IvrOption => ({
    id,
    key,
    label,
    type: "option",
  });
  const voice = (id: string, key: number, max_record_s: number): IvrOption => ({
    id,
    key,
    label: t("ivr.preview.other"),
    type: "voice",
    max_record_s,
  });
  const [state, setState] = useState<DoctorInterviewViewState>(() => {
    const questions = [
      {
        id: "q1",
        text: t("ivr.preview.sleepQuestion"),
        options: [
          makeOption("q1_a", 1, t("ivr.preview.often")),
          makeOption("q1_b", 2, t("ivr.preview.sometimes")),
          makeOption("q1_c", 3, t("ivr.preview.no")),
          voice("q1_x", 4, 30),
        ],
      },
      {
        id: "q2",
        text: t("ivr.preview.impactQuestion"),
        options: [
          makeOption("q2_a", 1, t("ivr.preview.normal")),
          makeOption("q2_b", 2, t("ivr.preview.rest")),
          makeOption("q2_c", 3, t("ivr.preview.stopped")),
          voice("q2_x", 4, 30),
        ],
      },
      {
        id: "q3",
        text: t("ivr.preview.habitQuestion"),
        options: [
          makeOption("q3_a", 1, t("ivr.preview.yes")),
          makeOption("q3_b", 2, t("ivr.preview.no")),
          voice("q3_x", 3, 30),
        ],
      },
      {
        id: "q_final",
        fixed: true,
        text: t("ivr.preview.finalQuestion"),
        options: [
          makeOption("qf_no", 1, t("ivr.preview.no")),
          { ...voice("qf_yes", 2, 60), label: t("ivr.preview.askDoctor") },
        ],
      },
    ];
    const current =
      scenario === "recording30"
        ? questions[1]
        : scenario === "recording60"
        ? questions[3]
        : questions[0];
    const recording = scenario === "recording30" || scenario === "recording60";
    const session: IvrSession = {
      id: "development-preview",
      task_id: "development-preview",
      doctor_name: "Nguyễn Minh Đức",
      status:
        scenario === "invitation"
          ? "sent"
          : scenario === "waiting"
          ? "reported"
          : scenario === "result"
          ? "replied"
          : "in_progress",
      current_question_id: ["waiting", "result"].includes(scenario)
        ? null
        : current.id,
      revision: 0,
      expires_at: null,
      remind_at: null,
      safety_notice: null,
      doctor_reply: scenario === "result" ? t("ivr.preview.reply") : null,
      content: {
        greeting: t("ivr.preview.greeting"),
        closing: t("ivr.waitDoctor"),
        questions,
      },
      answers: [],
    };
    return {
      session,
      error: scenario === "error" ? t("ivr.preview.networkError") : null,
      busy: false,
      loading: false,
      recording,
      seconds: scenario === "recording60" ? 60 : recording ? 30 : 0,
      voiceOption: recording ? current.options.at(-1)! : null,
      pending: [],
      remindersOpen: false,
      consentVisible: false,
      aiConsent: false,
      audioState: { phase: "idle", prompt: null, fallback: true },
      selectedOption: null,
    };
  });
  const selectedVoice = useRef<IvrOption | null>(state.voiceOption);
  const currentState = useRef(state);
  currentState.current = state;
  const selecting = useRef(false),
    epoch = useRef(0);
  const speechFinished = useRef<(() => void) | null>(null);
  const active = useRef(false),
    speechVersion = useRef(0);
  const scroll = useRef<ScrollView | null>(null);
  const stopAudio = useCallback(async () => {
    speechVersion.current++;
    speechFinished.current?.();
    await Speech.stop().catch(() => {});
    if (active.current)
      setState((s) => ({
        ...s,
        audioState: { phase: "idle", prompt: null, fallback: true },
      }));
  }, []);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      return () => {
        active.current = false;
        epoch.current++;
        void stopAudio();
      };
    }, [stopAudio])
  );
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (status) => {
      if (status !== "active") {
        active.current = false;
        epoch.current++;
        void stopAudio();
        setState((s) => ({ ...s, recording: false, voiceOption: null }));
      } else {
        active.current = true;
        if (!selecting.current)
          setState((s) => ({ ...s, busy: false, selectedOption: null }));
      }
    });
    const unregister = CheckinCallAudio.registerExternalStop(stopAudio);
    return () => {
      subscription.remove();
      unregister();
    };
  }, [stopAudio]);
  const play = async (prompt: CallAudioPrompt) => {
    const version = ++speechVersion.current;
    speechFinished.current?.();
    try {
      await CheckinCallAudio.stopAll();
      await Speech.stop();
    } catch {
      return;
    }
    if (!active.current || version !== speechVersion.current) return;
    setState((s) => ({
      ...s,
      audioState: { phase: "playing", prompt, fallback: true },
    }));
    await new Promise<void>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        if (speechFinished.current === done) speechFinished.current = null;
        if (active.current && version === speechVersion.current)
          setState((s) => ({
            ...s,
            audioState: { phase: "finished", prompt: null, fallback: true },
          }));
        resolve();
      };
      const timer = setTimeout(
        () => {
          void stopAudio();
          done();
        },
        prompt.key.startsWith("selected:") ? 10000 : 60000
      );
      speechFinished.current = done;
      try {
        Speech.speak(prompt.text, {
          language: i18n.resolvedLanguage?.startsWith("en") ? "en-US" : "vi-VN",
          rate: 0.9,
          onDone: done,
          onError: done,
          onStopped: done,
        });
      } catch {
        done();
      }
    });
  };
  const advance = (
    current: DoctorInterviewViewState,
    answerType: string
  ): DoctorInterviewViewState => {
    const session = current.session!;
    const index = session.content.questions.findIndex(
      (q) => q.id === session.current_question_id
    );
    const next = session.content.questions[index + 1];
    return {
      ...current,
      recording: false,
      seconds: 0,
      voiceOption: null,
      consentVisible: false,
      error: null,
      session: {
        ...session,
        status: next ? "in_progress" : "completed",
        current_question_id: next?.id || null,
        revision: session.revision + 1,
        answers: [
          ...session.answers,
          {
            question_id: session.current_question_id!,
            answer_type: answerType,
            stt_status: "done",
          },
        ],
      },
    };
  };
  useEffect(() => {
    if (!state.recording) return;
    const timer = setInterval(
      () =>
        setState((s) =>
          s.seconds <= 1
            ? advance(s, "voice")
            : { ...s, seconds: s.seconds - 1 }
        ),
      1000
    );
    return () => clearInterval(timer);
  }, [state.recording]);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [state.session?.current_question_id]);
  const set =
    <K extends keyof DoctorInterviewViewState>(
      key: K
    ): React.Dispatch<React.SetStateAction<DoctorInterviewViewState[K]>> =>
    (value) =>
      setState((s) => ({
        ...s,
        [key]:
          typeof value === "function"
            ? (
                value as (
                  previous: DoctorInterviewViewState[K]
                ) => DoctorInterviewViewState[K]
              )(s[key])
            : value,
      }));
  const actions: DoctorInterviewViewActions = {
    close: () => {
      void stopAudio();
      onClose();
    },
    load: async () => setState((s) => ({ ...s, error: null })),
    retryUploads: async () => {},
    setError: set("error"),
    setVoiceOption: set("voiceOption"),
    setRemindersOpen: set("remindersOpen"),
    setAiConsent: set("aiConsent"),
    setConsentVisible: set("consentVisible"),
    audio: { current: { play, stop: stopAudio } },
    replay: () => {
      const q = state.session!.content.questions.find(
        (q) => q.id === state.session!.current_question_id
      )!;
      void play({
        key: q.id,
        language: "vi",
        text: `${q.text} ${q.options
          .map((o) => `${o.key}. ${o.label}`)
          .join(". ")}`,
      });
    },
    act: async (input) => {
      void stopAudio();
      setState((s) => {
        const session = s.session!;
        if (input.action === "start")
          return { ...s, session: { ...session, status: "in_progress" } };
        if (input.action === "snooze")
          return {
            ...s,
            session: { ...session, remind_at: new Date().toISOString() },
          };
        if (input.action === "ack")
          return { ...s, session: { ...session, status: "closed" } };
        if (input.action === "back") {
          const index = session.content.questions.findIndex(
            (q) => q.id === session.current_question_id
          );
          const previous = session.content.questions[Math.max(0, index - 1)];
          return {
            ...s,
            session: {
              ...session,
              current_question_id: previous.id,
              answers: session.answers.slice(0, Math.max(0, index - 1)),
            },
          };
        }
        return s;
      });
    },
    select: async (option) => {
      const session = currentState.current.session;
      const question = session?.content.questions.find(
        (q) => q.id === session.current_question_id
      );
      if (
        selecting.current ||
        !active.current ||
        !question?.options.some((o) => o.id === option.id)
      )
        return;
      if (option.type === "voice") {
        void stopAudio();
        selectedVoice.current = option;
        setState((s) => ({ ...s, voiceOption: option, consentVisible: true }));
      } else {
        selecting.current = true;
        const selectedEpoch = epoch.current;
        setState((s) => ({ ...s, busy: true, selectedOption: option.id }));
        try {
          await play({
            key: `selected:${question.id}`,
            text: t("ivr.selected", { answer: option.label }),
            language: "vi",
          });
          if (active.current && selectedEpoch === epoch.current)
            setState((s) => advance(s, "option"));
        } finally {
          selecting.current = false;
          if (active.current)
            setState((s) => ({ ...s, busy: false, selectedOption: null }));
        }
      }
    },
    sendSkip: async () => {
      void stopAudio();
      setState((s) => advance(s, "skip"));
    },
    beginRecording: async () =>
      setState((s) => ({
        ...s,
        consentVisible: false,
        voiceOption: selectedVoice.current,
        recording: true,
        seconds: selectedVoice.current?.max_record_s || 30,
      })),
    finishRecording: {
      current: async () => setState((s) => advance(s, "voice")),
    },
  };
  return (
    <DoctorInterviewView
      state={state}
      actions={actions}
      contentScroll={scroll}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { fontSize: 20, fontWeight: "700", flex: 1 },
  menu: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    padding: spacing.lg,
    gap: spacing.md,
  },
  notice: { fontSize: 16, lineHeight: 24, marginBottom: spacing.sm },
  row: {
    minHeight: 88,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  copy: { flex: 1, gap: spacing.sm },
  rowTitle: { fontSize: 18, fontWeight: "700" },
});
