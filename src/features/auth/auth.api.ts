import { apiClient } from '../../lib/apiClient';
import { Profile } from './auth.store';

export type LoginPayload = {
  email: string;
  password: string;
};

export type LoginResponse = {
  token?: string;
  profile?: Profile;
};

export type VerifyPayload = {
  phone?: string;
  code?: string;
  flow?: 'login' | 'signup';
};

export type VerifyResponse = {
  token?: string;
  profile?: Profile;
};

export const authApi = {
  login(payload: LoginPayload) {
    return apiClient<LoginResponse>('/api/mobile/auth/login', { method: 'POST', body: payload });
  },
  verify(payload?: VerifyPayload) {
    return apiClient<VerifyResponse>('/api/auth/verify', {
      method: 'POST',
      body: payload ?? {}
    });
  },
  fetchProfile() {
    return apiClient<Profile>('/api/mobile/profile');
  },
  logout() {
    return apiClient<void>('/api/mobile/auth/logout', { method: 'POST' });
  },
  deleteAccount() {
    return apiClient<void>('/api/auth/me', { method: 'DELETE' });
  }
};
