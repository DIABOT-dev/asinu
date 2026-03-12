// Email and password validation utilities for frontend

export const validateEmail = (email: string): string | null => {
  if (!email || !email.trim()) {
    return 'Email không được để trống';
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Email không hợp lệ';
  }
  
  return null;
};

export const validatePhone = (phone: string): string | null => {
  if (!phone || !phone.trim()) {
    return 'Số điện thoại không được để trống';
  }
  
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Check if contains only digits and + sign
  if (!/^[0-9+]+$/.test(cleaned)) {
    return 'Số điện thoại chỉ được chứa số và ký tự +';
  }
  
  // Check Vietnamese phone format (0, 84, or +84 followed by 9-10 digits)
  if (!/^(\+84|84|0)[0-9]{9,10}$/.test(cleaned)) {
    return 'Số điện thoại phải bắt đầu bằng 0, 84 hoặc +84 và có 10-11 số';
  }
  
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) {
    return 'Mật khẩu không được để trống';
  }
  
  if (password.length < 8) {
    return 'Mật khẩu phải có ít nhất 8 ký tự';
  }
  
  if (!/[A-Z]/.test(password)) {
    return 'Mật khẩu phải có ít nhất 1 chữ hoa';
  }
  
  if (!/[a-z]/.test(password)) {
    return 'Mật khẩu phải có ít nhất 1 chữ thường';
  }
  
  if (!/[0-9]/.test(password)) {
    return 'Mật khẩu phải có ít nhất 1 chữ số';
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    return 'Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%^&*...)';
  }
  
  return null;
};

export const getPasswordStrength = (password: string): {
  strength: 'weak' | 'medium' | 'strong';
  score: number;
} => {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  
  if (score <= 3) return { strength: 'weak', score };
  if (score <= 5) return { strength: 'medium', score };
  return { strength: 'strong', score };
};
