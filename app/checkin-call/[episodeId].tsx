import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitRoom } from '@livekit/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { Audio } from '../../src/lib/audio';
import {
  checkinCallApi,
  type CheckinCallAttempt,
  type CheckinCallIssueCategory,
  type CheckinCallTriageContext,
  type CheckinCallTriageLocation,
  type CheckinCallTriageSelection,
  type CheckinCallTriageSymptom,
} from '../../src/features/checkin-call/checkin-call.api';
import { endVoipCall, simulateIncomingVoipCall } from '../../src/lib/voip';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { useTranslation } from 'react-i18next';

const AUDIO_TRANSLATION_KEYS: Record<string, string> = {
  user_prompt: 'audio.userPrompt',
  triage_prompt: 'audio.triagePrompt',
  triage_location_prompt: 'audio.triageLocationPrompt',
  triage_symptom_prompt: 'audio.triageSymptomPrompt',
  triage_intensity_prompt: 'audio.triageIntensityPrompt',
  user_ok: 'audio.userOk',
  user_mild: 'audio.userMild',
  user_urgent: 'audio.userUrgent',
  user_retry: 'audio.userRetry',
  family_mild: 'audio.familyMild',
  family_urgent: 'audio.familyUrgent',
  family_unknown: 'audio.familyUnknown',
};

