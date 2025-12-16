export const formatPercent = (value: number, precision = 0) => `${value.toFixed(precision)}%`;

export const formatDelta = (delta: number, precision = 1) => {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${delta.toFixed(precision)}`;
};

export const formatTimestamp = (timestamp: string) => {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
};
