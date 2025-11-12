'use client';

import type { ChartData, ChartType } from 'chart.js';

const compactNumber = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 1,
  notation: 'compact'
});

const compactCurrency = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0
});

export const formatNumber = (value: number) => compactNumber.format(value);
export const formatCurrency = (value: number) => compactCurrency.format(value);

export function cloneChartData<T extends ChartType>(data: ChartData<T>): ChartData<T> {
  return JSON.parse(JSON.stringify(data));
}
