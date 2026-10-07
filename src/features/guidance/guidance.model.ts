import { lightColors } from '../../styles/theme';

export const GUIDE_STEPS = [
  'home.fine', 'home.unwell', 'checkin.practice', 'checkin.status', 'checkin.location', 'checkin.location_other',
  'checkin.voice', 'checkin.location_confirm', 'checkin.choices', 'checkin.multiple', 'checkin.single',
  'checkin.other', 'checkin.confirm', 'checkin.result_status', 'checkin.result_symptoms',
  'checkin.result_advice', 'checkin.result_replay', 'checkin.result_doctor', 'checkin.result_emergency',
  'checkin.result_family', 'checkin.result_variants', 'checkin.result_close', 'checkin.finished', 'home.suggestions',
  'circle.add', 'circle.phone', 'circle.relationship', 'circle.send', 'circle.member',
] as const;
export type GuideStep = typeof GUIDE_STEPS[number];
export type GuideRole = 'self' | 'caregiver';
export type GuideProgress = {
  role: GuideRole | null;
  welcomeSeen: boolean;
  readAloud: boolean;
  firstCheckin: boolean;
  completed: GuideStep[];
  epoch: number;
};
export type GuidePatch = Partial<Omit<GuideProgress, 'epoch' | 'role'>> & { role?: GuideRole };
export const defaultProgress = (): GuideProgress => ({
  role: null, welcomeSeen: false, readAloud: true, firstCheckin: false, completed: [], epoch: 0,
});
export function mergeProgress(progress: GuideProgress, patch: GuidePatch): GuideProgress {
  return { ...progress, ...patch,
    welcomeSeen: progress.welcomeSeen || patch.welcomeSeen === true,
    firstCheckin: progress.firstCheckin || patch.firstCheckin === true,
    completed: GUIDE_STEPS.filter(id => progress.completed.includes(id) || patch.completed?.includes(id)),
  };
}
export function nextGuideStep(progress: GuideProgress, available: readonly GuideStep[],
  context: { checkinHasNoChoices?: boolean } = {}): GuideStep | undefined {
  if (!progress.welcomeSeen) return undefined;
  return GUIDE_STEPS.find(id => available.includes(id) && !progress.completed.includes(id) &&
    (id !== 'home.suggestions' || progress.firstCheckin) &&
    (id !== 'checkin.location_other' || progress.completed.includes('checkin.location')) &&
    (id !== 'checkin.voice' || progress.completed.includes(available.includes('checkin.location_other')
      ? 'checkin.location_other' : 'checkin.other')) &&
    (id !== 'checkin.other' || progress.completed.includes('checkin.choices') || context.checkinHasNoChoices === true));
}
export const guideColors = {
  background: '#f9fcfb', ink: '#123b35', muted: '#315951', primary: '#125d50',
  actionBackground: lightColors.primary, onAction: '#061c19',
  onPrimary: '#f9fcfb', border: '#8fa9a1', dim: 'rgba(6, 24, 20, 0.7)',
};
