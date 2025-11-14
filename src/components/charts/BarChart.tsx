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
  data?: ChartData<'bar'>;
  stacked?: boolean;
  height?: number;
  className?: string;
};

const defaultBarData: ChartData<'bar'> = {
  labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
  datasets: [
    {
      label: 'Completed',
      data: [32, 45, 51, 48],
      backgroundColor: '#10b981',
      borderRadius: 8,
      barThickness: 16
    },
    {
      label: 'Missed',
      data: [4, 6, 5, 7],
      backgroundColor: '#f97316',
      borderRadius: 8,
      barThickness: 16
    }
  ]
};

const buildOptions = (isDark: boolean, stacked: boolean): ChartOptions<'bar'> => {
  const mode = getMode(isDark);
  return {
    layout: {
      padding: 12
    },
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
            const value = context.parsed.y;
            return typeof value === 'number' ? formatNumber(value) : '';
          }
        },
        backgroundColor: chartColors.tooltipBg[mode],
        borderColor: chartColors.tooltipBorder[mode],
        bodyColor: chartColors.tooltipBody[mode]
      }
    },
    scales: {
      x: {
        stacked,
        grid: { display: false },
        border: { display: false },
        ticks: { color: chartColors.text[mode] }
      },
      y: {
        stacked,
        border: { display: false },
        beginAtZero: true,
        grid: { color: chartColors.grid[mode] },
        ticks: {
          color: chartColors.text[mode],
          callback: (value) => (typeof value === 'number' ? formatNumber(value) : `${value}`)
        }
      }
    },
    maintainAspectRatio: false
  };
};

export function BarChart({ data = defaultBarData, height = 260, stacked = false, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<'bar'> | null>(null);
  const isDarkMode = useIsDarkMode();

  useEffect(() => {
    ensureChartSetup();
    if (!canvasRef.current) return;
    const chart = new ChartJS<'bar'>(canvasRef.current, {
      type: 'bar',
      data: cloneChartData(data),
      options: buildOptions(isDarkMode, stacked)
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
      ...buildOptions(isDarkMode, stacked)
    };
    chart.update('none');
  }, [isDarkMode, stacked]);

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