const CLOSED = new Set(['RESOLVED', 'EXHAUSTED', 'EXHAUSTED_MILD', 'EXHAUSTED_URGENT', 'CANCELLED']);

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
  const { t, i18n } = useTranslation('checkinCall');
  const language = i18n.resolvedLanguage?.startsWith('en') ? 'en' : 'vi';
  const params = useLocalSearchParams<{ episodeId: string; attemptId?: string; nativeAnswered?: string }>();
  const episodeId = typeof params.episodeId === 'string' ? params.episodeId : '';
  const incomingAttemptId = typeof params.attemptId === 'string' ? params.attemptId : '';
  const answeredFromCallKit = params.nativeAnswered === '1';
  const [attempt, setAttempt] = useState<CheckinCallAttempt | null>(null);
  const [room, setRoom] = useState<{ token: string; url: string } | null>(null);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ended, setEnded] = useState(false);
  const [triageOpen, setTriageOpen] = useState(false);
  const [triageStep, setTriageStep] = useState<TriageStep>('location');
  const [triageContext, setTriageContext] = useState<CheckinCallTriageContext | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<CheckinCallTriageLocation | null>(null);
  const [selectedSymptom, setSelectedSymptom] = useState<CheckinCallTriageSymptom | null>(null);
  const [error, setError] = useState('');
  const [statusKey, setStatusKey] = useState('statusPreparing');
  const sound = useRef<Awaited<ReturnType<typeof Audio.Sound.createAsync>>['sound'] | null>(null);
  const playbackVersion = useRef(0);
  const loadedAudio = useRef(new Set<string>());
  const accepted = useRef(false);
  const acceptPromise = useRef<ReturnType<typeof checkinCallApi.accept> | null>(null);

  const resultCopy = (() => {
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

  const stopAudio = useCallback(async () => {
    playbackVersion.current += 1;
    Speech.stop();
    const current = sound.current;
    sound.current = null;
    try {
      await current?.unloadAsync();
    } catch {
      // The player may already be released by a call-end event.
    }
  }, []);

  const play = useCallback(async (key: string) => {
    const version = playbackVersion.current + 1;
    playbackVersion.current = version;
    try {
      Speech.stop();
      const previous = sound.current;
      sound.current = null;
      await previous?.unloadAsync();
      const localizedKey = language + '-' + key;
      const uri = (FileSystem.cacheDirectory || FileSystem.documentDirectory) + 'checkin-call-' + localizedKey + '.mp3';
      if (!loadedAudio.current.has(localizedKey)) {
        const info = await FileSystem.getInfoAsync(uri);
        try {
          const result = await checkinCallApi.audio(key);
          await FileSystem.writeAsStringAsync(uri, result.base64, { encoding: 'base64' });
        } catch (e) {
          if (!info.exists) throw e;
        }
        loadedAudio.current.add(localizedKey);
      }
      if (playbackVersion.current !== version) return;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const created = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      if (playbackVersion.current !== version) {
        await created.sound.unloadAsync();
      } else {
        sound.current = created.sound;
      }
    } catch {
      if (playbackVersion.current !== version) return;
      // Device speech is a safety fallback if the cached VieNeu asset is unavailable.
      Speech.speak(t(AUDIO_TRANSLATION_KEYS[key] || 'audio.userRetry'), {
        language: language === 'en' ? 'en-US' : 'vi-VN',
        rate: 0.85,
      });
    }
  }, [language, t]);

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
        setAttempt(result.attempt);
        if (CLOSED.has(result.attempt.episode_state) || ['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(result.attempt.state)) {
          void endVoipCall(result.attempt.id);
          setEnded(true);
          setStatusKey('statusEnded');
          return;
        }
        if (
          result.attempt.target_role === 'USER' &&
          result.attempt.episode_state === 'TRIAGE_USER'
        ) {
          const triageResult = await checkinCallApi.startTriage(episodeId);
          if (!live) return;
          setTriageContext(triageResult.triage);
          setTriageOpen(true);
          setTriageStep('location');
        }
        if (result.attempt.target_role === 'FAMILY') void checkinCallApi.seen(id).catch(() => {});
        try {
          const connection = await checkinCallApi.token(id);
          if (live) setRoom({ token: connection.token, url: connection.url });
        } catch {
          if (live) setStatusKey('statusConnectionUnavailable');
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
  }, [episodeId, incomingAttemptId, stopAudio, t]);

  const pollingAttemptId = attempt?.id;
  useEffect(() => {
    if (!pollingAttemptId || ended) return;
    const interval = setInterval(() => {
      void checkinCallApi.attempt(pollingAttemptId).then(({ attempt: latest }) => {
        setAttempt(latest);
        if (CLOSED.has(latest.episode_state) || ['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(latest.state)) {
          void endVoipCall(latest.id);
          void stopAudio();
          setEnded(true);
          setRoom(null);
          setStatusKey('statusEnded');
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingAttemptId, ended, stopAudio]);

  const onConnected = useCallback(() => {
    setStatusKey('statusConnected');
  }, []);

  const join = useCallback(() => {
    if (!attempt || joined) return;
    setJoined(true);
    setStatusKey(room ? 'statusConnecting' : 'statusNoLiveKit');
    if (!accepted.current) {
      accepted.current = true;
      acceptPromise.current = checkinCallApi.accept(attempt.id);
      void acceptPromise.current.then(({ state, confirm_deadline }) => {
        if (confirm_deadline) {
          setAttempt((current) =>
            current ? { ...current, confirm_deadline } : current,
          );
        }
        if (state === 'URGENT_ACKNOWLEDGED') setStatusKey('statusUrgentAccepted');
      }).catch(() => {
        accepted.current = false;
        acceptPromise.current = null;
        setStatusKey('statusAcceptFailed');
      });
    }
    void play(
      attempt.target_role === 'USER'
        ? attempt.episode_state === 'TRIAGE_USER'
          ? 'triage_location_prompt'
          : 'user_prompt'
        : attempt.severity === 'URGENT'
          ? 'family_urgent'
          : attempt.severity === 'MILD'
            ? 'family_mild'
            : 'family_unknown',
    );
  }, [attempt, joined, play, room]);

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
    const timer = setTimeout(() => void play('user_retry'), delay);
    return () => clearTimeout(timer);
  }, [attempt?.confirm_deadline, attempt?.target_role, busy, ended, joined, play, triageOpen]);

  const openTriage = async () => {
    if (busy || !episodeId) return;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      const result = await checkinCallApi.startTriage(episodeId);
      setTriageContext(result.triage);
      setSelectedLocation(null);
      setSelectedSymptom(null);
      setTriageStep('location');
      setTriageOpen(true);
      void play('triage_location_prompt');
    } catch (e) {
      setError(getApiErrorMessage(e, t, 'errorStartTriage'));
    } finally {
      setBusy(false);
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
    location = selectedLocation,
    symptom = selectedSymptom,
  ) => {
    if (busy || !episodeId || !location || !symptom) return;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      const result = await checkinCallApi.completeTriage(episodeId, {
        body_location: location.key,
        symptom: symptom.key,
        intensity,
      });
      if (attempt?.id) await endVoipCall(attempt.id);
      setEnded(true);
      setRoom(null);
      const noEligibleFamily = ['EXHAUSTED', 'EXHAUSTED_MILD', 'EXHAUSTED_URGENT'].includes(
        result.episode.state,
      );
      setStatusKey(
        noEligibleFamily
          ? 'statusFamilyUnavailable'
          : intensity === 'URGENT'
            ? 'statusUserUrgent'
            : 'statusUserMild',
      );
      void play(intensity === 'URGENT' ? 'user_urgent' : 'user_mild');
      if (!noEligibleFamily) void simulateNextFamilyCall();
    } catch (e) {
      setError(getApiErrorMessage(e, t, 'errorSendTriage'));
    } finally {
      setBusy(false);
    }
  };

  const chooseLocation = async (location: CheckinCallTriageLocation) => {
    if (busy) return;
    await stopAudio();
    setSelectedLocation(location);
    setSelectedSymptom(null);
    setTriageStep('symptom');
    void play('triage_symptom_prompt');
  };

  const chooseSymptom = async (symptom: CheckinCallTriageSymptom) => {
    if (busy) return;
    await stopAudio();
    setSelectedSymptom(symptom);
    if (symptom.urgent) {
      await submitTriage('URGENT', selectedLocation, symptom);
      return;
    }
    setTriageStep('intensity');
    void play('triage_intensity_prompt');
  };

  const goBackInTriage = async () => {
    if (busy || triageStep === 'location') return;
    await stopAudio();
    if (triageStep === 'intensity') {
      setSelectedSymptom(null);
      setTriageStep('symptom');
      void play('triage_symptom_prompt');
      return;
    }
    setSelectedLocation(null);
    setSelectedSymptom(null);
    setTriageStep('location');
    void play('triage_location_prompt');
  };

  const answer = async (choice: 1 | 2 | 3, issueCategory?: CheckinCallIssueCategory) => {
    if (busy || !episodeId) return;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      const result = await checkinCallApi.answer(episodeId, choice, issueCategory);
      if (attempt?.id) await endVoipCall(attempt.id);
      setEnded(true);
      setRoom(null);
      const noEligibleFamily = ['EXHAUSTED', 'EXHAUSTED_MILD', 'EXHAUSTED_URGENT'].includes(
        result.episode.state,
      );
      setStatusKey(
        noEligibleFamily
          ? 'statusFamilyUnavailable'
          : choice === 1
            ? 'statusUserOk'
            : choice === 2
              ? 'statusUserMild'
              : 'statusUserUrgent',
      );
      void play(choice === 1 ? 'user_ok' : choice === 2 ? 'user_mild' : 'user_urgent');
      if (choice !== 1 && !noEligibleFamily) void simulateNextFamilyCall();
    } catch (e) {
      setError(getApiErrorMessage(e, t, 'errorSendChoice'));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (action: 'ACCEPT_AND_CHECK' | 'ON_MY_WAY' | 'CALLED_USER') => {
    if (busy || !attempt) return;
    setBusy(true);
    setError('');
    try {
      await stopAudio();
      if (acceptPromise.current) await acceptPromise.current;
      else if (!accepted.current) await checkinCallApi.accept(attempt.id);
      await checkinCallApi.confirmFamily(episodeId, action);
      await endVoipCall(attempt.id);
      setEnded(true);
      setRoom(null);
      setStatusKey('statusFamilyConfirmed');
    } catch (e) {
      setError(getApiErrorMessage(e, t, 'errorConfirm'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      {!!room && joined && !ended && (
        <LiveKitRoom
          serverUrl={room.url}
          token={room.token}
          audio={false}
          video={false}
          onConnected={onConnected}
          onError={() => setStatusKey('statusConnectionLost')}
        />
      )}

      {!attempt && (
        <View style={styles.centerContainer}>
          {!error && <ActivityIndicator size="large" color="#059669" />}
          <Text style={styles.status}>{error || t(statusKey)}</Text>
          {!!error && (
            <Pressable style={styles.replay} onPress={() => router.back()}>
              <Text style={styles.replayText}>{t('close', { ns: 'common' })}</Text>
            </Pressable>
          )}
        </View>
      )}

      {!!attempt && !joined && !ended && (
        <View style={styles.incomingWrapper}>
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
            <Text style={styles.incomingCardTitle}>{t(attempt.target_role === 'FAMILY' ? 'familyHeading' : 'userHeading')}</Text>
            <Text style={styles.incomingCardSub}>{t('gallery.dailyCheck')}</Text>
            <View style={styles.dotsRow}>
              <View style={[styles.dot, styles.dotActive]} />
              <View style={[styles.dot, styles.dotActive]} />
              <View style={styles.dot} />
            </View>
          </View>

          <View style={styles.callButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('gallery.decline')}
              style={styles.callButtonWrap}
              onPress={() => {
                void stopAudio();
                void endVoipCall(attempt.id);
                router.back();
              }}
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
        </View>
      )}

      {/* Screen 2: Kết quả cuộc gọi (Call Ended / Resolved - Image 2) */}
      {ended && (
        <View style={styles.resultFullWrapper}>
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
          <Text style={styles.resultSub}>{resultCopy.message}</Text>

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

            <View style={styles.resultDivider} />

            <View style={styles.resultRow}>
              <View style={styles.resultRowLeft}>
                <Ionicons name="time-outline" size={24} color="#00897b" />
                <Text style={styles.resultRowLabel}>{t('gallery.timeLabel')}</Text>
              </View>
              <View style={styles.resultPill}>
                <Text style={styles.resultPillTextTime}>
                  {new Date().toLocaleTimeString(language === 'en' ? 'en-US' : 'vi-VN', {
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
            onPress={() => router.back()}
          >
            <Text style={styles.resultCloseBtnText}>{t('close', { ns: 'common' })}</Text>
          </Pressable>

          <Image
            source={require('../../assets/images/checkin-call/call_bottom_deco.png')}
            style={styles.callBottomDeco}
            resizeMode="cover"
          />
        </View>
      )}

      {/* Screen 1: Cuộc gọi người thân - Khẩn cấp (Family Urgent - Image 1) */}
      {!!attempt && joined && !ended && attempt.target_role === 'FAMILY' && (
        <ScrollView contentContainerStyle={styles.familyScrollContent}>
          <View style={[styles.familyCard, attempt.severity === 'URGENT' ? styles.familyCardUrgent : styles.familyCardMild]}>
            <View style={[styles.urgentBadgeCircle, attempt.severity === 'URGENT' ? styles.urgentBadgeCircleUrgent : styles.urgentBadgeCircleMild]}>
              <Ionicons
                name={attempt.severity === 'URGENT' ? 'warning-outline' : 'heart-outline'}
                size={36}
                color={attempt.severity === 'URGENT' ? '#dc2626' : '#d97706'}
              />
            </View>
            <Text style={[styles.familyCardTitle, attempt.severity === 'URGENT' ? styles.familyCardTitleUrgent : styles.familyCardTitleMild]}>
              {t(attempt.severity === 'URGENT' ? 'gallery.urgentFamilyTitle' : 'gallery.mildFamilyTitle')}
            </Text>
            <Text style={styles.familyCardSubtitle}>
              {t(attempt.severity === 'URGENT' ? 'gallery.urgentFamilyMessage' : 'gallery.mildFamilyMessage')}
            </Text>
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

          <View style={styles.familyActionsCol}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('confirmCheck')}
              accessibilityState={{ disabled: busy }}
              style={[styles.familyActionBtn, attempt.severity === 'URGENT' ? styles.familyActionBtnUrgent : styles.familyActionBtnMild]}
              onPress={() => void confirm('ACCEPT_AND_CHECK')}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.familyActionTextUrgent}>{t('confirmCheck')}</Text>
              )}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('confirmOnMyWay')}
              accessibilityState={{ disabled: busy }}
              style={[styles.familyActionBtn, styles.familyActionBtnMint]}
              onPress={() => void confirm('ON_MY_WAY')}
              disabled={busy}
            >
              <Text style={styles.familyActionTextMint}>{t('confirmOnMyWay')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('confirmCalled')}
              accessibilityState={{ disabled: busy }}
              style={[styles.familyActionBtn, styles.familyActionBtnMint]}
              onPress={() => void confirm('CALLED_USER')}
              disabled={busy}
            >
              <Text style={styles.familyActionTextMint}>{t('confirmCalled')}</Text>
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('replay')}
            style={styles.replayRow}
            onPress={() =>
              void play(
                attempt.severity === 'URGENT'
                  ? 'family_urgent'
                  : attempt.severity === 'MILD'
                    ? 'family_mild'
                    : 'family_unknown',
              )
            }
          >
            <Ionicons name="volume-high-outline" size={20} color="#00897b" />
            <Text style={styles.replayRowText}>{t('replay')}</Text>
          </Pressable>

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
        <ScrollView contentContainerStyle={styles.familyScrollContent}>
          {!triageOpen ? (
            <View style={styles.userCallCard}>
              <Image
                source={require('../../assets/images/checkin-call/checkin_call_hero_art.png')}
                style={styles.userCallHeroArt}
                resizeMode="contain"
              />
              <Text style={styles.userCardTitle}>{t('userHeading')}</Text>
              <Text style={styles.userCardSub}>{t('gallery.connectedInstruction')}</Text>

              {!!error && <Text style={styles.error}>{error}</Text>}

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

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('replay')}
                style={styles.replayPill}
                onPress={() => void play('user_prompt')}
                disabled={busy}
              >
                <Ionicons name="volume-high" size={20} color="#0284c7" />
                <Text style={styles.replayPillText}>{t('replay')}</Text>
              </Pressable>

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
              </View>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.familyActionsCol}>
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
                  triageContext?.locations.map((location) => (
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
                  selectedLocation?.symptoms.map((symptom) => (
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

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('replay')}
                style={styles.replayPill}
                onPress={() =>
                  void play(
                    triageStep === 'location'
                      ? 'triage_location_prompt'
                      : triageStep === 'symptom'
                        ? 'triage_symptom_prompt'
                        : 'triage_intensity_prompt',
                  )
                }
              >
                <Ionicons name="volume-high" size={20} color="#0284c7" />
                <Text style={styles.replayPillText}>{t('replay')}</Text>
              </Pressable>

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
  foot: { color: '#64748b', textAlign: 'center', fontSize: 12, marginTop: 18 },

  // Incoming Screen 2
  incomingWrapper: {
    flex: 1,
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
    flex: 1,
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
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
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
    paddingVertical: 8,
  },
  resultRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultRowLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f3e36',
  },
  resultPill: {
    backgroundColor: '#e6f7f2',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  resultPillTextResolved: {
    color: '#00897b',
    fontWeight: '700',
    fontSize: 13,
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
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
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
    borderWidth: 5,
  },
  urgentBadgeCircleUrgent: {
    backgroundColor: '#fee2e2',
    borderColor: '#fff1f2',
  },
  urgentBadgeCircleMild: {
    backgroundColor: '#fef3c7',
    borderColor: '#fefce8',
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
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  familyActionBtnUrgent: {
    backgroundColor: '#c83244',
  },
  familyActionBtnMild: {
    backgroundColor: '#d97706',
  },
  familyActionBtnMint: {
    backgroundColor: '#e6f5f1',
  },
  familyActionTextUrgent: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  familyActionTextMint: {
    color: '#0d6857',
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
    backgroundColor: '#d1fae5',
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
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
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
