/**
 * OAuth Service
 * Handles real OAuth authentication flows for Google, Apple, and Zalo
 */

import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

// Required for OAuth to work properly
WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = 'google' | 'apple';

export type OAuthResult = {
  type: 'success' | 'cancel' | 'error';
  token?: string;
  idToken?: string;
  profile?: {
    email?: string;
    name?: string;
    picture?: string;
    sub?: string;
  };
  error?: string;
};

/**
 * Google OAuth Configuration
 */
const GOOGLE_CONFIG = {
  clientId: {
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '416338225523-4ooh8cr3hd7r2skotlkohj40ppsm6s21.apps.googleusercontent.com',
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '416338225523-vs42boe39psg5k927thrhuq8doobb29h.apps.googleusercontent.com',
    web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '416338225523-e095rh2637h6fto5ia0gvnn8faeq96fd.apps.googleusercontent.com'
  },
  scopes: ['openid', 'profile', 'email'],
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
  userInfoEndpoint: 'https://www.googleapis.com/oauth2/v2/userinfo'
};

/**
 * Apple OAuth Configuration (iOS only)
 */
const APPLE_CONFIG = {
  clientId: process.env.EXPO_PUBLIC_APPLE_CLIENT_ID || 'com.asinu.app',
  scopes: ['email', 'name'],
  // Apple uses Sign In with Apple native module on iOS
};



/**
 * Get platform-specific Google Client ID
 */
function getGoogleClientId(): string {
  if (Platform.OS === 'ios') {
    return GOOGLE_CONFIG.clientId.ios;
  } else if (Platform.OS === 'android') {
    return GOOGLE_CONFIG.clientId.android;
  }
  return GOOGLE_CONFIG.clientId.web;
}

/**
 * Authenticate with Google
 */
export async function authenticateWithGoogle(): Promise<OAuthResult> {
  try {
    // Check if running in development mode with mock
    if (__DEV__ && process.env.EXPO_PUBLIC_USE_MOCK_OAUTH === 'true') {
      console.log('[oauth] Using mock Google authentication');
      return {
        type: 'success',
        token: 'mock-google-token',
        idToken: 'mock-google-id-token',
        profile: {
          email: `dev-${Date.now()}@gmail.com`,
          name: 'Người dùng thử (Google)',
          sub: `google_dev_${Date.now()}`
        }
      };
    }

    const clientId = getGoogleClientId();
    if (!clientId) {
      throw new Error('Chưa cấu hình Google Client ID');
    }

    const redirectUri = makeRedirectUri({
      scheme: 'asinu',
      path: 'auth/google'
    });

    const state = `google_${Date.now()}`;

    // Build authorization URL
    const authUrlString = `${GOOGLE_CONFIG.authorizationEndpoint}?${new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: GOOGLE_CONFIG.scopes.join(' '),
      state
    }).toString()}`;

    // Open browser for OAuth
    const result = await WebBrowser.openAuthSessionAsync(authUrlString, redirectUri);

    if (result.type === 'success' && result.url) {
      // Parse token from redirect URL
      const url = new URL(result.url);
      const params = new URLSearchParams(url.hash.substring(1));
      const accessToken = params.get('access_token');
      const idToken = params.get('id_token');

      if (!accessToken) {
        throw new Error('Không nhận được access token');
      }

      // Fetch user profile
      const profileResponse = await fetch(GOOGLE_CONFIG.userInfoEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const profile = await profileResponse.json();

      return {
        type: 'success',
        token: accessToken,
        idToken: idToken || undefined,
        profile: {
          email: profile.email,
          name: profile.name,
          picture: profile.picture,
          sub: profile.id
        }
      };
    }

    if (result.type === 'cancel') {
      return { type: 'cancel' };
    }

    return { type: 'error', error: 'Xác thực thất bại' };
  } catch (error) {
    console.error('[oauth] Google authentication error:', error);
    return {
      type: 'error',
      error: error instanceof Error ? error.message : 'Lỗi không xác định'
    };
  }
}

/**
 * Authenticate with Apple (iOS only)
 */
export async function authenticateWithApple(): Promise<OAuthResult> {
  try {
    // Check platform
    if (Platform.OS !== 'ios') {
      return {
        type: 'error',
        error: 'Đăng nhập Apple chỉ hỗ trợ trên iOS'
      };
    }

    // Check if running in development mode with mock
    if (__DEV__ && process.env.EXPO_PUBLIC_USE_MOCK_OAUTH === 'true') {
      console.log('[oauth] Using mock Apple authentication');
      return {
        type: 'success',
        token: 'mock-apple-token',
        idToken: 'mock-apple-id-token',
        profile: {
          email: `dev-${Date.now()}@privaterelay.appleid.com`,
          name: 'Người dùng thử (Apple)',
          sub: `apple_dev_${Date.now()}`
        }
      };
    }

    // Use native Apple Sign In
    const AppleAuthentication = require('expo-apple-authentication');

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL
      ]
    });

    return {
      type: 'success',
      token: credential.identityToken || 'apple-auth-token',
      idToken: credential.identityToken,
      profile: {
        email: credential.email || undefined,
        name: credential.fullName
          ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
          : undefined,
        sub: credential.user
      }
    };
  } catch (error: any) {
    if (error.code === 'ERR_CANCELED') {
      return { type: 'cancel' };
    }

    console.error('[oauth] Apple authentication error:', error);
    return {
      type: 'error',
      error: error.message || 'Xác thực Apple thất bại'
    };
  }
}

/**
 * Main OAuth authentication function
 */
export async function authenticateWithProvider(provider: OAuthProvider): Promise<OAuthResult> {
  console.log(`[oauth] Starting authentication with ${provider}`);

  switch (provider) {
    case 'google':
      return authenticateWithGoogle();
    case 'apple':
      return authenticateWithApple();
    default:
      return {
        type: 'error',
        error: `Unsupported provider: ${provider}`
      };
  }
}
