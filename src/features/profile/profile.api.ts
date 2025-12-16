import { apiClient } from '../../lib/apiClient';
import { Profile } from '../auth/auth.store';

export const profileApi = {
  fetchProfile() {
    return apiClient<Profile>('/api/mobile/profile');
  }
};
