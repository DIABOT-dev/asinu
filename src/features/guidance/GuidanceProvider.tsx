import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../auth/auth.store';
import { useGuardedRouter } from '../../hooks/useGuardedRouter';
import { useQueuedModalBusy } from '../../components/QueuedModal';
import { useGuidanceStore } from './guidance.store';
import { guidanceAudio } from './guidance.audio';
import { guideColors as c, nextGuideStep, type GuideRole, type GuideStep } from './guidance.model';

type Rect = { x: number; y: number; width: number; height: number };
type Target = { node: React.RefObject<View | null>; reveal?: () => void; name?: string };
const Context = createContext<{
  register: (id: GuideStep, target: Target) => () => void;
  acknowledge: (id: GuideStep) => void;
} | null>(null);
const ScrollContext = createContext<((node: React.RefObject<View | null>) => void) | undefined>(undefined);
const ANONYMOUS_WELCOME = 'guidance:welcome-before-login:v1';

/** Register the real, tappable native view, not a screenshot or a cloned button. */
export function GuideTarget({ step, children, enabled = true, name, style }: {
  step: GuideStep; children: React.ReactNode; enabled?: boolean; name?: string;
  style?: React.ComponentProps<typeof View>['style'];
}) {
  const context = useContext(Context);
  const reveal = useContext(ScrollContext);
  const focused = useIsFocused();
  const node = useRef<View>(null);
  useEffect(() => {
    if (!focused || !enabled || !context) return;
    return context.register(step, { node, name, reveal: reveal ? () => reveal(node) : undefined });
  }, [context, enabled, focused, name, reveal, step]);
  return <View ref={node} collapsable={false} style={style}
    onTouchEnd={() => { if (focused && enabled) context?.acknowledge(step); }}>{children}</View>;
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
  const hydrated = useAuthStore(state => state.hydrated);
  const account = profile?.id ? String(profile.id) : null;
  const { progress, ready: loaded, account: loadedAccount, load, refresh, update, acknowledge } = useGuidanceStore();
  const ready = loaded && loadedAccount === account;
  const modalBusy = useQueuedModalBusy();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [keyboard, setKeyboard] = useState(false);
  const [anonymousReady, setAnonymousReady] = useState(false);
  const [anonymousRole, setAnonymousRole] = useState<GuideRole | null>(null);
  const [anonymousSeen, setAnonymousSeen] = useState(true);
  const [targets, setTargets] = useState<Map<GuideStep, Target>>(new Map());
  const [rect, setRect] = useState<Rect | null>(null);
  const choiceBusy = useRef(false);
  const activeStep = useRef<GuideStep | undefined>(undefined);
  const backgroundCall = path.startsWith('/checkin-call/') && path !== '/checkin-call/settings';
  const suspended = modalBusy || !foreground || keyboard || backgroundCall;

  useEffect(() => { void load(account); }, [account, load]);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(ANONYMOUS_WELCOME).then(raw => {
      if (!active) return;
      const role = raw === 'self' || raw === 'caregiver' ? raw : null;
      setAnonymousSeen(raw === 'seen' || Boolean(role)); setAnonymousRole(role); setAnonymousReady(true);
    }).catch(() => { if (active) { setAnonymousSeen(false); setAnonymousReady(true); } });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!account || !ready || !anonymousRole || progress.welcomeSeen) return;
    update({ role: anonymousRole, welcomeSeen: true });
    if (anonymousRole === 'caregiver' && path === '/home') router.replace('/(tabs)/care-circle');
    setAnonymousRole(null);
    void AsyncStorage.setItem(ANONYMOUS_WELCOME, 'seen').catch(() => {});
  }, [account, anonymousRole, path, progress.welcomeSeen, ready, router, update]);
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

  const welcomeRoute = path === '/' || path.startsWith('/login') || path.startsWith('/onboarding') || path === '/home';
  const welcome = hydrated && !suspended && welcomeRoute && (account
    ? ready && !progress.welcomeSeen && !anonymousRole
    : anonymousReady && !anonymousSeen);
  const candidate = !welcome && !suspended && account && ready
    ? nextGuideStep(progress, [...targets.keys()]) : undefined;
  activeStep.current = candidate;
  const target = candidate ? targets.get(candidate) : undefined;

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
    acknowledge(id);
  }, [acknowledge]);
  const context = useMemo(() => ({ register, acknowledge: acknowledgeTarget }), [acknowledgeTarget, register]);

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
      const next = { x: Math.max(4, x - 4), y: top, width: Math.min(width - 8, w + 8),
        height: Math.min(h + 8, height - insets.bottom - top - 4) };
      setRect(previous => previous && JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    });
    const timer = setInterval(measure, 180);
    measure();
    return () => { active = false; clearInterval(timer); };
  }, [candidate, height, insets.bottom, insets.top, target, width]);

  const text = candidate ? String(t(`guidance.steps.${candidate.replace('.', '_')}`, { name: target?.name || '' })) : '';
  // A suspended coach resumes visually without repeating an already-read phrase.
  const spoken = useRef(new Set<string>());
  useEffect(() => {
    const key = welcome ? `welcome:${account || 'anonymous'}:${progress.epoch}`
      : candidate && rect ? `${account}:${progress.epoch}:${candidate}` : null;
    if (!key || !progress.readAloud || spoken.current.has(key)) return;
    spoken.current.add(key);
    void guidanceAudio.speak(welcome ? `${t('guidance.welcomeTitle')} ${t('guidance.welcomeBody')}` : text, i18n.language);
    return () => { void guidanceAudio.stop(); };
  }, [account, candidate, i18n.language, progress.epoch, progress.readAloud, rect !== null, text, t, welcome]);
  useEffect(() => { if (suspended) void guidanceAudio.stop(); }, [suspended]);

  const chooseRole = async (role: GuideRole) => {
    if (choiceBusy.current) return;
    choiceBusy.current = true;
    void guidanceAudio.stop();
    if (account) {
      update({ role, welcomeSeen: true });
      router.replace(role === 'caregiver' ? '/(tabs)/care-circle' : '/(tabs)/home');
    } else {
      setAnonymousRole(role); setAnonymousSeen(true);
      await AsyncStorage.setItem(ANONYMOUS_WELCOME, role).catch(() => {});
    }
    choiceBusy.current = false;
  };

  const below = rect ? height - insets.bottom - rect.y - rect.height >= rect.y - insets.top : true;
  const available = rect ? Math.max(120, below
    ? height - insets.bottom - rect.y - rect.height - 18
    : rect.y - insets.top - 18) : 0;
  return <Context.Provider value={context}>
    <View style={styles.root}>
      <View style={styles.root} importantForAccessibility={welcome ? 'no-hide-descendants' : 'auto'}>{children}</View>
      {welcome && <View style={styles.welcome} accessibilityViewIsModal>
        <ScrollView contentContainerStyle={[styles.welcomeContent, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 24 }]}>
          <Image source={require('../../../assets/asinu_chat_sticker.png')} style={styles.mascot} resizeMode="contain" accessible={false} />
          <Text style={styles.welcomeTitle} allowFontScaling>{t('guidance.welcomeTitle')}</Text>
          <Text style={styles.sentence} allowFontScaling>{t('guidance.welcomeBody')}</Text>
          <GuideReplay onPress={() => void guidanceAudio.speak(`${t('guidance.welcomeTitle')} ${t('guidance.welcomeBody')}`, i18n.language, true)} />
          <GuideButton icon="person-outline" label={t('guidance.roleSelf')} onPress={() => void chooseRole('self')} />
          <GuideButton icon="heart-outline" label={t('guidance.roleCaregiver')} secondary onPress={() => void chooseRole('caregiver')} />
        </ScrollView>
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
            <GuideReplay onPress={() => void guidanceAudio.speak(text, i18n.language, true)} />
            <GuideButton label={t('guidance.understood')} onPress={() => acknowledgeTarget(candidate)} />
          </ScrollView>
        </View>
      </View>}
    </View>
  </Context.Provider>;
}

