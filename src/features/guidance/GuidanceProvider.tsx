import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../auth/auth.store';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useQueuedModalBusy } from '../../components/QueuedModal';
import { ScreenBackButton } from '../../components/ScreenHeaderButton';
import { useGuidanceStore } from './guidance.store';
import { guidanceAudio } from './guidance.audio';
import { guideColors as c, nextGuideStep, type GuideRole, type GuideStep } from './guidance.model';

type Rect = { x: number; y: number; width: number; height: number };
type Target = { node: React.RefObject<View | null>; reveal?: () => void; name?: string; withoutChoices?: boolean };
type TargetMeasurement = Rect & { step: GuideStep; target: Target; account: string | null; epoch: number; path: string };
const Context = createContext<{
  register: (id: GuideStep, target: Target) => () => void;
  acknowledge: (id: GuideStep) => void;
  beginPractice: (key: string) => void;
  endPractice: (key: string) => void;
} | null>(null);
export function useGuideAcknowledgement() {
  const context = useContext(Context);
  return useCallback((step: GuideStep) => context?.acknowledge(step), [context]);
}
const ScrollContext = createContext<((node: React.RefObject<View | null>) => void) | undefined>(undefined);

/** Practice acknowledgements live only in memory, never in account progress. */
export function GuidePracticeScope({ runKey, enabled = true, children }: { runKey: string; enabled?: boolean; children: React.ReactNode }) {
  const context = useContext(Context);
  useEffect(() => {
    if (!enabled) return;
    context?.beginPractice(runKey);
    return () => context?.endPractice(runKey);
  }, [context, enabled, runKey]);
  return <>{children}</>;
}

