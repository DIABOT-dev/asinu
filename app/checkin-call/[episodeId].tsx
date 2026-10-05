import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitRoom } from '@livekit/react-native';
import { Room } from 'livekit-client';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  checkinCallApi,
  type CheckinCallAttempt,
  type CheckinCallEpisode,
  type CheckinCallIssueCategory,
  type CheckinCallTriageContext,
  type CheckinCallTriageLocation,
  type CheckinCallTriageSelection,
  type CheckinCallTriageSymptom,
} from '../../src/features/checkin-call/checkin-call.api';
import {
  getClosedCheckinCallStatusKey,
  getFamilyCallNoticeKeys,
  getUserCheckinCallOutcome,
  getCheckinCallTime,
  isCheckinCallAttemptClosed,
} from '../../src/features/checkin-call/checkin-call.state';
import { endVoipCall, setVoipCallUIActive, simulateIncomingVoipCall } from '../../src/lib/voip';
import { acceptCheckinCallOnce } from '../../src/features/checkin-call/checkin-call.accept';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { useTranslation } from 'react-i18next';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { CheckinCallContact } from '../../src/features/checkin-call/CheckinCallContact';
import { CheckinCallSpeech } from '../../src/features/checkin-call/CheckinCallSpeech';
import { useCheckinCallAudio } from '../../src/features/checkin-call/useCheckinCallAudio';
import { CheckinCallPhoneAction } from '../../src/features/checkin-call/CheckinCallPhoneAction';
import { restoreTriageDraft } from '../../src/features/checkin-call/triage-draft';

type TriageStep = 'location' | 'symptom' | 'intensity';
type TriageIntensity = CheckinCallTriageSelection['intensity'];

const LOCATION_ICONS: Record<string, React.ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  head: 'head-outline',
  chest: 'heart-pulse',
  abdomen: 'stomach',
  limbs: 'arm-flex-outline',
  skin: 'hand-back-right-outline',
  whole_body: 'human',
  mental: 'brain',
};

