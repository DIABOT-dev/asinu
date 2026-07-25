// ── Light mode colors ─────────────────────────────────
export const lightColors = {
  background: '#fbfbfb',     // Clean off-white (match design system reference)
  surface: '#ffffff',         // Cards / panels — pure white để contrast với bg
  surfaceMuted: '#f3f4f6',    // Subtle muted (vd: pressed state)
  textPrimary: '#221f1f',     // Near-black per design
  textSecondary: '#656565',   // Medium gray
  border: '#ececec',          // Soft border

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
  indigo: '#60758c',
  indigoDark: '#4c6278',
  violet: '#796e98',
  violetDark: '#665b82',
  pink: '#aa7180',
  pinkDark: '#925e6d',
  cyan: '#468f94',
  orange: '#ad794d',
};

export const darkBrandColors: typeof lightBrandColors = {
  indigo: '#9aafc2',
  indigoDark: '#7f96ac',
  violet: '#b2a8c4',
  violetDark: '#998eae',
  pink: '#d2a0ac',
  pinkDark: '#b98593',
  cyan: '#8bc3c4',
  orange: '#d0a27d',
};

export const brandColors = { ...lightBrandColors };

// ── Health metric category colors ─────────────────────
export const lightCategoryColors = {
  glucose: '#4f7fa6',
  glucoseBg: '#eef4f8',
  bloodPressure: '#b85c60',
  bloodPressureBg: '#fbf0f1',
  weight: '#796e98',
  weightBg: '#f3f1f8',
  water: '#4c9597',
  waterBg: '#edf7f7',
  insulin: '#687b9f',
  insulinBg: '#f0f3f8',
  meal: '#b68445',
  mealBg: '#faf5ea',
  medication: '#4d8d70',
  medicationBg: '#eef7f2',
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

// ── Soft icon colors (lighter, less saturated — for icon tints) ───
export const lightIconColors = {
  primary:    '#238f82',
  danger:     '#c85b5f',
  warning:    '#b47a17',
  emerald:    '#468f70',
  premium:    '#b47a17',
  indigo:     '#60758c',
  violet:     '#796e98',
  pink:       '#aa7180',
  cyan:       '#468f94',
  orange:     '#ad794d',
  // Health metric icon tints
  glucose:    '#4f7fa6',
  bp:         '#b85c60',
  weight:     '#796e98',
  water:      '#4c9597',
  insulin:    '#687b9f',
  meal:       '#b68445',
  medication: '#4d8d70',
};

export const darkIconColors: typeof lightIconColors = {
  primary:    '#5eead4',  // teal-300
  danger:     '#fca5a5',  // red-300
  warning:    '#fde68a',  // amber-200
  emerald:    '#6ee7b7',  // emerald-300
  premium:    '#fde68a',  // amber-200
  indigo:     '#a5b4fc',  // indigo-300
  violet:     '#c4b5fd',  // violet-300
  pink:       '#f9a8d4',  // pink-300
  cyan:       '#67e8f9',  // cyan-300
  orange:     '#fdba74',  // orange-300
  glucose:    '#93c5fd',  // blue-300
  bp:         '#fca5a5',  // red-300
  weight:     '#c4b5fd',  // violet-300
  water:      '#67e8f9',  // cyan-300
  insulin:    '#a5b4fc',  // indigo-300
  meal:       '#fde68a',  // amber-200
  medication: '#6ee7b7',  // emerald-300
};

export const iconColors = { ...lightIconColors };

// ── Apply theme: mutates color objects in-place ───────
export function applyTheme(mode: 'light' | 'dark') {
  const c = mode === 'dark' ? darkColors : lightColors;
  const b = mode === 'dark' ? darkBrandColors : lightBrandColors;
  const cat = mode === 'dark' ? darkCategoryColors : lightCategoryColors;
  const ic = mode === 'dark' ? darkIconColors : lightIconColors;
  Object.assign(colors, c);
  Object.assign(brandColors, b);
  Object.assign(categoryColors, cat);
  Object.assign(iconColors, ic);
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
    heading: 'Inter_700Bold',
    body: 'Inter_400Regular'
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