/** Register the real, tappable native view, not a screenshot or a cloned button. */
export function GuideTarget({ step, children, enabled = true, name, style, withoutChoices = false, acknowledgeOnTouch = true }: {
  step: GuideStep; children: React.ReactNode; enabled?: boolean; name?: string; withoutChoices?: boolean;
  acknowledgeOnTouch?: boolean;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const context = useContext(Context);
  const reveal = useContext(ScrollContext);
  const focused = useIsFocused();
  const node = useRef<View>(null);
  useEffect(() => {
    if (!focused || !enabled || !context) return;
    return context.register(step, { node, name, withoutChoices, reveal: reveal ? () => reveal(node) : undefined });
  }, [context, enabled, focused, name, reveal, step, withoutChoices]);
  return <View ref={node} collapsable={false} style={style}
    onTouchEnd={() => { if (focused && enabled && acknowledgeOnTouch) context?.acknowledge(step); }}>{children}</View>;
}

/** Share the owning scroll container so off-screen targets can be revealed. */
export function GuideScrollScope({ scrollRef, offset, children }: {
  scrollRef: React.RefObject<ScrollView | null>; offset: React.RefObject<number>; children: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reveal = useCallback((node: React.RefObject<View | null>) => {
    node.current?.measureInWindow((_x, y) => {
      scrollRef.current?.scrollTo({ y: Math.max(0, offset.current + y - insets.top - 110), animated: false });
    });
  }, [insets.top, offset, scrollRef]);
  return <ScrollContext.Provider value={reveal}>{children}</ScrollContext.Provider>;
}

export function GuidanceProvider({ children }: { children: React.ReactNode }) {
  const { t, i18n } = useTranslation('onboarding');
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const path = usePathname();
  const router = useGuardedRouter();
  const profile = useAuthStore(state => state.profile);
  const token = useAuthStore(state => state.token);
  const hydrated = useAuthStore(state => state.hydrated);
  const account = profile?.id ? String(profile.id) : null;
  const { progress: accountProgress, ready: loaded, account: loadedAccount, load, refresh, update, acknowledge } = useGuidanceStore();
  const ready = loaded && loadedAccount === account;
  const modalBusy = useQueuedModalBusy();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [keyboard, setKeyboard] = useState(false);
  const [dismissedWelcome, setDismissedWelcome] = useState<string | null>(null);
  const [targets, setTargets] = useState<Map<GuideStep, Target>>(new Map());
  const [measurement, setRect] = useState<TargetMeasurement | null>(null);
  const [practice, setPractice] = useState<{ key: string; account: string | null; completed: GuideStep[] } | null>(null);
  const practicing = Boolean(practice && practice.account === account && path === '/checkin');
  const progress = practicing && practice ? { ...accountProgress, welcomeSeen: true, completed: practice.completed }
    : accountProgress;
  const practiceRef = useRef(practicing); practiceRef.current = practicing;
  const beginPractice = useCallback((key: string) => {
    setPractice(previous => previous?.key === key && previous.account === account
      ? previous : { key, account, completed: [] });
  }, [account]);
  const endPractice = useCallback((key: string) => {
    setPractice(previous => previous?.key === key ? null : previous);
  }, []);
  const choiceBusy = useRef(false);
  const activeStep = useRef<GuideStep | undefined>(undefined);
  const backgroundCall = path.startsWith('/checkin-call/') && path !== '/checkin-call/settings';
  const suspended = modalBusy || !foreground || keyboard || backgroundCall;
  const welcomeKey = account ? `${account}:${progress.epoch}` : null;
  const dismissedForVisit = welcomeKey !== null && dismissedWelcome === welcomeKey;

  useEffect(() => { void load(account); }, [account, load]);
  useEffect(() => { setDismissedWelcome(null); }, [account, token]);
  useEffect(() => {
    const state = AppState.addEventListener('change', value => {
      setForeground(value === 'active');
      if (value !== 'active') void guidanceAudio.stop();
      else void refresh();
    });
    const show = Keyboard.addListener('keyboardDidShow', () => { setKeyboard(true); void guidanceAudio.stop(); });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false));
    return () => { state.remove(); show.remove(); hide.remove(); void guidanceAudio.stop(); };
  }, [refresh]);

  // Guidance follows sign-in AND the health-profile onboarding, never either
  // form. Requiring this account's progress also prevents stale account tours.
  const eligible = hydrated && Boolean(token) && Boolean(account) && profile?.onboardingCompleted === true && (ready || practicing) && !suspended && (!dismissedForVisit || practicing);
  const welcomeRoute = path === '/home' || path === '/care-circle';
  const guideRoute = welcomeRoute || path === '/checkin' || path === '/care-circle/invite';
  const welcome = eligible && welcomeRoute && !progress.welcomeSeen;
  // Welcome is an overlay, not a navigation route. Back uncovers the existing
  // app screen without popping login/onboarding or recording a role/completion.
  const leaveWelcome = useCallback(() => {
    if (!welcome || !welcomeKey || choiceBusy.current) return;
    void guidanceAudio.stop();
    setDismissedWelcome(welcomeKey);
  }, [welcome, welcomeKey]);
  useEffect(() => {
    if (!welcome) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      leaveWelcome(); return true;
    });
    return () => subscription.remove();
  }, [leaveWelcome, welcome]);
  const candidate = eligible && guideRoute && !welcome
    ? nextGuideStep(progress, [...targets.keys()], {
      checkinHasNoChoices: targets.get('checkin.other')?.withoutChoices === true,
    }) : undefined;
  activeStep.current = candidate;
  const target = candidate ? targets.get(candidate) : undefined;
  // A newly selected step must never reuse the previous step's highlight.
  // Off-screen targets are measured only after their owning scroll reveals them.
  const rect = measurement && measurement.step === candidate && measurement.target === target
    && measurement.account === account && measurement.epoch === progress.epoch && measurement.path === path
    ? measurement : null;

  const register = useCallback((id: GuideStep, value: Target) => {
    setTargets(previous => new Map(previous).set(id, value));
    return () => setTargets(previous => {
      if (previous.get(id) !== value) return previous;
      const next = new Map(previous); next.delete(id); return next;
    });
  }, []);
  const acknowledgeTarget = useCallback((id: GuideStep) => {
    if (activeStep.current !== id) return;
    void guidanceAudio.stop();
    if (practiceRef.current) {
      setPractice(previous => previous && !previous.completed.includes(id)
        ? { ...previous, completed: [...previous.completed, id] } : previous);
    } else acknowledge(id);
  }, [acknowledge]);
  const context = useMemo(() => ({ register, acknowledge: acknowledgeTarget, beginPractice, endPractice }),
    [acknowledgeTarget, beginPractice, endPractice, register]);

  useEffect(() => {
    setRect(null);
    if (!target || !candidate) return;
    let active = true;
    let revealed = false;
    const measure = () => target.node.current?.measureInWindow((x, y, w, h) => {
      if (!active || w <= 0 || h <= 0) return;
      if ((y < insets.top + 12 || y + Math.min(h, 90) > height - insets.bottom - 100) && !revealed) {
        revealed = true; target.reveal?.(); return;
      }
      if (y + h < insets.top || y > height - insets.bottom) return;
      const top = Math.max(insets.top + 4, y - 4);
      const next: TargetMeasurement = { x: Math.max(4, x - 4), y: top, width: Math.min(width - 8, w + 8),
        height: Math.min(h + 8, height - insets.bottom - top - 4), step: candidate, target,
        account, epoch: progress.epoch, path };
      setRect(previous => previous?.step === next.step && previous.target === next.target
        && previous.account === next.account && previous.epoch === next.epoch && previous.path === next.path
        && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height
        ? previous : next);
    });
    const timer = setInterval(measure, 180);
    measure();
    return () => { active = false; clearInterval(timer); };
  }, [account, candidate, height, insets.bottom, insets.top, path, progress.epoch, target, width]);

  const text = candidate ? String(t(`guidance.steps.${candidate.replace('.', '_')}`, { name: target?.name || '' })) : '';
  // A suspended coach resumes visually without repeating an already-read phrase.
  const spoken = useRef(new Set<string>());
  const audioScope = welcome ? `welcome:${account}:${progress.epoch}`
    : candidate ? `${account}:${progress.epoch}:${practicing ? practice?.key : 'account'}:${candidate}` : null;
  const presentationKey = welcome || rect ? audioScope : null;
  // Stop when the actual step/session changes, not when its layout is remeasured.
  useEffect(() => {
    if (!audioScope) void guidanceAudio.stop();
    return () => { void guidanceAudio.stop(); };
  }, [audioScope, i18n.language, progress.readAloud]);
  useEffect(() => {
    if (!presentationKey || !progress.readAloud || spoken.current.has(presentationKey)) return;
    spoken.current.add(presentationKey);
    const clip = welcome ? 'welcome' : candidate;
    if (clip) void guidanceAudio.speak(clip, i18n.language);
  }, [candidate, i18n.language, presentationKey, progress.readAloud, welcome]);
  useEffect(() => { if (suspended) void guidanceAudio.stop(); }, [suspended]);

  const chooseRole = async (role: GuideRole) => {
    if (!welcome || choiceBusy.current) return;
    choiceBusy.current = true;
    void guidanceAudio.stop();
    try {
      update({ role, welcomeSeen: true });
      router.replace(role === 'caregiver' ? '/(tabs)/care-circle' : '/(tabs)/home');
    } finally { choiceBusy.current = false; }
  };

  const below = rect ? height - insets.bottom - rect.y - rect.height >= rect.y - insets.top : true;
  const available = rect ? Math.max(120, below
    ? height - insets.bottom - rect.y - rect.height - 18
    : rect.y - insets.top - 18) : 0;
  return <Context.Provider value={context}>
    <View style={styles.root}>
      <View style={styles.root} importantForAccessibility={welcome ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {welcome && <View style={styles.welcome} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={[styles.welcomeContent, { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 24 }]}>
          <Image source={require('../../../assets/asinu_chat_sticker.png')} style={styles.mascot} resizeMode="contain" accessible={false} />
          <View style={styles.welcomeHeading}>
            <Text style={[styles.welcomeTitle, styles.welcomeHeadingText]} allowFontScaling>{t('guidance.welcomeTitle')}</Text>
            <GuideReplay onPress={() => void guidanceAudio.speak('welcome', i18n.language, true)} />
          </View>
          <Text style={styles.sentence} allowFontScaling>{t('guidance.welcomeBody')}</Text>
          <GuideButton icon="person-outline" label={t('guidance.roleSelf')} onPress={() => void chooseRole('self')} />
          <GuideButton icon="heart-outline" label={t('guidance.roleCaregiver')} onPress={() => void chooseRole('caregiver')} />
        </ScrollView>
        <View style={[styles.welcomeBack, { top: insets.top + 8 }]}>
          <ScreenBackButton onPress={leaveWelcome} style={styles.welcomeBackButton} />
        </View>
      </View>}
      {candidate && rect && !suspended && <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Four independent scrims leave an actual touch-through target hole. */}
        <View style={[styles.dim, { top: 0, left: 0, right: 0, height: rect.y }]} />
        <View style={[styles.dim, { top: rect.y + rect.height, left: 0, right: 0, bottom: 0 }]} />
        <View style={[styles.dim, { top: rect.y, left: 0, width: rect.x, height: rect.height }]} />
        <View style={[styles.dim, { top: rect.y, left: rect.x + rect.width, right: 0, height: rect.height }]} />
        <View pointerEvents="none" style={[styles.outline, { top: rect.y, left: rect.x, width: rect.width, height: rect.height }]} />
        <View style={[styles.bubble, { left: 12, right: 12, maxHeight: available,
          ...(below ? { top: rect.y + rect.height + 12 } : { bottom: height - rect.y + 12 }) }]} accessibilityViewIsModal
          >
          <View pointerEvents="none" style={[styles.arrow, { left: Math.min(width - 56, Math.max(20, rect.x + rect.width / 2 - 24)),
            ...(below ? { top: -8 } : { bottom: -8 }) }]} />
          <ScrollView contentContainerStyle={styles.bubbleContent} bounces={false}>
            <Text allowFontScaling style={styles.sentence}>{text}</Text>
            <View style={styles.coachActions}>
              <GuideReplay style={styles.coachReplayButton} onPress={() => void guidanceAudio.speak(candidate, i18n.language, true)} />
              <GuideButton label={t('guidance.understood')} style={styles.understoodButton} onPress={() => acknowledgeTarget(candidate)} />
            </View>
          </ScrollView>
        </View>
      </View>}
    </View>
  </Context.Provider>;
}

