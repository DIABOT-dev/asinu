import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppUpdateExperience } from './AppUpdateExperience';
import { isProdBuild } from '../../lib/appEnv';
import { runNativePermission } from '../../lib/native-permissions';
import { getActiveVoipCalls, getPendingVoipCall } from '../../lib/voip';
import { showToast } from '../../stores/toast.store';
import { subscribeUpdateProgress } from './app-update.service';
import { useAppUpdateStore } from './app-update.store';
import { canPromptOnPath } from './update-policy';

export function AppUpdateGate() {
  const pathname = usePathname();
  const currentPath = useRef(pathname);
  currentPath.current = pathname;
  const { t } = useTranslation('common');
  const { update, visible, check, dismiss, install, phase, downloadedBytes, totalBytes, minimize, applyProgress } = useAppUpdateStore();
  const pendingAction = useRef(false);
  const [safe, setSafe] = useState(false);
  useEffect(() => {
    // Development builds are often newer than the store and must not nag testers.
    if (!isProdBuild) {return;}
    const checkWhenActive = () => { check().catch(() => {}); };
    const timer = setTimeout(checkWhenActive, 5000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') { checkWhenActive(); }
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [check]);
  useEffect(() => subscribeUpdateProgress(applyProgress), [applyProgress]);
  useEffect(() => {
    let cancelled = false;
    setSafe(false);
    if (!visible || !canPromptOnPath(pathname)) {return;}
    const verify = () => {
      Promise.all([getActiveVoipCalls(), getPendingVoipCall()]).then(([calls, pending]) => {
        if (!cancelled) {setSafe(calls.length === 0 && !pending);}
      }).catch(() => { if (!cancelled) { setSafe(false); } });
    };
    const timer = setTimeout(verify, 1000);
    const polling = setInterval(verify, 5000);
    return () => { cancelled = true; clearTimeout(timer); clearInterval(polling); };
  }, [visible, pathname]);
  const close = () => {
    if (phase === 'available' || phase === 'error' || phase === 'downloaded') { dismiss(); }
    else { minimize(); }
  };
  const afterDismiss = () => {
    if (!pendingAction.current) { return; }
    pendingAction.current = false;
    return runNativePermission(async () => {
      const [calls, pending] = await Promise.all([getActiveVoipCalls(), getPendingVoipCall()]);
      if (!calls.length && !pending) { await install(); }
    }, { key: 'app-update', settings: true, canRun: () => canPromptOnPath(currentPath.current) })
      .catch(() => showToast(t('appUpdate.openFailed'), 'error'));
  };
  return (
    <AppUpdateExperience
      visible={Boolean(visible && safe && update)}
      version={update?.version}
      phase={phase}
      downloadedBytes={downloadedBytes}
      totalBytes={totalBytes}
      onClose={close}
      onAction={() => { pendingAction.current = true; minimize(); }}
      onDismiss={afterDismiss}
    />
  );
}
