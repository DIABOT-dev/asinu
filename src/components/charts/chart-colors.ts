'use client';

type Mode = 'light' | 'dark';

export const chartColors = {
  text: {
    light: '#64748b',
    dark: '#cbd5f5'
  },
  grid: {
    light: 'rgba(148, 163, 184, 0.25)',
    dark: 'rgba(71, 85, 105, 0.4)'
  },
  tooltipBody: {
    light: '#0f172a',
    dark: '#e2e8f0'
  },
  tooltipBg: {
    light: '#ffffff',
    dark: '#1e293b'
  },
  tooltipBorder: {
    light: '#e2e8f0',
    dark: '#334155'
  },
  accentPalette: [
    '#10b981',
    '#0ea5e9',
    '#f59e0b',
    '#6366f1',
    '#ec4899',
    '#22d3ee'
  ]
} as const;

export const getMode = (isDark: boolean): Mode => (isDark ? 'dark' : 'light');
