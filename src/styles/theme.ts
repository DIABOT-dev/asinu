export const colors = {
  // ── Backgrounds ────────────────────────────────────
  background: '#f4f1e9',
  surface: '#ffffff',
  surfaceMuted: '#f6f2ec',

  // ── Text ───────────────────────────────────────────
  textPrimary: '#111827',
  textSecondary: '#4b5563',

  // ── Border ─────────────────────────────────────────
  border: '#e5e7eb',

  // ── Primary (Teal) ─────────────────────────────────
  primary: '#08b8a2',
  primaryDark: '#0ea18f',
  primaryLight: '#e6faf8',

  // ── Premium / Gold ─────────────────────────────────
  premium: '#f59e0b',
  premiumDark: '#d97706',
  premiumLight: '#fef3c7',

  // ── Emerald (Care Circle, Success states) ──────────
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',

  // ── Status ─────────────────────────────────────────
  success: '#16a34a',
  warning: '#f4b41a',
  danger: '#dc2626',

  // ── Overlay ────────────────────────────────────────
  overlay: 'rgba(0,0,0,0.45)',
};

// ── Brand accent colors (for UI gradients, non-health) ─
export const brandColors = {
  indigo: '#6366f1',
  indigoDark: '#4f46e5',
  violet: '#8b5cf6',
  violetDark: '#7c3aed',
  pink: '#ec4899',
  pinkDark: '#db2777',
  cyan: '#06b6d4',
  orange: '#f97316',
};

// ── Health metric category colors ──────────────────────
export const categoryColors = {
  glucose: '#3b82f6',
  glucoseBg: '#eff6ff',
  bloodPressure: '#ef4444',
  bloodPressureBg: '#fef2f2',
  weight: '#8b5cf6',
  weightBg: '#f5f3ff',
  water: '#06b6d4',
  waterBg: '#ecfeff',
  insulin: '#6366f1',
  insulinBg: '#eef2ff',
  meal: '#f59e0b',
  mealBg: '#fffbeb',
  medication: '#10b981',
  medicationBg: '#ecfdf5',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

export const typography = {
  family: {
    heading: 'System',
    body: 'System'
  },
  size: {
    xxs: 11,
    xs: 13,
    sm: 15,
    md: 18,
    lg: 22,
    xl: 30,
  }
};

// ── Shadow presets ────────────────────────────────────
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

// ── Opacity helpers ───────────────────────────────────
// Dùng: colors.primary + opacity.p10 → '#08b8a21a'
export const opacity = {
  p05: '0d',
  p10: '1a',
  p15: '26',
  p20: '33',
  p30: '4d',
  p50: '80',
};
