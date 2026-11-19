import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { readAiDataConsent, revokeAiDataConsent } from '../../lib/aiDataConsent';
import { setHealthFeedPreference } from '../../stores/health-feed-preference';
import { showToast } from '../../stores/toast.store';
import { useAuthStore } from '../auth/auth.store';
import { getNotificationPreferences } from '../notifications/notifications.api';

/** Keep controllers outside the permission dialog while confirmations use the presenter. */
export function useDataReminderPermissions(visible: boolean) {
  const { t } = useTranslation('settings');
  const { t: tc } = useTranslation('common');
  const token = useAuthStore(state => state.token);
  const [snapshot, setSnapshot] = useState<{
    token: string | null; ai: boolean | null; feed: boolean | null;
  }>({ token: null, ai: null, feed: null });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState<'ai' | 'feed' | null>(null);
  const focused = useRef(false);
  const generation = useRef(0);
  const read = useRef(0);
  const operation = useRef<object | null>(null);
  const promptOwner = useRef<{ kind: 'ai' | 'feed'; version: number } | null>(null);
  const current = useCallback((version: number) =>
    focused.current && generation.current === version && useAuthStore.getState().token === token,
  [token]);
  const refresh = useCallback(async () => {
    if (!current(generation.current) || operation.current) return;
    const version = generation.current, request = ++read.current;
    setLoading(true);
    const [ai, feed] = await Promise.allSettled([readAiDataConsent(), getNotificationPreferences()]);
    if (!current(version) || read.current !== request || operation.current) return;
    setSnapshot({ token,
      ai: ai.status === 'fulfilled' ? ai.value : null,
      feed: feed.status === 'fulfilled' && feed.value.ok && typeof feed.value.health_feed_enabled === 'boolean'
        ? feed.value.health_feed_enabled : null });
    setLoading(false);
  }, [current, token]);
  useFocusEffect(useCallback(() => {
    focused.current = visible;
    generation.current++;
    operation.current = null;
    promptOwner.current = null;
    setBusy(false);
    setLoading(true);
    setPrompt(null);
    if (visible) void refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && focused.current && !operation.current && promptOwner.current === null) void refresh();
    });
    return () => {
      focused.current = false;
      generation.current++;
      read.current++;
      operation.current = null;
      promptOwner.current = null;
      subscription.remove();
    };
  }, [refresh, token, visible]));
  const cancel = () => { promptOwner.current = null; setPrompt(null); };
  const save = async (kind: 'ai' | 'feed', next: boolean) => {
    if (!current(generation.current) || operation.current) return;
    const owner = {}, version = generation.current;
    operation.current = owner;
    read.current++;
    setBusy(true);
    try {
      let saved: boolean;
      if (kind === 'ai') {
        await revokeAiDataConsent();
        saved = false;
      } else saved = await setHealthFeedPreference(next);
      if (!current(version) || operation.current !== owner) return;
      setSnapshot(previous => ({ ...previous, token, [kind]: saved }));
      if (saved !== next) throw new Error('Preference was not accepted');
      showToast(t(kind === 'ai' ? 'aiDataConsentRevoked'
        : saved ? 'healthFeedEnabled' : 'healthFeedDisabled'), 'success');
    } catch {
      if (current(version) && operation.current === owner) showToast(tc('saveError'), 'error');
    } finally {
      if (current(version) && operation.current === owner) {
        operation.current = null;
        setBusy(false);
        setLoading(false);
      }
    }
  };
  const change = (kind: 'ai' | 'feed', next: boolean) => {
    if (loading || !current(generation.current) || operation.current || promptOwner.current !== null ||
      snapshot.token !== token || snapshot[kind] === null) return;
    if (next) {
      promptOwner.current = { kind, version: generation.current };
      setPrompt(kind);
    } else void save(kind, false);
  };
  const expectedPrompt = promptOwner.current;
  return {
    ai: snapshot.token === token ? snapshot.ai : null,
    feed: snapshot.token === token ? snapshot.feed : null,
    busy, loading: loading || snapshot.token !== token, prompt, refresh, change, cancel,
    agreeAi: () => {
      if (expectedPrompt?.kind !== 'ai' || promptOwner.current !== expectedPrompt || !current(expectedPrompt.version)) return;
      setSnapshot(previous => ({ ...previous, token, ai: true }));
      cancel();
      showToast(t('aiDataConsentGranted'), 'success');
    },
    agreeFeed: () => {
      if (expectedPrompt?.kind !== 'feed' || promptOwner.current !== expectedPrompt || !current(expectedPrompt.version)) return;
      cancel();
      void save('feed', true);
    },
  };
}
