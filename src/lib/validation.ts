// Email and password validation utilities for frontend
import i18n from '../i18n';

const t = (key: string) => i18n.t(key, { ns: 'auth' });

export const validateEmail = (email: string): string | null => {
  if (!email || !email.trim()) {
    return t('emailEmpty');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return t('emailInvalid');
  }
  
  return null;
};

export const validatePhone = (phone: string): string | null => {
  if (!phone || !phone.trim()) {
    return t('phoneEmpty');
  }
  
  // Remove spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Check if contains only digits and + sign
  if (!/^[0-9+]+$/.test(cleaned)) {
    return t('phoneInvalidChars');
  }
  
  // Check Vietnamese phone format (0, 84, or +84 followed by 9-10 digits)
  if (!/^(\+84|84|0)[0-9]{9,10}$/.test(cleaned)) {
    return t('phoneInvalidFormat');
  }
  
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) {
    return t('passwordEmpty');
  }
  
  if (password.length < 8) {
    return t('passwordMinLength');
  }
  
  if (!/[A-Z]/.test(password)) {
    return t('passwordUppercase');
  }
  
  if (!/[a-z]/.test(password)) {
    return t('passwordLowercase');
  }
  
  if (!/[0-9]/.test(password)) {
    return t('passwordDigit');
  }
  
  if (!/[^A-Za-z0-9]/.test(password)) {
    return t('passwordSpecial');
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