export default function CheckinCallScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation('checkinCall');
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'vi';
  const params = useLocalSearchParams<{ episodeId: string; attemptId?: string; nativeAnswered?: string }>();
  const episodeId = typeof params.episodeId === 'string' ? params.episodeId : '';
  const incomingAttemptId = typeof params.attemptId === 'string' ? params.attemptId : '';
  const answeredFromCallKit = params.nativeAnswered === '1';
  const [attempt, setAttempt] = useState<CheckinCallAttempt | null>(null);
  const [room, setRoom] = useState<{ token: string; url: string; instance: Room } | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [episodeProgress, setEpisodeProgress] = useState<CheckinCallEpisode | null>(null);
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageStep, setTriageStep] = useState<TriageStep>('location');
  const [triageContext, setTriageContext] = useState<CheckinCallTriageContext | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<CheckinCallTriageLocation | null>(null);
  const [selectedSymptom, setSelectedSymptom] = useState<CheckinCallTriageSymptom | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [reload, setReload] = useState(0);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const draftKey = `checkin-call-triage:v1:${episodeId}`;
  const userContent = useRef<ScrollView | null>(null);
  useLayoutEffect(() => {
    // A long symptom/location list may leave the next question off-screen.
    // Reset on question changes, never on polling or playback status updates.
    userContent.current?.scrollTo({ y: 0, animated: false });
  }, [triageOpen, triageStep]);
  useEffect(() => { setShowMoreOptions(false); }, [triageOpen, triageStep]);
  const [error, setError] = useState('');
  const [statusKey, setStatusKey] = useState('statusPreparing');
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const { audio, play: playAudio, stopAudio: stopCallAudio } = useCheckinCallAudio(attempt, language, t);
  const callScreenFocused = useRef(true);
  const playVersion = useRef(0);
  const audioContext = useRef({ attempt, joined, ended, triageOpen, prompt: audio.prompt });
  audioContext.current = { attempt, joined, ended, triageOpen, prompt: audio.prompt };
  const stopAudio = useCallback((clearPrompt = true) => {
    playVersion.current++;
    return stopCallAudio(clearPrompt);
  }, [stopCallAudio]);
  const play = useCallback(async (key: string, text?: string) => {
    const version = ++playVersion.current;
    if (!callScreenFocused.current || AppState.currentState !== 'active') return;
    const current = audioContext.current;
    if (current.attempt && !current.ended) {
      // Silence native unlock guidance before either a recording or device TTS
      // starts. A late bridge response must not revive a cancelled prompt.
      await setVoipCallUIActive(current.attempt.id, true,
        current.triageOpen ? current.attempt.next_action_at : current.attempt.confirm_deadline);
    }
    if (version !== playVersion.current || !callScreenFocused.current || AppState.currentState !== 'active') return;
    await playAudio(key, text);
  }, [playAudio]);
  useFocusEffect(useCallback(() => {
    callScreenFocused.current = true;
    const current = audioContext.current;
    if (current.joined && !current.ended && current.prompt) void play(current.prompt.key, current.prompt.text);
    return () => {
      callScreenFocused.current = false;
      const id = audioContext.current.attempt?.id;
      void stopAudio(false).then(() => {
        // A fast refocus may already have claimed the session again while
        // teardown awaited the old player. Never release its new ownership.
        if (id && (!callScreenFocused.current || AppState.currentState !== 'active'
          || audioContext.current.attempt?.id !== id)) return setVoipCallUIActive(id, false);
      });
    };
  }, [play, stopAudio]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const current = audioContext.current;
      if (state === 'active') {
        if (callScreenFocused.current && current.joined && !current.ended && current.prompt) {
          void play(current.prompt.key, current.prompt.text);
        }
      } else {
        void stopAudio(false).then(() => {
          if (current.attempt && !current.ended && (!callScreenFocused.current
            || AppState.currentState !== 'active' || audioContext.current.attempt?.id !== current.attempt.id)) {
            return setVoipCallUIActive(current.attempt.id, false);
          }
        });
      }
    });
    return () => subscription.remove();
  }, [play, stopAudio]);
  useEffect(() => {
    if (!attempt || !joined || ended || !callScreenFocused.current || AppState.currentState !== 'active') return;
    void setVoipCallUIActive(attempt.id, true, triageOpen ? attempt.next_action_at : attempt.confirm_deadline);
  }, [attempt?.id, attempt?.next_action_at, attempt?.confirm_deadline, joined, ended, triageOpen]);
  const actionPending = useRef(false);
  const callEnded = useRef(false);
  const joinRequested = useRef(false);
  const inTriage = useRef(false);
  const triageStage = useRef<{
    step: TriageStep;
    location: CheckinCallTriageLocation | null;
    symptom: CheckinCallTriageSymptom | null;
  }>({ step: 'location', location: null, symptom: null });
  const accepted = useRef(false);
  const acceptPromise = useRef<ReturnType<typeof checkinCallApi.accept> | null>(null);
  const activeRoom = useRef<{ token: string; url: string; instance: Room } | null>(null);
  const connectionEnding = useRef(false);
  const screenMounted = useRef(true);
  const familyNotice = getFamilyCallNoticeKeys(attempt?.severity);

  const disconnectRoom = useCallback(async () => {
    // Close signaling BEFORE the API/CallKit ends the native call. Closing
    // CallKit first can deactivate the media session while LiveKit is reading.
    connectionEnding.current = true;
    try {
      await activeRoom.current?.instance.disconnect();
    } catch {
      // A broken optional room must not block the health/check-in response.
      console.warn('[checkin-call] room disconnect did not complete cleanly');
    }
  }, []);

  const restoreRoomAfterFailedAction = useCallback(async () => {
    if (!screenMounted.current) return;
    try {
      if (attempt?.id) {
        const latest = await checkinCallApi.attempt(attempt.id);
        if (!screenMounted.current) return;
        if (isCheckinCallAttemptClosed(latest.attempt)) {
          await endVoipCall(latest.attempt.id);
          if (!screenMounted.current) return;
          setError('');
          setAttempt(latest.attempt);
          callEnded.current = true;
          setCompletedAt(getCheckinCallTime(latest.attempt.resolved_at || latest.attempt.ended_at || latest.attempt.exhausted_at));
          setEnded(true);
          setRoom(null);
          const recoveredStatus = getClosedCheckinCallStatusKey(latest.attempt);
          setStatusKey(recoveredStatus);
          if (recoveredStatus === 'statusFamilyConfirmed') {
            void play('family_confirmed', t('result.familyConfirmedMessage'));
          } else if (latest.attempt.target_role === 'USER') {
            const outcome = getUserCheckinCallOutcome({ state: latest.attempt.episode_state, severity: latest.attempt.severity });
            if (outcome.audioKey) void play(outcome.audioKey,
              outcome.audioKey === 'family_unavailable' ? t('result.familyUnavailableMessage') : undefined);
          }
          return;
        }
        // The triage POST may have committed even if its HTTP response was
        // lost. Reconcile that state instead of leaving obsolete answer buttons.
        if (latest.attempt.target_role === 'USER' && latest.attempt.episode_state === 'TRIAGE_USER' && !inTriage.current) {
          const recovered = await checkinCallApi.startTriage(episodeId);
          if (!screenMounted.current) return;
          inTriage.current = true;
          triageStage.current = { step: 'location', location: null, symptom: null };
          setAttempt(latest.attempt);
          setTriageContext(recovered.triage);
          setDraftReady(true);
          setSelectedLocation(null);
          setSelectedSymptom(null);
          setTriageStep('location');
          setTriageOpen(true);
          setError('');
          void play('triage_location_prompt');
        }
      }
    } catch {
      // If the status request also failed, allow polling and button retries
      // again. Keeping the ending flag set here would stall the call forever.
    }
    if (!screenMounted.current) return;
    connectionEnding.current = false;
    try {
      const current = activeRoom.current;
      if (current) await current.instance.connect(current.url, current.token);
    } catch {
      if (screenMounted.current && !connectionEnding.current) {
        setStatusKey('statusConnectionLost');
      }
    }
  }, [attempt?.id, episodeId, play, t]);

  useEffect(() => {
    screenMounted.current = true;
    connectionEnding.current = false;
    return () => {
      screenMounted.current = false;
      connectionEnding.current = true;
      void activeRoom.current?.instance.disconnect().catch(() => {});
    };
  }, []);

  const resultCopy = (() => {
    if (['statusFamilyHandled', 'statusCheckinRecorded', 'statusCancelled', 'statusUserUnreachable'].includes(statusKey)) {
      return { title: t(`result.${statusKey}Title`), message: t(`result.${statusKey}Message`), state: t(statusKey), success: statusKey === 'statusFamilyHandled' || statusKey === 'statusCheckinRecorded' };
    }
    if (statusKey === 'statusUserOk') {
      return {
        title: t('result.userOkTitle'),
        message: t('result.userOkMessage'),
        state: t('result.resolved'),
        success: true,
      };
    }
    if (statusKey === 'statusUserMild') {
      return {
        title: t('result.mildTitle'),
        message: t('result.mildMessage'),
        state: t('result.notified'),
        success: true,
      };
    }
    if (statusKey === 'statusUserUrgent') {
      return {
        title: t('result.urgentTitle'),
        message: t('result.urgentMessage'),
        state: t('result.escalating'),
        success: false,
      };
    }
    if (statusKey === 'statusFamilyConfirmed') {
      return {
        title: t('result.familyConfirmedTitle'),
        message: t('result.familyConfirmedMessage'),
        state: t('result.accepted'),
        success: true,
      };
    }
    if (statusKey === 'statusFamilyUnavailable') {
      return {
        title: t('result.familyUnavailableTitle'),
        message: t('result.familyUnavailableMessage'),
        state: t('result.needsAttention'),
        success: false,
      };
    }
    return {
      title: t('result.expiredTitle'),
      message: t('result.expiredMessage'),
      state: t('result.expired'),
      success: false,
    };
  })();

  useEffect(() => {
    let live = true;
    async function load() {
      try {
        let id = incomingAttemptId;
        if (!id) {
          const active = await checkinCallApi.active();
          if (active.active?.id !== episodeId) {
            setError(t('errorCallEnded'));
            return;
          }
          id = active.active.attempt_id;
        }
        const result = await checkinCallApi.attempt(id);
        if (!live) return;
        if (result.attempt.episode_id !== episodeId) {
          setError(t('errorInvalidCall'));
          return;
        }
        if (isCheckinCallAttemptClosed(result.attempt)) {
          setAttempt(result.attempt);
          connectionEnding.current = true;
          callEnded.current = true;
          void endVoipCall(result.attempt.id);
          setCompletedAt(getCheckinCallTime(result.attempt.resolved_at || result.attempt.ended_at || result.attempt.exhausted_at));
          setEnded(true);
          setStatusKey(getClosedCheckinCallStatusKey(result.attempt));
          return;
        }
        if (
          result.attempt.target_role === 'USER' &&
          result.attempt.episode_state === 'TRIAGE_USER'
        ) {
          const triageResult = await checkinCallApi.startTriage(episodeId);
          if (!live) return;
          setTriageContext(triageResult.triage);
          const raw = await AsyncStorage.getItem(draftKey).catch(() => null);
          if (!live) return;
          const draft = restoreTriageDraft(raw, triageResult.triage);
          inTriage.current = true;
          setTriageOpen(true);
          if (draft) {
            triageStage.current = draft;
            setSelectedLocation(draft.location);
            setSelectedSymptom(draft.symptom);
            setTriageStep(draft.step);
          } else setTriageStep('location');
          setDraftReady(true);
        }
        if (!live) return;
        setAttempt(result.attempt);
        if (result.attempt.target_role === 'FAMILY') void checkinCallApi.seen(id).catch(() => {});
        try {
          const connection = await checkinCallApi.token(id);
          if (live && !connectionEnding.current) {
            const current = { token: connection.token, url: connection.url, instance: new Room() };
            activeRoom.current = current;
            setRoom(current);
          }
        } catch {
          if (live && !connectionEnding.current) setStatusKey('statusConnectionUnavailable');
        }
      } catch (e) {
        if (live) setError(getApiErrorMessage(e, t, 'errorOpenCall'));
      }
    }
    void load();
    return () => {
      live = false;
      void stopAudio();
    };
  }, [episodeId, incomingAttemptId, stopAudio, t, reload, draftKey]);

  useEffect(() => {
    if (!triageOpen || !draftReady || ended) return;
    void AsyncStorage.setItem(draftKey, JSON.stringify({
      location: selectedLocation?.key, symptom: selectedSymptom?.key,
      expiresAt: getCheckinCallTime(attempt?.next_action_at) || Date.now() + 180_000,
    })).catch(() => {});
  }, [draftKey, draftReady, triageOpen, ended, selectedLocation, selectedSymptom, attempt?.next_action_at]);

  useEffect(() => {
    if (!joined || ended) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [joined, ended]);

  // Ending this device's call is not the end of the family escalation.
  useEffect(() => {
    if (!ended || !attempt) return;
    let live = true;
    let terminal = false;
    let requested = 0;
    let applied = 0;
    const timer = setInterval(() => {
      const sequence = ++requested;
      void checkinCallApi.episode(episodeId).then(({ episode }) => {
        if (!live || terminal || sequence < applied) return;
        applied = sequence;
        terminal = ['RESOLVED', 'CANCELLED', 'EXHAUSTED', 'EXHAUSTED_MILD', 'EXHAUSTED_URGENT'].includes(episode.state);
        setEpisodeProgress(episode);
        const key = getClosedCheckinCallStatusKey({ ...attempt, state: attempt.state === 'NO_ANSWER' ? 'NO_ANSWER' : 'COMPLETED', episode_state: episode.state, severity: episode.severity, acknowledged_by: episode.acknowledged_by, cancellation_reason: episode.cancellation_reason });
        setStatusKey(key);
        if (episode.resolved_at || episode.exhausted_at) setCompletedAt(getCheckinCallTime(episode.resolved_at || episode.exhausted_at));
        if (terminal) clearInterval(timer);
      }).catch(() => {});
    }, 3000);
    return () => { live = false; clearInterval(timer); };
  }, [ended, episodeId, attempt]);

  const pollingAttemptId = attempt?.id;
  useEffect(() => {
    if (!pollingAttemptId || ended) return;
    let live = true;
    const interval = setInterval(() => {
      void checkinCallApi.attempt(pollingAttemptId).then(({ attempt: latest }) => {
        if (!live || connectionEnding.current || actionPending.current) return;
        setAttempt(latest);
        if (isCheckinCallAttemptClosed(latest)) {
          callEnded.current = true;
          void disconnectRoom().then(() => endVoipCall(latest.id));
          void stopAudio();
          setEnded(true);
          setCompletedAt(getCheckinCallTime(latest.resolved_at || latest.ended_at || latest.exhausted_at));
          setRoom(null);
          setStatusKey(getClosedCheckinCallStatusKey(latest));
        }
      }).catch(() => {});
    }, 3000);
    return () => {
      live = false;
      clearInterval(interval);
    };
  }, [pollingAttemptId, ended, stopAudio, disconnectRoom]);

  const onConnected = useCallback(() => {
    if (screenMounted.current && !connectionEnding.current && activeRoom.current?.instance === room?.instance) {
      setStatusKey('statusConnected');
    }
  }, [room?.instance]);

  const onConnectionError = useCallback(() => {
    if (screenMounted.current && !connectionEnding.current && activeRoom.current?.instance === room?.instance) {
      setStatusKey('statusConnectionLost');
    }
  }, [room?.instance]);

  const onDisconnected = useCallback(() => {
    if (screenMounted.current && !connectionEnding.current && activeRoom.current?.instance === room?.instance) {
      setStatusKey('statusConnectionLost');
    }
  }, [room?.instance]);

  const join = useCallback(() => {
    if (!attempt || actionPending.current || joinRequested.current || callEnded.current) return;
    joinRequested.current = true;
    setJoined(true);
    setStatusKey(room ? 'statusConnecting' : 'statusNoLiveKit');
    const startPrompt = () => {
      if (!screenMounted.current || connectionEnding.current || callEnded.current || actionPending.current) return;
      if (attempt.target_role === 'USER' && attempt.episode_state === 'TRIAGE_USER') {
        const step = triageStage.current.step;
        void play(step === 'intensity' ? 'triage_intensity_prompt' : step === 'symptom' ? 'triage_symptom_prompt' : 'triage_location_prompt');
      } else if (attempt.target_role === 'USER' && attempt.trigger_source === 'EARLY_SIGNAL') {
        void play('early_signal_context', t('earlySignalCallReason'));
      } else {
        void play(attempt.target_role === 'USER' ? 'user_prompt'
          : attempt.severity === 'URGENT' ? 'family_urgent'
            : attempt.severity === 'MILD' ? 'family_mild' : 'family_unknown');
      }
    };
    if (!accepted.current) {
      accepted.current = true;
      acceptPromise.current = acceptCheckinCallOnce(attempt.id);
      void acceptPromise.current.then(({ state, confirm_deadline }) => {
        if (!screenMounted.current || connectionEnding.current) return;
        if (confirm_deadline) {
          setAttempt((current) =>
            current ? { ...current, confirm_deadline } : current,
          );
        }
        if (attempt.target_role === 'FAMILY' && (state === 'URGENT_BROADCAST' || state === 'URGENT_ACKNOWLEDGED')) setStatusKey('statusUrgentAccepted');
        startPrompt();
      }).catch(() => {
        accepted.current = false;
        acceptPromise.current = null;
        if (!screenMounted.current || connectionEnding.current) return;
        setStatusKey('statusAcceptFailed');
      });
    } else startPrompt();
  }, [attempt, play, room, t]);

  useEffect(() => {
    if (answeredFromCallKit && attempt && !joined && !ended) join();
  }, [answeredFromCallKit, attempt, ended, join, joined]);

  useEffect(() => {
    if (
      !joined ||
      ended ||
      busy ||
      triageOpen ||
      attempt?.target_role !== 'USER' ||
      !attempt.confirm_deadline
    ) {
      return;
    }
    const retryAt = new Date(attempt.confirm_deadline).getTime() - 15_000;
    const delay = retryAt - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return;
    const timer = setTimeout(() => {
      if (actionPending.current || callEnded.current || inTriage.current) return;
      void play('user_retry');
    }, delay);
    return () => clearTimeout(timer);
  }, [attempt?.confirm_deadline, attempt?.target_role, busy, ended, joined, play, triageOpen]);

  const openTriage = async () => {
    if (actionPending.current || callEnded.current || inTriage.current || !episodeId) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      // Accept must finish before triage starts: a late accept otherwise
      // replaces the triage deadline with the initial answer timeout.
      if (acceptPromise.current) await acceptPromise.current;
      const result = await checkinCallApi.startTriage(episodeId);
      if (!screenMounted.current || callEnded.current) return;
      inTriage.current = true;
      triageStage.current = { step: 'location', location: null, symptom: null };
      setTriageContext(result.triage);
      setSelectedLocation(null);
      setSelectedSymptom(null);
      setTriageStep('location');
      setTriageOpen(true);
      setDraftReady(true);
      setAttempt(current => current ? { ...current, next_action_at: result.episode.next_action_at } : current);
      void play('triage_location_prompt');
    } catch (e) {
      if (!screenMounted.current) return;
      setError(getApiErrorMessage(e, t, 'errorStartTriage'));
      await restoreRoomAfterFailedAction();
    } finally {
      actionPending.current = false;
      if (screenMounted.current) setBusy(false);
    }
  };

  const simulateNextFamilyCall = useCallback(async () => {
    if (!__DEV__ || Platform.OS !== 'ios') return;
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    try {
      const result = await checkinCallApi.active();
      const active = result.active;
      if (!active?.local_callkit_simulation || active.target_role !== 'FAMILY') return;
      await stopAudio();
      await simulateIncomingVoipCall({
        episodeId: active.id,
        attemptId: active.attempt_id,
        severity: active.severity,
        kind: 'INCOMING_CALL',
      });
    } catch {
      // Development simulation must never change the persisted safety flow.
    }
  }, [stopAudio]);

  const submitTriage = async (
    intensity: TriageIntensity,
    location = triageStage.current.location,
    symptom = triageStage.current.symptom,
  ) => {
    if (actionPending.current || callEnded.current || triageStage.current.step !== 'intensity' || !episodeId || !location || !symptom) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      await disconnectRoom();
      const result = await checkinCallApi.completeTriage(episodeId, {
        body_location: location.key,
        symptom: symptom.key,
        intensity,
      });
      setEpisodeProgress(result.episode);
      if (attempt?.id) await endVoipCall(attempt.id);
      if (!screenMounted.current) return;
      callEnded.current = true;
      setCompletedAt(getCheckinCallTime(result.episode.triage_completed_at || result.episode.updated_at));
      void AsyncStorage.removeItem(draftKey).catch(() => {});
      setEnded(true);
      setRoom(null);
      const outcome = getUserCheckinCallOutcome(result.episode);
      setStatusKey(outcome.statusKey);
      if (outcome.audioKey) void play(outcome.audioKey,
        outcome.audioKey === 'family_unavailable' ? t('result.familyUnavailableMessage') : undefined);
      if (outcome.notifyingFamily) void simulateNextFamilyCall();
    } catch (e) {
      if (!screenMounted.current) return;
      setError(getApiErrorMessage(e, t, 'errorSendTriage'));
      await restoreRoomAfterFailedAction();
    } finally {
      actionPending.current = false;
      if (screenMounted.current) setBusy(false);
    }
  };

  const chooseLocation = (location: CheckinCallTriageLocation) => {
    if (actionPending.current || callEnded.current || triageStage.current.step !== 'location') return;
    triageStage.current = { step: 'symptom', location, symptom: null };
    setSelectedLocation(location);
    setSelectedSymptom(null);
    setTriageStep('symptom');
    void play('triage_symptom_prompt');
  };

  const chooseSymptom = (symptom: CheckinCallTriageSymptom) => {
    if (actionPending.current || callEnded.current || triageStage.current.step !== 'symptom') return;
    const location = triageStage.current.location;
    if (!location || !location.symptoms.some(option => option.key === symptom.key)) return;
    triageStage.current = { step: 'intensity', location, symptom };
    setSelectedSymptom(symptom);
    if (symptom.urgent) {
      void submitTriage('URGENT', location, symptom);
      return;
    }
    setTriageStep('intensity');
    void play('triage_intensity_prompt');
  };

  const goBackInTriage = () => {
    if (actionPending.current || callEnded.current || triageStage.current.step === 'location') return;
    if (triageStage.current.step === 'intensity') {
      triageStage.current = { ...triageStage.current, step: 'symptom', symptom: null };
      setSelectedSymptom(null);
      setTriageStep('symptom');
      void play('triage_symptom_prompt');
      return;
    }
    triageStage.current = { step: 'location', location: null, symptom: null };
    setSelectedLocation(null);
    setSelectedSymptom(null);
    setTriageStep('location');
    void play('triage_location_prompt');
  };

  const answer = async (choice: 1 | 2 | 3, issueCategory?: CheckinCallIssueCategory) => {
    if (actionPending.current || callEnded.current || (inTriage.current && choice === 1) || !episodeId) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      await disconnectRoom();
      const result = await checkinCallApi.answer(episodeId, choice, issueCategory);
      setEpisodeProgress(result.episode);
      if (attempt?.id) await endVoipCall(attempt.id);
      if (!screenMounted.current) return;
      callEnded.current = true;
      setCompletedAt(getCheckinCallTime(result.episode.resolved_at || result.episode.updated_at));
      void AsyncStorage.removeItem(draftKey).catch(() => {});
      setEnded(true);
      setRoom(null);
      const outcome = getUserCheckinCallOutcome(result.episode);
      setStatusKey(outcome.statusKey);
      if (outcome.audioKey) void play(outcome.audioKey,
        outcome.audioKey === 'family_unavailable' ? t('result.familyUnavailableMessage') : undefined);
      if (outcome.notifyingFamily) void simulateNextFamilyCall();
    } catch (e) {
      if (!screenMounted.current) return;
      setError(getApiErrorMessage(e, t, 'errorSendChoice'));
      await restoreRoomAfterFailedAction();
    } finally {
      actionPending.current = false;
      if (screenMounted.current) setBusy(false);
    }
  };

  const decline = async () => {
    if (!attempt || actionPending.current || callEnded.current) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      await disconnectRoom();
      await checkinCallApi.decline(attempt.id);
      await endVoipCall(attempt.id);
      callEnded.current = true;
      router.back();
    } catch (e) {
      if (screenMounted.current) setError(getApiErrorMessage(e, t, 'errorConfirm'));
      await restoreRoomAfterFailedAction();
    } finally {
      actionPending.current = false;
      if (screenMounted.current) setBusy(false);
    }
  };

  const confirm = async () => {
    if (actionPending.current || callEnded.current || !attempt) return;
    actionPending.current = true;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      if (acceptPromise.current) await acceptPromise.current;
      else if (!accepted.current) await checkinCallApi.accept(attempt.id);
      await disconnectRoom();
      const result = await checkinCallApi.confirmFamily(episodeId, 'ACCEPT_AND_CHECK');
      await endVoipCall(attempt.id);
      if (!screenMounted.current) return;
      callEnded.current = true;
      setCompletedAt(getCheckinCallTime(result.episode.resolved_at));
      setEnded(true);
      setRoom(null);
      setStatusKey('statusFamilyConfirmed');
      void play('family_confirmed', t('result.familyConfirmedMessage'));
    } catch (e) {
      if (!screenMounted.current) return;
      setError(getApiErrorMessage(e, t, 'errorConfirm'));
      await restoreRoomAfterFailedAction();
    } finally {
      actionPending.current = false;
      if (screenMounted.current) setBusy(false);
    }
  };

  const speechControls = (
    <CheckinCallSpeech
      audio={audio}
      disabled={busy}
      onReplay={() => {
        if (actionPending.current || !audio.prompt) return;
        void play(audio.prompt.key, audio.prompt.text);
      }}
      onStop={() => void stopAudio(false)}
    />
  );
  const processingFeedback = busy ? (
    <View style={styles.processingFeedback}>
      <ActivityIndicator size="small" color="#087f6d" />
      <Text style={styles.processingText} accessibilityLiveRegion="polite">{t('playback.savingResponse')}</Text>
    </View>
  ) : null;
  const deadline = getCheckinCallTime(triageOpen ? attempt?.next_action_at : attempt?.confirm_deadline || attempt?.ring_deadline);
  const remaining = deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = attempt?.severity === 'URGENT' || episodeProgress?.severity === 'URGENT' || statusKey === 'statusUserUrgent';

  return (
    <View style={styles.root}>
      {!!attempt && joined && !ended && <View style={[styles.connectionStatus, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.status} accessibilityLiveRegion="polite">{t(statusKey)}</Text>
        <Text style={styles.connectionHint}>{t('interactionHint')}</Text>
        {remaining !== null && <Text style={styles.connectionHint}>{t(remaining > 0 ? 'responseCountdown' : 'responseDeadline', { seconds: remaining })}</Text>}
      </View>}
      {!!room && joined && !ended && (
        <LiveKitRoom
          room={room.instance}
          serverUrl={room.url}
          token={room.token}
          audio={false}
          video={false}
          onConnected={onConnected}
          onError={onConnectionError}
          onDisconnected={onDisconnected}
        />
      )}

      {!attempt && (
        <View style={styles.centerContainer}>
          {!error && <ActivityIndicator size="large" color="#059669" />}
          <Text style={styles.status}>{error || t(statusKey)}</Text>
          {!!error && (
            <Pressable accessibilityRole="button" style={styles.replay} onPress={() => { setError(''); setReload(value => value + 1); }}>
              <Text style={styles.replayText}>{t('retry', { ns: 'common' })}</Text>
            </Pressable>
          )}
          {!!error && (
            <Pressable style={styles.replay} onPress={() => router.back()}>
              <Text style={styles.replayText}>{t('close', { ns: 'common' })}</Text>
            </Pressable>
          )}
        </View>
      )}

      {!!attempt && !joined && !ended && (
        <ScrollView contentContainerStyle={styles.incomingWrapper}>
          <Image
            source={require('../../assets/images/asinu-brand-logo.png')}
            style={styles.incomingLogo}
            resizeMode="contain"
          />

          <View style={styles.incomingCard}>
            <Image
              source={require('../../assets/images/checkin-call/doctor_avatar.png')}
              style={styles.doctorAvatarImg}
              resizeMode="contain"
            />
            <View style={styles.incomingPill}>
              <Text style={styles.incomingPillText}>{t('gallery.incoming')}</Text>
            </View>
            <Text style={styles.incomingCardTitle}>{t(urgent ? 'urgentCallHeading' : attempt.target_role === 'FAMILY' ? 'familyHeading' : 'userHeading')}</Text>
            {attempt.target_role === 'FAMILY' ? (
              <CheckinCallContact subject={attempt.subject} onBeforeCall={() => stopAudio(false)} />
            ) : <Text style={styles.incomingCardSub}>{t(attempt.trigger_source === 'EARLY_SIGNAL' ? 'earlySignalCallReason' : 'gallery.dailyCheck')}</Text>}
            {urgent && <CheckinCallPhoneAction phone="115" urgent onBeforeCall={() => stopAudio(false)} />}
          </View>

          <View style={styles.callButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('gallery.decline')}
              disabled={busy}
              accessibilityState={{ disabled: busy }}
              style={styles.callButtonWrap}
              onPress={() => void decline()}
            >
              <View style={[styles.callCircle, styles.decline]}>
                <Ionicons name="call" size={28} color="#ffffff" style={styles.hangupIcon} />
              </View>
              <Text style={styles.callButtonLabel}>{t('gallery.decline')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('gallery.accept')}
              style={styles.callButtonWrap}
              onPress={join}
            >
              <View style={[styles.callCircle, styles.accept]}>
                <Ionicons name="call" size={28} color="#ffffff" />
              </View>
              <Text style={styles.callButtonLabel}>{t('gallery.accept')}</Text>
            </Pressable>
          </View>

          <Image
            source={require('../../assets/images/checkin-call/call_bottom_deco.png')}
            style={styles.callBottomDeco}
            resizeMode="cover"
          />
        </ScrollView>
      )}

      {/* Screen 2: Kết quả cuộc gọi (Call Ended / Resolved - Image 2) */}
      {ended && (
        <ScrollView contentContainerStyle={styles.resultFullWrapper}>
          {resultCopy.success ? (
            <Image
              source={require('../../assets/images/checkin-call/checkin_success_art.png')}
              style={styles.resultSuccessArt}
              resizeMode="contain"
            />
          ) : (
            <View style={styles.resultWarningIcon}>
              <Ionicons name="time-outline" size={54} color="#b45309" />
            </View>
          )}

          <Text style={styles.resultHeading}>{resultCopy.title}</Text>
          {attempt?.target_role === 'FAMILY' && <CheckinCallContact subject={attempt.subject} onBeforeCall={() => stopAudio(false)} />}
          <Text style={styles.resultSub}>{resultCopy.message}</Text>
          {!!episodeProgress?.acknowledged_name && <Text style={styles.resultSub}>{t('familyResponsible', { name: episodeProgress.acknowledged_name })}</Text>}
          {urgent && <CheckinCallPhoneAction phone="115" urgent onBeforeCall={() => stopAudio(false)} />}
          {attempt?.target_role === 'USER' && ['statusUserUnreachable', 'statusUserMild', 'statusFamilyUnavailable'].includes(statusKey) && <Pressable accessibilityRole="button" style={styles.triageBackButton} onPress={() => { void stopAudio(); router.replace('/checkin'); }}>
            <Text style={styles.triageBackButtonText}>{t('openCheckin')}</Text>
          </Pressable>}

          <View style={styles.resultCard}>
            <View style={styles.resultRow}>
              <View style={styles.resultRowLeft}>
                <Ionicons name="person-circle-outline" size={26} color="#00897b" />
                <Text style={styles.resultRowLabel}>{t('gallery.statusLabel')}</Text>
              </View>
              <View style={[styles.resultPill, !resultCopy.success && styles.resultPillWarning]}>
                <Text
                  style={[
                    styles.resultPillTextResolved,
                    !resultCopy.success && styles.resultPillTextWarning,
                  ]}
                >
                  {resultCopy.state}
                </Text>
              </View>
            </View>

            <View style={styles.resultRow}>
              <View style={styles.resultRowLeft}>
                <Ionicons name="time-outline" size={24} color="#00897b" />
                <Text style={styles.resultRowLabel}>{t('gallery.timeLabel')}</Text>
              </View>
              <View style={styles.resultPill}>
                <Text style={styles.resultPillTextTime}>
                  {completedAt === null ? t('timeUnavailable') : new Date(completedAt).toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </Text>
              </View>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close', { ns: 'common' })}
            style={styles.resultCloseBtn}
            onPress={() => {
              void stopAudio();
              router.back();
            }}
          >
            <Text style={styles.resultCloseBtnText}>{t('close', { ns: 'common' })}</Text>
          </Pressable>
          {speechControls}

          <Image
            source={require('../../assets/images/checkin-call/call_bottom_deco.png')}
            style={styles.callBottomDeco}
            resizeMode="cover"
          />
        </ScrollView>
      )}

      {/* Screen 1: Cuộc gọi người thân - Khẩn cấp (Family Urgent - Image 1) */}
      {!!attempt && joined && !ended && attempt.target_role === 'FAMILY' && (
        <ScrollView contentContainerStyle={styles.familyScrollContent}>
          <View style={[styles.familyCard, attempt.severity === 'URGENT' ? styles.familyCardUrgent : styles.familyCardMild]}>
            <View style={styles.urgentBadgeCircle}>
              <Ionicons
                name={attempt.severity === 'URGENT' ? 'warning-outline' : 'heart-outline'}
                size={36}
                color={attempt.severity === 'URGENT' ? '#dc2626' : '#d97706'}
              />
            </View>
            <Text style={[styles.familyCardTitle, attempt.severity === 'URGENT' ? styles.familyCardTitleUrgent : styles.familyCardTitleMild]}>
              {t(familyNotice.titleKey)}
            </Text>
          <CheckinCallContact subject={attempt.subject} onBeforeCall={() => stopAudio(false)} />
            <Text style={styles.familyCardSubtitle}>
              {attempt.family_notice?.message || t(familyNotice.messageKey)}
            </Text>
            {urgent && <CheckinCallPhoneAction phone="115" urgent onBeforeCall={() => stopAudio(false)} />}
            {!!(attempt.triage_display?.summary || attempt.issue_category) && (
              <View style={styles.reportedIssueBox}>
                <Text style={styles.reportedIssueLabel}>{t('reportedIssue')}</Text>
                <Text style={styles.reportedIssueValue}>
                  {attempt.triage_display?.summary || t(`issue.${attempt.issue_category}`)}
                </Text>
              </View>
            )}
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}
          {processingFeedback}

          <View style={styles.familyActionsCol}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('confirmCheck')}
              accessibilityState={{ disabled: busy }}
              style={[styles.familyActionBtn, attempt.severity === 'URGENT' ? styles.familyActionBtnUrgent : styles.familyActionBtnMild]}
              onPress={() => void confirm()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.familyActionTextUrgent}>{t('confirmCheck')}</Text>
              )}
            </Pressable>
          </View>

          {speechControls}

          <Text style={styles.familyFootnoteText}>{t('gallery.familyConfirmationNote')}</Text>

          <Image
            source={require('../../assets/images/checkin-call/call_bottom_deco.png')}
            style={styles.callBottomDeco}
            resizeMode="cover"
          />
        </ScrollView>
      )}

      {/* User Connected State */}
      {!!attempt && joined && !ended && attempt.target_role === 'USER' && (
        <ScrollView ref={userContent} contentContainerStyle={styles.familyScrollContent}>
          {!triageOpen ? (
            <View style={styles.userCallCard}>
              <Image
                source={require('../../assets/images/checkin-call/checkin_call_hero_art.png')}
                style={styles.userCallHeroArt}
                resizeMode="contain"
              />
              <Text style={styles.userCardTitle}>{t('userHeading')}</Text>
              <Text style={styles.userCardSub}>{t(attempt.trigger_source === 'EARLY_SIGNAL' ? 'earlySignalCallReason' : 'gallery.connectedInstruction')}</Text>
              {urgent && <CheckinCallPhoneAction phone="115" urgent onBeforeCall={() => stopAudio(false)} />}

              {!!error && <Text style={styles.error}>{error}</Text>}
              {processingFeedback}

              <View style={styles.userCardOptionsCol}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('choiceOk')}
                  accessibilityState={{ disabled: busy }}
                  style={({ pressed }) => [
                    styles.userChoiceCard,
                    styles.userChoiceCardOk,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => void answer(1)}
                  disabled={busy}
                >
                  <View style={styles.userChoiceDirectIcon}>
                    <Ionicons name="happy-outline" size={28} color="#059669" />
                  </View>
                  <Text style={[styles.userChoiceText, styles.userChoiceTextOk]}>
                    {t('choiceOk')}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#059669" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('choiceMild')}
                  accessibilityState={{ disabled: busy }}
                  style={({ pressed }) => [
                    styles.userChoiceCard,
                    styles.userChoiceCardMild,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => void openTriage()}
                  disabled={busy}
                >
                  <View style={styles.userChoiceDirectIcon}>
                    <MaterialCommunityIcons name="emoticon-neutral-outline" size={28} color="#ea580c" />
                  </View>
                  <Text style={[styles.userChoiceText, styles.userChoiceTextMild]}>
                    {t('choiceMild')}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#ea580c" />
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('choiceUrgent')}
                  accessibilityState={{ disabled: busy }}
                  style={({ pressed }) => [
                    styles.userChoiceCard,
                    styles.userChoiceCardUrgent,
                    pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
                  ]}
                  onPress={() => void answer(3, 'URGENT_UNSPECIFIED')}
                  disabled={busy}
                >
                  <View style={styles.userChoiceDirectIcon}>
                    <MaterialCommunityIcons name="plus-circle-outline" size={28} color="#dc2626" />
                  </View>
                  <Text style={[styles.userChoiceText, styles.userChoiceTextUrgent]}>
                    {t('choiceUrgent')}
                  </Text>
                  <Ionicons name="chevron-forward" size={20} color="#dc2626" />
                </Pressable>
              </View>

              {speechControls}

              <View style={styles.safetyFooterRow}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#64748b" />
                <Text style={styles.safetyFooterText}>{t('safetyNote')}</Text>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.userCallCard}>
                <View style={styles.userHeadsetIconWrap}>
                  <Ionicons name="pulse-outline" size={32} color="#00897b" />
                </View>
                <Text style={styles.userCardTitle}>
                  {t(`triage.${triageStep}Title`)}
                </Text>
                <Text style={styles.userCardSub}>
                  {t(`triage.${triageStep}Instruction`)}
                </Text>
                {speechControls}
              </View>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.familyActionsCol}>
                {processingFeedback}
                {!!selectedLocation && <Text style={styles.triageProgress}>{t('triage.selectedSummary', { location: selectedLocation.label, symptom: selectedSymptom?.label || t('triage.notSelected') })}</Text>}
                <Pressable accessibilityRole="button" disabled={busy} style={styles.triageBackButton} onPress={() => void answer(3, 'URGENT_UNSPECIFIED')}>
                  <Ionicons name="alert-circle-outline" size={22} color="#b91c1c" />
                  <Text style={styles.urgentActionText}>{t('triage.urgentNow')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" disabled={busy} style={styles.triageBackButton} onPress={() => void answer(2, 'MILD_UNSPECIFIED')}>
                  <Text style={styles.triageBackButtonText}>{t('triage.skipDetails')}</Text>
                </Pressable>
                <Text style={styles.triageProgress}>
                  {t('triage.progress', {
                    current: triageStep === 'location' ? 1 : triageStep === 'symptom' ? 2 : 3,
                  })}
                </Text>

                {triageStep !== 'location' && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      triageStep === 'intensity'
                        ? 'triage.changeSymptom'
                        : 'triage.changeLocation',
                    )}
                    accessibilityState={{ disabled: busy }}
                    style={styles.triageBackButton}
                    onPress={() => void goBackInTriage()}
                    disabled={busy}
                  >
                    <Ionicons name="arrow-back" size={18} color="#087f6d" />
                    <Text style={styles.triageBackButtonText}>
                      {t(
                        triageStep === 'intensity'
                          ? 'triage.changeSymptom'
                          : 'triage.changeLocation',
                      )}
                    </Text>
                  </Pressable>
                )}

                {triageStep === 'location' && triageContext?.has_recent_context && (
                  <View style={styles.triageContextNote}>
                    <Ionicons name="time-outline" size={18} color="#087f6d" />
                    <Text style={styles.triageContextNoteText}>{t('triage.recentContext')}</Text>
                  </View>
                )}

                {triageStep === 'location' &&
                  triageContext?.locations.slice(0, showMoreOptions ? undefined : 4).map((location) => (
                    <Pressable
                      key={location.key}
                      accessibilityRole="button"
                      accessibilityLabel={t('triage.locationAccessibilityLabel', {
                        label: location.label,
                        description: location.desc,
                      })}
                      accessibilityHint={location.recent ? t('triage.recentAccessibilityHint') : undefined}
                      accessibilityState={{ disabled: busy }}
                      style={[styles.triageOptionBtn, styles.triageOptionNeutral]}
                      onPress={() => void chooseLocation(location)}
                      disabled={busy}
                    >
                      <MaterialCommunityIcons
                        name={LOCATION_ICONS[location.key] || 'human'}
                        size={26}
                        color="#087f6d"
                      />
                      <View style={styles.triageOptionCopy}>
                        <View style={styles.triageOptionTitleRow}>
                          <Text style={styles.triageOptionTitle}>{location.label}</Text>
                          {location.recent && (
                            <View style={styles.recentBadge}>
                              <Text style={styles.recentBadgeText}>{t('triage.recentBadge')}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.triageOptionDescription}>{location.desc}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#64748b" />
                    </Pressable>
                  ))}

                {triageStep === 'symptom' &&
                  selectedLocation?.symptoms.filter((symptom, index) => showMoreOptions || symptom.urgent || index < 4).map((symptom) => (
                    <Pressable
                      key={symptom.key}
                      accessibilityRole="button"
                      accessibilityLabel={symptom.label}
                      accessibilityHint={
                        symptom.urgent
                          ? t('triage.urgentAccessibilityHint')
                          : symptom.recent
                            ? t('triage.recentAccessibilityHint')
                            : undefined
                      }
                      accessibilityState={{ disabled: busy }}
                      style={[
                        styles.triageOptionBtn,
                        symptom.urgent ? styles.triageOptionUrgent : styles.triageOptionNeutral,
                      ]}
                      onPress={() => void chooseSymptom(symptom)}
                      disabled={busy}
                    >
                      <Ionicons
                        name={symptom.urgent ? 'warning-outline' : 'pulse-outline'}
                        size={24}
                        color={symptom.urgent ? '#dc2626' : '#087f6d'}
                      />
                      <View style={styles.triageOptionCopy}>
                        <View style={styles.triageOptionTitleRow}>
                          <Text style={styles.triageOptionTitle}>{symptom.label}</Text>
                          {symptom.recent && (
                            <View style={styles.recentBadge}>
                              <Text style={styles.recentBadgeText}>{t('triage.recentBadge')}</Text>
                            </View>
                          )}
                          {symptom.urgent && (
                            <View style={styles.urgentBadge}>
                              <Text style={styles.urgentBadgeText}>{t('triage.urgentBadge')}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#64748b" />
                    </Pressable>
                  ))}

                {((triageStep === 'location' && (triageContext?.locations.length || 0) > 4) || (triageStep === 'symptom' && (selectedLocation?.symptoms.length || 0) > 4)) &&
                  <Pressable accessibilityRole="button" disabled={busy} style={styles.triageBackButton} onPress={() => setShowMoreOptions(current => !current)}>
                    <Text style={styles.triageBackButtonText}>{t(showMoreOptions ? 'triage.showLess' : 'triage.showMore')}</Text>
                  </Pressable>}

                {triageStep === 'intensity' && (
                  <>
                    <View style={styles.triageSelectionSummary}>
                      <Text style={styles.triageSelectionLabel}>{t('triage.selected')}</Text>
                      <Text style={styles.triageSelectionValue}>
                        {selectedLocation?.label} · {selectedSymptom?.label}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('triage.intensityMild')}
                      accessibilityHint={t('triage.intensityMildDesc')}
                      accessibilityState={{ disabled: busy }}
                      style={[styles.triageOptionBtn, styles.triageOptionMild]}
                      onPress={() => void submitTriage('MILD')}
                      disabled={busy}
                    >
                      <Ionicons name="leaf-outline" size={24} color="#ea580c" />
                      <View style={styles.triageOptionCopy}>
                        <Text style={styles.triageOptionMildText}>{t('triage.intensityMild')}</Text>
                        <Text style={styles.triageOptionDescription}>{t('triage.intensityMildDesc')}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ea580c" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('triage.intensityModerate')}
                      accessibilityHint={t('triage.intensityModerateDesc')}
                      accessibilityState={{ disabled: busy }}
                      style={[styles.triageOptionBtn, styles.triageOptionMild]}
                      onPress={() => void submitTriage('MODERATE')}
                      disabled={busy}
                    >
                      <Ionicons name="alert-circle-outline" size={24} color="#ea580c" />
                      <View style={styles.triageOptionCopy}>
                        <Text style={styles.triageOptionMildText}>{t('triage.intensityModerate')}</Text>
                        <Text style={styles.triageOptionDescription}>{t('triage.intensityModerateDesc')}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#ea580c" />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('triage.intensityUrgent')}
                      accessibilityHint={t('triage.intensityUrgentDesc')}
                      accessibilityState={{ disabled: busy }}
                      style={[styles.triageOptionBtn, styles.triageOptionUrgent]}
                      onPress={() => void submitTriage('URGENT')}
                      disabled={busy}
                    >
                      <Ionicons name="warning-outline" size={24} color="#dc2626" />
                      <View style={styles.triageOptionCopy}>
                        <Text style={styles.triageOptionUrgentText}>{t('triage.intensityUrgent')}</Text>
                        <Text style={styles.triageOptionDescription}>{t('triage.intensityUrgentDesc')}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={20} color="#dc2626" />
                    </Pressable>
                  </>
                )}

                {busy && <ActivityIndicator color="#087f6d" />}
                <Text style={styles.triageGuarantee}>{t('triageGuarantee')}</Text>
              </View>

              <View style={styles.safetyFooterRow}>
                <Ionicons name="shield-checkmark-outline" size={22} color="#64748b" />
                <Text style={styles.safetyFooterText}>{t('safetyNote')}</Text>
              </View>
            </>
          )}

          <Image
            source={require('../../assets/images/checkin-call/call_bottom_deco.png')}
            style={styles.callBottomDeco}
            resizeMode="cover"
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f3fbf8' },
  connectionStatus: { paddingHorizontal: 18, paddingVertical: 8, gap: 4 },
  connectionHint: { color: '#475569', fontSize: 12, textAlign: 'center' },
  urgentActionText: { color: '#b91c1c', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  centerContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  heading: { fontSize: 28, fontWeight: '800', color: '#12453e', textAlign: 'center' },
  status: { fontSize: 16, color: '#475569', textAlign: 'center', lineHeight: 24 },
  description: { fontSize: 18, color: '#334155', lineHeight: 27, textAlign: 'center', marginVertical: 10 },
  button: { minHeight: 76, borderRadius: 18, alignItems: 'center', justifyContent: 'center', padding: 16 },
  buttonText: { color: '#fff', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  ok: { backgroundColor: '#087f6d' },
  mild: { backgroundColor: '#cc8a17' },
  urgent: { backgroundColor: '#bd2b39' },
  replay: { paddingVertical: 14, alignItems: 'center' },
  replayText: { color: '#087f6d', fontSize: 17, fontWeight: '700' },
  error: { color: '#b91c1c', textAlign: 'center' },
  processingFeedback: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10 },
  processingText: { flex: 1, color: '#087f6d', fontSize: 15, lineHeight: 23 },
  foot: { color: '#64748b', textAlign: 'center', fontSize: 12, marginTop: 18 },

  // Incoming Screen 2
  incomingWrapper: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 68,
    paddingBottom: 40,
    alignItems: 'center',
    position: 'relative',
  },
  incomingLogo: {
    width: 140,
    height: 42,
    marginBottom: 32,
  },
  incomingCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#d1fae5',
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    zIndex: 2,
  },
  doctorAvatarImg: {
    width: 110,
    height: 104,
    marginBottom: 14,
  },
  incomingPill: {
    backgroundColor: '#d1fae5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 12,
  },
  incomingPillText: {
    color: '#0f766e',
    fontWeight: '700',
    fontSize: 14,
  },
  incomingCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f3e36',
    textAlign: 'center',
    marginBottom: 6,
  },
  incomingCardSub: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#cbd5e1',
  },
  dotActive: {
    backgroundColor: '#059669',
  },
  callButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    maxWidth: 320,
    marginTop: 36,
    zIndex: 2,
  },
  callButtonWrap: {
    alignItems: 'center',
    gap: 8,
  },
  callCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  decline: { backgroundColor: '#dc2626' },
  accept: { backgroundColor: '#059669' },
  hangupIcon: { transform: [{ rotate: '135deg' }] },
  callButtonLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f3e36',
  },
  callBottomDeco: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 125,
    opacity: 0.9,
  },

  // Screen 2: Result (Image 2)
  resultFullWrapper: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#f3fbf8',
  },
  resultSuccessArt: {
    width: 140,
    height: 110,
    marginBottom: 10,
    zIndex: 2,
  },
  resultWarningIcon: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    zIndex: 2,
  },
  resultHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f3e36',
    textAlign: 'center',
    marginTop: 10,
    zIndex: 2,
  },
  resultSub: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  resultCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2f2ec',
    paddingHorizontal: 18,
    paddingVertical: 14,
    marginTop: 26,
    zIndex: 2,
    shadowColor: '#059669',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
  },
  resultRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    minWidth: 0,
  },
  resultRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f3e36',
  },
  resultPill: {
    backgroundColor: '#e6f7f2',
    borderRadius: 12,
    flexShrink: 1,
    maxWidth: '50%',
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  resultPillTextResolved: {
    color: '#00897b',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  resultPillWarning: {
    backgroundColor: '#fef3c7',
  },
  resultPillTextWarning: {
    color: '#92400e',
  },
  resultPillTextTime: {
    color: '#0f3e36',
    fontWeight: '700',
    fontSize: 14,
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 6,
  },
  resultCloseBtn: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#00897b',
    borderRadius: 18,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 26,
    zIndex: 2,
    shadowColor: '#00897b',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  resultCloseBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Screen 1: Family Urgent Call (Image 1)
  familyScrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 48,
    alignItems: 'center',
    position: 'relative',
    backgroundColor: '#f3fbf8',
  },
  familyCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 2,
  },
  familyCardUrgent: {
    backgroundColor: '#fff5f5',
    borderColor: '#ffe4e6',
  },
  familyCardMild: {
    backgroundColor: '#fffdf0',
    borderColor: '#fef08a',
  },
  urgentBadgeCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  familyCardTitle: {
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  familyCardTitleUrgent: {
    color: '#dc2626',
  },
  familyCardTitleMild: {
    color: '#d97706',
  },
  familyCardSubtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  reportedIssueBox: {
    width: '100%',
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 3,
  },
  reportedIssueLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  reportedIssueValue: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  familyActionsCol: {
    width: '100%',
    maxWidth: 360,
    gap: 12,
    zIndex: 2,
  },
  familyActionBtn: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  familyActionBtnUrgent: {
    backgroundColor: '#c83244',
  },
  familyActionBtnMild: {
    backgroundColor: '#d97706',
  },
  familyActionTextUrgent: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  familyFootnoteText: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
    width: '100%',
    maxWidth: 360,
    marginTop: 16,
    paddingHorizontal: 4,
    zIndex: 2,
  },
  replayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    zIndex: 2,
  },
  replayRowText: {
    color: '#00897b',
    fontSize: 15,
    fontWeight: '700',
  },

  // User Connected View
  userCallCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: '#ffffff',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#e2f2ec',
    paddingTop: 16,
    paddingBottom: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    zIndex: 2,
    shadowColor: '#059669',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  userCallHeroArt: {
    width: '100%',
    height: 110,
    marginBottom: 8,
  },
  userHeadsetIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  userCardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0f3e36',
    textAlign: 'center',
    marginBottom: 6,
  },
  userCardSub: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
    paddingHorizontal: 6,
  },
  userCardOptionsCol: {
    width: '100%',
    gap: 12,
  },
  userChoiceCard: {
    width: '100%',
    minHeight: 66,
    borderRadius: 20,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  userChoiceCardOk: {
    backgroundColor: '#eefaf5',
    borderColor: '#cceee2',
  },
  userChoiceCardMild: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  userChoiceCardUrgent: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  userChoiceDirectIcon: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userChoiceText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  userChoiceTextOk: {
    color: '#064e3b',
  },
  userChoiceTextMild: {
    color: '#9a3412',
  },
  userChoiceTextUrgent: {
    color: '#991b1b',
  },
  replayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#e0f2fe',
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 20,
    marginBottom: 16,
  },
  replayPillText: {
    color: '#0284c7',
    fontSize: 14,
    fontWeight: '700',
  },
  safetyFooterRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
    paddingTop: 14,
    marginTop: 4,
  },
  safetyFooterText: {
    flex: 1,
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
  },
  userOptionBtn: {
    minHeight: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: '100%',
  },
  userOptionOk: {
    backgroundColor: '#00897b',
  },
  userOptionMild: {
    backgroundColor: '#d97706',
  },
  userOptionUrgent: {
    backgroundColor: '#c83244',
  },
  userOptionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  triageOptionBtn: {
    width: '100%',
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  triageOptionMild: {
    backgroundColor: '#fff7ed',
    borderColor: '#fed7aa',
  },
  triageOptionUrgent: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  triageOptionNeutral: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  triageOptionCopy: {
    flex: 1,
    minWidth: 0,
  },
  triageOptionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  triageOptionTitle: {
    color: '#1e293b',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  triageOptionDescription: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  triageProgress: {
    color: '#087f6d',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  triageBackButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#e6f5f1',
  },
  triageBackButtonText: {
    color: '#087f6d',
    fontSize: 14,
    fontWeight: '700',
  },
  triageContextNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: '#e6f5f1',
  },
  triageContextNoteText: {
    flex: 1,
    color: '#0d6857',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  recentBadge: {
    borderRadius: 10,
    backgroundColor: '#e6f5f1',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recentBadgeText: {
    color: '#0d6857',
    fontSize: 11,
    fontWeight: '700',
  },
  urgentBadge: {
    borderRadius: 10,
    backgroundColor: '#ffe4e6',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  urgentBadgeText: {
    color: '#9f2433',
    fontSize: 11,
    fontWeight: '700',
  },
  triageSelectionSummary: {
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 3,
  },
  triageSelectionLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  triageSelectionValue: {
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '700',
  },
  triageOptionMildText: {
    flex: 1,
    color: '#7c4707',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  triageOptionUrgentText: {
    flex: 1,
    color: '#9f2433',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  triageGuarantee: {
    color: '#64748b',
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});
