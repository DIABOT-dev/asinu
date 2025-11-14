'use client';

import { useEffect, useRef } from 'react';
import { Chart as ChartJS } from 'chart.js';
import type { Chart, ChartData, ChartOptions } from 'chart.js';
import { ensureChartSetup } from './chart-setup';
import { chartColors, getMode } from './chart-colors';
import { useIsDarkMode } from './use-dark-mode';
import { cloneChartData, formatNumber } from './utils';
import { cn } from '@/lib/utils';

type Props = {
  data?: ChartData<'doughnut'>;
  height?: number;
  className?: string;
  cutout?: number | string;
};

const defaultDonutData: ChartData<'doughnut'> = {
  labels: ['Water', 'Walk', 'Mood'],
  datasets: [
    {
      label: 'Today',
      data: [42, 30, 28],
      backgroundColor: ['#0ea5e9', '#10b981', '#f97316'],
      hoverOffset: 4
    }
  ]
};

const buildOptions = (isDark: boolean, cutout?: number | string): ChartOptions<'doughnut'> => {
  const mode = getMode(isDark);
  return {
    cutout: cutout ?? '68%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          color: chartColors.text[mode]
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const value = context.parsed;
            return typeof value === 'number' ? formatNumber(value) : '';
          }
        },
        backgroundColor: chartColors.tooltipBg[mode],
        borderColor: chartColors.tooltipBorder[mode],
        bodyColor: chartColors.tooltipBody[mode]
      }
    },
    maintainAspectRatio: false
  };
};

export function DonutChart({ data = defaultDonutData, height = 220, className, cutout }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<'doughnut'> | null>(null);
  const isDarkMode = useIsDarkMode();

  useEffect(() => {
    ensureChartSetup();
    if (!canvasRef.current) return;
    const chart = new ChartJS<'doughnut'>(canvasRef.current, {
      type: 'doughnut',
      data: cloneChartData(data),
      options: buildOptions(isDarkMode, cutout)
    });
    chartRef.current = chart;
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    chartRef.current.data = cloneChartData(data);
    chartRef.current.update();
  }, [data]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    chart.options = {
      ...chart.options,
      ...buildOptions(isDarkMode, cutout)
    };
    chart.update('none');
  }, [isDarkMode, cutout]);

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
