// ── Light mode colors ─────────────────────────────────
export const lightColors = {
  background: '#f4f1e9',
  surface: '#ffffff',
  surfaceMuted: '#f6f2ec',
  textPrimary: '#111827',
  textSecondary: '#4b5563',
  border: '#e5e7eb',
  primary: '#08b8a2',
  primaryDark: '#0ea18f',
  primaryLight: '#e6faf8',
  premium: '#f59e0b',
  premiumDark: '#d97706',
  premiumLight: '#fef3c7',
  emerald: '#10b981',
  emeraldDark: '#059669',
  emeraldLight: '#d1fae5',
  success: '#16a34a',
  warning: '#f4b41a',
  danger: '#dc2626',
  overlay: 'rgba(0,0,0,0.45)',
};

// ── Dark mode colors ──────────────────────────────────
export const darkColors: typeof lightColors = {
  background: '#0f1117',
  surface: '#1a1d27',
  surfaceMuted: '#22252f',
  textPrimary: '#f0f0f5',
  textSecondary: '#9ca3af',
  border: '#2d3140',
  primary: '#0dd4bc',
  primaryDark: '#0ea18f',
  primaryLight: '#0f2b28',
  premium: '#fbbf24',
  premiumDark: '#f59e0b',
  premiumLight: '#3b2e10',
  emerald: '#34d399',
  emeraldDark: '#10b981',
  emeraldLight: '#0f2f23',
  success: '#22c55e',
  warning: '#fbbf24',
  danger: '#f87171',
  overlay: 'rgba(0,0,0,0.65)',
};

// ── Mutable colors: mutated in-place when theme changes ──
// This allows static StyleSheet.create to pick up new values on re-render
export const colors = { ...lightColors };

// ── Brand accent colors ───────────────────────────────
export const lightBrandColors = {
  indigo: '#6366f1',
  indigoDark: '#4f46e5',
  violet: '#8b5cf6',
  violetDark: '#7c3aed',
  pink: '#ec4899',
  pinkDark: '#db2777',
  cyan: '#06b6d4',
  orange: '#f97316',
};

export const darkBrandColors: typeof lightBrandColors = {
  indigo: '#818cf8',
  indigoDark: '#6366f1',
  violet: '#a78bfa',
  violetDark: '#8b5cf6',
  pink: '#f472b6',
  pinkDark: '#ec4899',
  cyan: '#22d3ee',
  orange: '#fb923c',
};

export const brandColors = { ...lightBrandColors };

// ── Health metric category colors ─────────────────────
export const lightCategoryColors = {
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

export const darkCategoryColors: typeof lightCategoryColors = {
  glucose: '#60a5fa',
  glucoseBg: '#1e2a3f',
  bloodPressure: '#f87171',
  bloodPressureBg: '#2f1c1c',
  weight: '#a78bfa',
  weightBg: '#251e3d',
  water: '#22d3ee',
  waterBg: '#132c30',
  insulin: '#818cf8',
  insulinBg: '#1e1e3d',
  meal: '#fbbf24',
  mealBg: '#2d2510',
  medication: '#34d399',
  medicationBg: '#122b22',
};

export const categoryColors = { ...lightCategoryColors };

// ── Apply theme: mutates color objects in-place ───────
export function applyTheme(mode: 'light' | 'dark') {
  const c = mode === 'dark' ? darkColors : lightColors;
  const b = mode === 'dark' ? darkBrandColors : lightBrandColors;
  const cat = mode === 'dark' ? darkCategoryColors : lightCategoryColors;
  Object.assign(colors, c);
  Object.assign(brandColors, b);
  Object.assign(categoryColors, cat);
}

// ── Spacing ───────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 36,
};

// ── Radius ────────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
};

// ── Typography ────────────────────────────────────────
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
export const opacity = {
  p05: '0d',
  p10: '1a',
  p15: '26',
  p20: '33',
  p30: '4d',
  p50: '80',
};
