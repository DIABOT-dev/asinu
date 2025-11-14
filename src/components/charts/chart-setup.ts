'use client';

import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
} from 'chart.js';

let initialized = false;

export function ensureChartSetup() {
  if (initialized) return;

  Chart.register(
    ArcElement,
    BarController,
    BarElement,
    CategoryScale,
    Filler,
    Legend,
    LineController,
    LineElement,
    LinearScale,
    PointElement,
    TimeScale,
    Tooltip,
  );

  Chart.defaults.font.family = 'var(--font-sans, "Inter", "SF Pro Display", system-ui, -apple-system)';
  Chart.defaults.font.weight = 500;
  Chart.defaults.plugins.tooltip.borderWidth = 1;
  Chart.defaults.plugins.tooltip.displayColors = false;
  Chart.defaults.plugins.tooltip.mode = 'nearest';
  Chart.defaults.plugins.tooltip.intersect = false;
  Chart.defaults.plugins.tooltip.position = 'nearest';
  Chart.defaults.plugins.tooltip.caretSize = 0;
  Chart.defaults.plugins.tooltip.caretPadding = 12;
  Chart.defaults.plugins.tooltip.cornerRadius = 10;
  Chart.defaults.plugins.tooltip.padding = 10;

  initialized = true;
}
