const VN_TZ = 'Asia/Ho_Chi_Minh';
const VN_LOCALE = 'vi-VN';

export const formatTime = (date: Date) =>
  date.toLocaleTimeString(VN_LOCALE, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: VN_TZ,
  });

export const formatDate = (date: Date) =>
  date.toLocaleDateString(VN_LOCALE, {
    month: 'short',
    day: 'numeric',
    timeZone: VN_TZ,
  });

export const formatDateTime = (date: Date) =>
  date.toLocaleString(VN_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: VN_TZ,
  });

/** Trả về Date hiện tại theo giờ VN (dùng cho so sánh ngày) */
export const nowVN = (): Date => {
  const now = new Date();
  // toLocaleString trả string đúng giờ VN, parse lại thành Date
  return new Date(now.toLocaleString('en-US', { timeZone: VN_TZ }));
};

/** Kiểm tra 2 timestamp có cùng ngày theo giờ VN không */
export const isSameDayVN = (a: Date | string, b: Date | string): boolean => {
  const toVNDate = (d: Date | string) => {
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleDateString(VN_LOCALE, { timeZone: VN_TZ });
  };
  return toVNDate(a) === toVNDate(b);
};
