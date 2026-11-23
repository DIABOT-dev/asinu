import { usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, type AppStateStatus } from 'react-native';
import { AppAlertModal } from '../../components/AppAlertModal';
import { useCheckinPresentationBlocked } from '../../hooks/useCheckinPresentation';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { isExpertConsultationEnabled } from '../../lib/appEnv';
import { useAuthStore } from '../auth/auth.store';
import { useGuidanceStore } from '../guidance/guidance.store';
import { isOpenConsultation, listConsultationTasks } from './consultation-tasks';

export function ConsultationEntryPrompt() {
  const { t } = useTranslation('home');
  const pathname = usePathname();
  const router = useGuardedRouter();
  const token = useAuthStore((state) => state.token);
  const ready = useAuthStore((state) => state.hydrated && !state.loading);
  const account = useAuthStore((state) =>
    state.profile?.onboardingCompleted && state.profile.id != null ? String(state.profile.id) : null,
  );
  const welcomed = useGuidanceStore(
    (state) => state.account === account && state.ready && state.progress.welcomeSeen && !state.welcomeOpen,
  );
  const checkinBlocked = useCheckinPresentationBlocked();
  const [{ active, visit }, setForeground] = useState(() => ({
    active: AppState.currentState === 'active',
    visit: 0,
  }));
  const entry = token && account ? `${account}:${visit}` : null;
  const canShow = Boolean(entry && ready && welcomed && active && pathname === '/home' && !checkinBlocked);
  const checkedEntry = useRef<string | null>(null);
  const [prompt, setPrompt] = useState<{ entry: string; taskId: string; tenantId: string } | null>(null);
  const currentEntry = useRef({ canShow, entry });
  currentEntry.current = { canShow, entry };

  useEffect(() => {
    const update = (state: AppStateStatus) => {
      if (state === 'background') {
        setForeground((current) => current.active ? { ...current, active: false } : current);
      } else if (state === 'active') {
        setForeground((current) => current.active ? current : { active: true, visit: current.visit + 1 });
      }
    };
    const subscription = AppState.addEventListener('change', update);
    update(AppState.currentState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isExpertConsultationEnabled) return;
    if (!entry) checkedEntry.current = null;
    if (pathname === '/doctor-consultation' || pathname.startsWith('/doctor-consultation/') ||
      pathname.startsWith('/doctor-interview/')) {
      checkedEntry.current = entry;
    }
    if (!canShow || !entry) {
      setPrompt(null);
      return;
    }
    if (checkedEntry.current === entry) return;

    const controller = new AbortController();
    void listConsultationTasks(controller.signal).then((tasks) => {
      if (controller.signal.aborted || !currentEntry.current.canShow || currentEntry.current.entry !== entry ||
        useAuthStore.getState().token !== token) return;
      checkedEntry.current = entry;
      const task = tasks.find((item) => item.task_id && item.tenant_id && isOpenConsultation(item));
      if (task?.tenant_id) setPrompt({ entry, taskId: task.task_id, tenantId: task.tenant_id });
    }).catch(() => {
      // The history screen remains available for a manual retry.
    });
    return () => controller.abort();
  }, [canShow, entry, pathname, token]);

  const openConversation = () => {
    if (!isExpertConsultationEnabled) return;
    if (!prompt || !currentEntry.current.canShow || currentEntry.current.entry !== prompt.entry ||
      useAuthStore.getState().token !== token) return;
    router.push({
      pathname: '/doctor-consultation/[taskId]',
      params: { taskId: prompt.taskId, tenantId: prompt.tenantId },
    });
  };

  return (
    <AppAlertModal
      queued
      scrollable
      stackButtons
      visible={canShow && Boolean(prompt && prompt.entry === entry)}
      title={t('doctorConsultationActiveTitle')}
      icon={{ name: 'chat-processing-outline' }}
      onDismiss={() => setPrompt(null)}
      buttons={[
        { text: t('doctorConsultationOpenActive'), variant: 'primary', onPress: openConversation },
        { text: t('doctorConsultationContinueLater'), style: 'cancel' },
      ]}
    />
  );
}
