export const GUIDE_STEPS = [
  'home.fine', 'home.unwell', 'checkin.choices', 'checkin.other', 'home.suggestions',
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
export function nextGuideStep(progress: GuideProgress, available: readonly GuideStep[]): GuideStep | undefined {
  if (!progress.welcomeSeen) return undefined;
  return GUIDE_STEPS.find(id => available.includes(id) && !progress.completed.includes(id) &&
    (id !== 'home.suggestions' || progress.firstCheckin) &&
    (id !== 'checkin.other' || progress.completed.includes('checkin.choices')));
}
export const guideColors = {
  background: '#f9fcfb', ink: '#123b35', muted: '#315951', primary: '#125d50',
  onPrimary: '#f9fcfb', border: '#8fa9a1', dim: 'rgba(6, 24, 20, 0.7)',
};
