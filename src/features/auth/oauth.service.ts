/**
 * OAuth Service
 * Handles real OAuth authentication flows for Google, Apple, and Zalo
 */

import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import i18n from '../../i18n';

const t = (key: string) => i18n.t(key, { ns: 'auth' });

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
    ios: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '726570048913-oq7rk69ronarv55lucd7it29t8ti0c32.apps.googleusercontent.com',
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '726570048913-0oj1afglacg0h4p77toi6kvr6buh46j8.apps.googleusercontent.com',
    web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '726570048913-atltseun4619ge72ba6itpiqc6hbjnr0.apps.googleusercontent.com'
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
          name: t('devUserGoogle'),
          sub: `google_dev_${Date.now()}`
        }
      };
    }

    const clientId = getGoogleClientId();
    if (!clientId) {
      throw new Error(t('googleClientIdMissing'));
    }

    const redirectUri = makeRedirectUri({
      scheme: 'asinu-lite',
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
        throw new Error(t('noAccessToken'));
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

    return { type: 'error', error: t('authFailed') };
  } catch (error) {
    console.error('[oauth] Google authentication error:', error);
    return {
      type: 'error',
      error: error instanceof Error ? error.message : t('unknownError')
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
        error: t('appleOnlyIOS')
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
          name: t('devUserApple'),
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
      error: error.message || t('appleAuthFailed')
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
