import i18n from '../../i18n';
import { apiClient } from '../../lib/apiClient';
import { Profile } from './auth.store';
import { authenticateWithProvider, OAuthProvider } from './oauth.service';

export type SocialProvider = 'google' | 'apple' | 'zalo' | 'facebook';

export type PhoneAuthPayload = {
  phone: string;
};

export type SocialAuthPayload = {
  provider: SocialProvider;
  token?: string;
  rawProfile?: Record<string, unknown>;
  phone?: string;
};

export type ZeroOtpResponse = {
  token?: string;
  profile?: Profile;
};

const createZeroOtpError = (message: string) =>
  Object.assign(new Error(message), {
    code: 'ZERO_OTP_UNAVAILABLE'
  });

export const authService = {
  async submitPhoneAuth(payload: PhoneAuthPayload): Promise<ZeroOtpResponse> {
    try {
      const response = await apiClient<{ok: boolean, token: string, user: {id: string, email?: string}}>('/api/mobile/auth/phone', {
        method: 'POST',
        body: { phone_number: payload.phone }
      });
      
      return {
        token: response.token,
        profile: {
          id: response.user.id,
          name: response.user.email?.split('@')[0] || i18n.t('defaultUser', { ns: 'auth' }),
          email: response.user.email,
          phone: payload.phone
        }
      };
    } catch (error) {
      throw error;
    }
  },
  async submitSocialAuth(payload: SocialAuthPayload): Promise<ZeroOtpResponse> {
    try {
      // Step 1: Perform real OAuth authentication to get token and profile

      const oauthResult = await authenticateWithProvider(payload.provider as OAuthProvider);
      
      if (oauthResult.type === 'cancel') {
        throw new Error(i18n.t('loginCancelled', { ns: 'auth' }));
      }
      
      if (oauthResult.type === 'error') {
        throw new Error(oauthResult.error || i18n.t('authFailed', { ns: 'auth' }));
      }
      
      // Zalo/Facebook server-side flow: backend already handled everything, token is the JWT
      if ((payload.provider === 'zalo' || payload.provider === 'facebook') && oauthResult.directToken) {
        const meResponse = await apiClient<{ok: boolean, user: {id: string, email?: string, full_name?: string, avatar_url?: string}}>(
          '/api/auth/me',
          { headers: { Authorization: `Bearer ${oauthResult.directToken}` } }
        );
        return {
          token: oauthResult.directToken,
          profile: {
            id: meResponse.user.id,
            name: meResponse.user.full_name || meResponse.user.email?.split('@')[0] || 'User',
            email: meResponse.user.email,
            phone: payload.phone,
            avatarUrl: meResponse.user.avatar_url
          }
        };
      }

      // Step 2: Send OAuth result to backend for verification and user creation
      const endpoint = `/api/auth/${payload.provider}`;

      const providerId = oauthResult.profile?.sub || `${payload.provider}_${Date.now()}`;
      const email = oauthResult.profile?.email || payload.rawProfile?.email as string;
      const requestBody = {
        token: oauthResult.token || oauthResult.idToken || 'oauth-token',
        provider_id: providerId,
        email: email,
        phone_number: payload.phone
      };

      const response = await apiClient<{ok: boolean, token: string, user: {id: string, email?: string}}>(
        endpoint,
        { method: 'POST', body: requestBody }
      );

      return {
        token: response.token,
        profile: {
          id: response.user.id,
          name: oauthResult.profile?.name || response.user.email?.split('@')[0] || 'User',
          email: response.user.email,
          phone: payload.phone,
          avatarUrl: oauthResult.profile?.picture
        }
      };
    } catch (error) {

      throw error;
    }
  }
};
