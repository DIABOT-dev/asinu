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
  data?: ChartData<'line'>;
  height?: number;
  className?: string;
};

const defaultLineData: ChartData<'line'> = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      label: 'Energy',
      data: [32, 45, 38, 52, 48, 54, 60],
      borderWidth: 3,
      fill: true,
      tension: 0.4,
      pointRadius: 0,
      borderColor: '#0ea5e9',
      backgroundColor: 'rgba(14,165,233,0.15)'
    }
  ]
};

const buildOptions = (isDark: boolean): ChartOptions<'line'> => {
  const mode = getMode(isDark);
  return {
    layout: { padding: 16 },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          title: () => '',
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
    interaction: {
      intersect: false,
      mode: 'nearest'
    },
    maintainAspectRatio: false,
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: chartColors.text[mode] }
      },
      y: {
        beginAtZero: true,
        border: { display: false },
        grid: { color: chartColors.grid[mode] },
        ticks: {
          color: chartColors.text[mode],
          callback: (value) => (typeof value === 'number' ? formatNumber(value) : `${value}`)
        }
      }
    }
  };
};

export function LineChart({ data = defaultLineData, height = 240, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart<'line'> | null>(null);
  const isDarkMode = useIsDarkMode();

  useEffect(() => {
    ensureChartSetup();
    if (!canvasRef.current) return;
    const chart = new ChartJS<'line'>(canvasRef.current, {
      type: 'line',
      data: cloneChartData(data),
      options: buildOptions(isDarkMode)
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
    const mode = getMode(isDarkMode);
    chart.options.scales!.x!.ticks!.color = chartColors.text[mode];
    chart.options.scales!.y!.ticks!.color = chartColors.text[mode];
    chart.options.scales!.y!.grid!.color = chartColors.grid[mode];
    if (chart.options.plugins?.tooltip) {
      chart.options.plugins.tooltip.backgroundColor = chartColors.tooltipBg[mode];
      chart.options.plugins.tooltip.borderColor = chartColors.tooltipBorder[mode];
      chart.options.plugins.tooltip.bodyColor = chartColors.tooltipBody[mode];
    }
    chart.update('none');
  }, [isDarkMode]);

  return (
    <div className={cn('relative w-full', className)} style={{ height }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
