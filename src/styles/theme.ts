export const colors = {
  // Nền chung: ngả kem, bớt tím, nhìn giống app sức khỏe hơn
  background: '#f4f1e9',
  surface: '#ffffff',
  surfaceMuted: '#f6f2ec',

  // Text: đen ghi dịu, tương phản rõ
  textPrimary: '#111827',
  textSecondary: '#4b5563',

  border: '#e5e7eb',

  // Asinu teal – xanh giống con mascot, không tím nữa
  primary: '#08b8a2',     // dùng cho button chính, CTA
  secondary: '#0ea18f',   // các chip / nhãn phụ, icon gradient

  // Điểm nhấn & trạng thái
  accent: '#0bb8a8',
  success: '#16a34a',

  // Vàng trầm hơn để tránh chói
  warning: '#f4b41a',     // vòng tròn % và các nhắc nhở
  // Vàng riêng cho nút “Đã hoàn thành” (nhiệm vụ)
  complete: '#fbbf24',

  danger: '#dc2626'
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24
};

export const typography = {
  family: {
    heading: 'System',
    body: 'System'
  },
  // ~1.2–1.25x so với cũ: chữ nhỏ, mô tả, label đều to hơn rõ rệt
  size: {
    xs: 13,  // label phụ, caption
    sm: 15,  // mô tả ngắn, subtext
    md: 18,  // body chính
    lg: 22,  // heading màn
    xl: 30   // số lớn, tiêu đề hero
  }
};
