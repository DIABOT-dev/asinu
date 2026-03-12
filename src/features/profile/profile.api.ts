import { apiClient } from '../../lib/apiClient';
import { Profile } from '../auth/auth.store';

type ProfileResponse = {
  ok: boolean;
  profile: Profile;
};

export const profileApi = {
  fetchProfile() {
    return apiClient<ProfileResponse>('/api/mobile/profile').then(res => res.profile);
  },
  updateProfile(data: Partial<Pick<Profile, 'name' | 'phone'>>) {
    return apiClient<{ ok: boolean; message: string }>('/api/mobile/profile', {
      method: 'PUT',
      body: data
    });
  }
};