function GuideReplay({ onPress, style }: { onPress: () => void; style?: React.ComponentProps<typeof View>['style'] }) {
  const { t } = useTranslation('onboarding');
  return <Pressable accessibilityRole="button" accessibilityLabel={t('guidance.replayAudio')} onPress={onPress}
    style={({ pressed }) => [styles.replayButton, style, pressed && styles.pressed]}>
    <Ionicons name="volume-high-outline" size={30} color={c.onAction} accessible={false} />
  </Pressable>;
}
function GuideButton({ label, onPress, icon, style }: {
  label: string; onPress: () => void; icon?: React.ComponentProps<typeof Ionicons>['name'];
  style?: React.ComponentProps<typeof View>['style'];
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.button, style, pressed && styles.pressed]}>
    {icon && <Ionicons name={icon} size={28} color={c.onAction} />}
    <Text allowFontScaling style={styles.buttonText}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  welcome: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background },
  welcomeContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  welcomeBack: { position: 'absolute', left: 24 },
  welcomeBackButton: { width: 56, height: 56, backgroundColor: c.background, borderColor: c.border },
  mascot: { width: 156, height: 156, alignSelf: 'center' },
  welcomeTitle: { fontSize: 30, fontWeight: '800', color: c.ink, textAlign: 'center' },
  welcomeHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  welcomeHeadingText: { flex: 1, minWidth: 0 },
  sentence: { fontSize: 22, color: c.ink, lineHeight: 32 },
  button: { minHeight: 60, width: '100%', paddingVertical: 16, paddingHorizontal: 18,
    backgroundColor: c.actionBackground, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  buttonText: { fontSize: 22, fontWeight: '800', color: c.onAction, flex: 1, textAlign: 'center' },
  coachActions: { flexDirection: 'row', alignItems: 'stretch', gap: 12, marginTop: 8 },
  understoodButton: { flex: 1, minWidth: 0, width: undefined },
  replayButton: { width: 60, height: 60, minHeight: 60, flexShrink: 0, borderRadius: 18,
    backgroundColor: c.actionBackground, alignItems: 'center', justifyContent: 'center' },
  coachReplayButton: { height: undefined, alignSelf: 'stretch' },
  pressed: { opacity: 0.8 },
  dim: { position: 'absolute', backgroundColor: c.dim },
  outline: { position: 'absolute', borderRadius: 18, borderWidth: 3, borderColor: '#c8f3d9' },
  bubble: { position: 'absolute', backgroundColor: c.background, borderRadius: 20,
    borderWidth: 1, borderColor: c.border },
  bubbleContent: { padding: 20, gap: 8 },
  arrow: { position: 'absolute', width: 16, height: 16, transform: [{ rotate: '45deg' }], backgroundColor: c.background },
});
