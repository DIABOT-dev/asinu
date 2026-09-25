import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LiveKitRoom } from '@livekit/react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Speech from 'expo-speech';
import { Audio } from '../../src/lib/audio';
import { checkinCallApi, type CheckinCallAttempt } from '../../src/features/checkin-call/checkin-call.api';
import { endVoipCall } from '../../src/lib/voip';
import { getApiErrorMessage } from '../../src/lib/apiClient';
import { useTranslation } from 'react-i18next';

const AUDIO_TRANSLATION_KEYS: Record<string, string> = {
  user_prompt: 'audio.userPrompt',
  user_ok: 'audio.userOk',
  user_mild: 'audio.userMild',
  user_urgent: 'audio.userUrgent',
  user_retry: 'audio.userRetry',
  family_mild: 'audio.familyMild',
  family_urgent: 'audio.familyUrgent',
  family_unknown: 'audio.familyUnknown',
};

const CLOSED = new Set(['RESOLVED', 'EXHAUSTED', 'EXHAUSTED_MILD', 'EXHAUSTED_URGENT', 'CANCELLED']);

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
  const [error, setError] = useState('');
  const [statusKey, setStatusKey] = useState('statusPreparing');
  const sound = useRef<Awaited<ReturnType<typeof Audio.Sound.createAsync>>['sound'] | null>(null);
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

  const play = useCallback(async (key: string) => {
    try {
      Speech.stop();
      await sound.current?.unloadAsync();
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
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const created = await Audio.Sound.createAsync({ uri }, { shouldPlay: true });
      sound.current = created.sound;
    } catch {
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
      Speech.stop();
      void sound.current?.unloadAsync();
    };
  }, [episodeId, incomingAttemptId, t]);

  useEffect(() => {
    if (!attempt || ended) return;
    const interval = setInterval(() => {
      void checkinCallApi.attempt(attempt.id).then(({ attempt: latest }) => {
        setAttempt(latest);
        if (CLOSED.has(latest.episode_state) || ['CANCELLED', 'EXPIRED', 'COMPLETED'].includes(latest.state)) {
          void endVoipCall(latest.id);
          setEnded(true);
          setRoom(null);
          setStatusKey('statusEnded');
        }
      }).catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [attempt?.id, ended]);

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
      void acceptPromise.current.then(({ state }) => {
        if (state === 'URGENT_ACKNOWLEDGED') setStatusKey('statusUrgentAccepted');
      }).catch(() => {
        accepted.current = false;
        acceptPromise.current = null;
        setStatusKey('statusAcceptFailed');
      });
    }
    void play(attempt.target_role === 'USER' ? 'user_prompt' : attempt.severity === 'URGENT' ? 'family_urgent' : attempt.severity === 'MILD' ? 'family_mild' : 'family_unknown');
  }, [attempt, joined, play, room]);

  useEffect(() => {
    if (answeredFromCallKit && attempt && !joined && !ended) join();
  }, [answeredFromCallKit, attempt, ended, join, joined]);

  const answer = async (choice: 1 | 2 | 3) => {
    if (busy || !episodeId) return;
    setBusy(true);
    setError('');
    try {
      const result = await checkinCallApi.answer(episodeId, choice);
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
            <Pressable style={styles.callButtonWrap} onPress={() => router.back()}>
              <View style={[styles.callCircle, styles.decline]}>
                <Ionicons name="call" size={28} color="#ffffff" style={styles.hangupIcon} />
              </View>
              <Text style={styles.callButtonLabel}>{t('gallery.decline')}</Text>
            </Pressable>
            <Pressable style={styles.callButtonWrap} onPress={join}>
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

          <Pressable style={styles.resultCloseBtn} onPress={() => router.back()}>
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
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.familyActionsCol}>
            <Pressable
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
              style={[styles.familyActionBtn, styles.familyActionBtnMint]}
              onPress={() => void confirm('ON_MY_WAY')}
              disabled={busy}
            >
              <Text style={styles.familyActionTextMint}>{t('confirmOnMyWay')}</Text>
            </Pressable>
            <Pressable
              style={[styles.familyActionBtn, styles.familyActionBtnMint]}
              onPress={() => void confirm('CALLED_USER')}
              disabled={busy}
            >
              <Text style={styles.familyActionTextMint}>{t('confirmCalled')}</Text>
            </Pressable>
          </View>

          <Pressable
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
          <View style={styles.userCallCard}>
            <View style={styles.userHeadsetIconWrap}>
              <Ionicons name="headset-outline" size={32} color="#00897b" />
            </View>
            <Text style={styles.userCardTitle}>{t('userHeading')}</Text>
            <Text style={styles.userCardSub}>{t('gallery.connectedInstruction')}</Text>
          </View>

          {!!error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.familyActionsCol}>
            <Pressable style={[styles.userOptionBtn, styles.userOptionOk]} onPress={() => void answer(1)} disabled={busy}>
              <Text style={styles.userOptionText}>{t('choiceOk')}</Text>
            </Pressable>
            <Pressable style={[styles.userOptionBtn, styles.userOptionMild]} onPress={() => void answer(2)} disabled={busy}>
              <Text style={styles.userOptionText}>{t('choiceMild')}</Text>
            </Pressable>
            <Pressable style={[styles.userOptionBtn, styles.userOptionUrgent]} onPress={() => void answer(3)} disabled={busy}>
              <Text style={styles.userOptionText}>{t('choiceUrgent')}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.replayRow} onPress={() => void play('user_prompt')}>
            <Ionicons name="volume-high-outline" size={20} color="#00897b" />
            <Text style={styles.replayRowText}>{t('replay')}</Text>
          </Pressable>

          <Text style={styles.familyFootnoteText}>{t('safetyNote')}</Text>

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
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#d1fae5',
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 24,
    zIndex: 2,
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
    fontSize: 21,
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
});
