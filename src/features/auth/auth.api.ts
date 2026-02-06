import { apiClient } from '../../lib/apiClient';
import { Profile } from './auth.store';

export type LoginPayload = {
  identifier: string; // Email or phone
  password: string;
};

export type RegisterPayload = {
  email: string;
  phone_number: string;
  password: string;
  full_name?: string;
};

export type UpdateProfilePayload = {
  name?: string;
  phone?: string;
  dateOfBirth?: string;
  heightCm?: number;
  weightKg?: number;
  bloodType?: string;
  chronicDiseases?: string[];
  ageRange?: string;
  gender?: string;
  goal?: string;
  bodyType?: string;
};

export type LoginResponse = {
  ok: boolean;
  token?: string;
  user?: { id: number; email: string };
  profile?: Profile;
};

export type VerifyResponse = {
  ok: boolean;
  token?: string;
  profile?: Profile;
};

export type ProfileResponse = {
  ok: boolean;
  profile: Profile;
};

export const authApi = {
  login(payload: LoginPayload) {
    return apiClient<LoginResponse>('/api/auth/email/login', { method: 'POST', body: payload });
  },
  register(payload: RegisterPayload) {
    return apiClient<LoginResponse>('/api/auth/email/register', { method: 'POST', body: payload });
  },
  verify() {
    return apiClient<VerifyResponse>('/api/auth/verify', {
      method: 'POST',
      body: {}
    });
  },
  fetchProfile() {
    console.log('[authApi] fetchProfile - calling /api/mobile/profile');
    return apiClient<ProfileResponse>('/api/mobile/profile').then(res => {
      console.log('[authApi] fetchProfile response:', res);
      console.log('[authApi] fetchProfile profile object:', res.profile);
      console.log('[authApi] fetchProfile profile.name:', res.profile?.name);
      return res.profile;
    });
  },
  updateProfile(payload: UpdateProfilePayload) {
    return apiClient<ProfileResponse>('/api/mobile/profile', { method: 'PUT', body: payload }).then(res => res.profile);
  },
  updatePushToken(pushToken: string) {
    return apiClient<{ ok: boolean; message: string }>('/api/mobile/profile/push-token', { 
      method: 'POST', 
      body: { push_token: pushToken } 
    });
  },
  logout() {
    return apiClient<{ ok: boolean; message: string }>('/api/mobile/auth/logout', { method: 'POST' });
  },
  deleteAccount() {
    return apiClient<{ ok: boolean; message: string }>('/api/auth/me', { method: 'DELETE' });
  }
};
