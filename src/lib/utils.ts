export const formatTime = (date: Date) =>
  date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

export const formatDate = (date: Date) =>
  date.toLocaleDateString([], {
    month: 'short',
    day: 'numeric'
  });