function GuideReplay({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation('onboarding');
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={t('guidance.replayAudio')}
    style={({ pressed }) => [styles.replay, pressed && styles.pressed]}>
    <Ionicons name="volume-high-outline" size={28} color={c.primary} />
    <Text allowFontScaling style={styles.replayText}>{t('guidance.replayAudio')}</Text>
  </Pressable>;
}
function GuideButton({ label, onPress, secondary = false, icon }: {
  label: string; onPress: () => void; secondary?: boolean; icon?: React.ComponentProps<typeof Ionicons>['name'];
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, pressed && styles.pressed]}>
    {icon && <Ionicons name={icon} size={28} color={secondary ? c.ink : c.onPrimary} />}
    <Text allowFontScaling style={[styles.buttonText, secondary && { color: c.ink }]}>{label}</Text>
  </Pressable>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  welcome: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: c.background },
  welcomeContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, gap: 18 },
  mascot: { width: 156, height: 156, alignSelf: 'center' },
  welcomeTitle: { fontSize: 30, fontWeight: '800', color: c.ink, textAlign: 'center' },
  sentence: { fontSize: 22, color: c.ink, lineHeight: 32 },
  button: { minHeight: 60, width: '100%', paddingVertical: 16, paddingHorizontal: 18,
    backgroundColor: c.primary, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 12 },
  secondary: { backgroundColor: '#e2f0e9', borderWidth: 1, borderColor: c.border },
  buttonText: { fontSize: 22, fontWeight: '800', color: c.onPrimary, flex: 1, textAlign: 'center' },
  replay: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  replayText: { fontSize: 22, fontWeight: '800', color: c.primary, flexShrink: 1 },
  pressed: { opacity: 0.8 },
  dim: { position: 'absolute', backgroundColor: c.dim },
  outline: { position: 'absolute', borderRadius: 18, borderWidth: 3, borderColor: '#c8f3d9' },
  bubble: { position: 'absolute', backgroundColor: c.background, borderRadius: 20,
    borderWidth: 1, borderColor: c.border },
  bubbleContent: { padding: 20, gap: 8 },
  arrow: { position: 'absolute', width: 16, height: 16, transform: [{ rotate: '45deg' }], backgroundColor: c.background },
});
