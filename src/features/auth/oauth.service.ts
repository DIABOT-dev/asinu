/**
 * OAuth Service
 * Handles real OAuth authentication flows for Google, Apple, and Zalo
 */

import { AuthRequest, DiscoveryDocument, ResponseType, exchangeCodeAsync, makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import i18n from '../../i18n';

const t = (key: string) => i18n.t(key, { ns: 'auth' });

export type OAuthProvider = 'google' | 'apple' | 'zalo' | 'facebook';

export type OAuthResult = {
  type: 'success' | 'cancel' | 'error';
  token?: string;
  idToken?: string;
  code?: string;
  codeVerifier?: string;
  directToken?: string; // JWT from backend callback (Zalo server-side flow)
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
    android: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
    web: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || ''
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

const GOOGLE_DISCOVERY: DiscoveryDocument = {
  authorizationEndpoint: GOOGLE_CONFIG.authorizationEndpoint,
  tokenEndpoint: GOOGLE_CONFIG.tokenEndpoint,
  revocationEndpoint: GOOGLE_CONFIG.revocationEndpoint,
};

/**
 * Authenticate with Google (Authorization Code + PKCE)
 */
export async function authenticateWithGoogle(): Promise<OAuthResult> {
  try {
    if (__DEV__ && process.env.EXPO_PUBLIC_USE_MOCK_OAUTH === 'true') {
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

    // Android: server-side flow qua backend (Android OAuth client không hỗ trợ browser redirect)
    if (Platform.OS === 'android') {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || '';
      if (!apiBase) throw new Error('API base URL chưa được cấu hình');

      const initiateUrl = `${apiBase}/api/auth/google/initiate`;
      const appCallbackUri = 'asinu-lite://auth/google/callback';

      const result = await WebBrowser.openAuthSessionAsync(initiateUrl, appCallbackUri);

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return { type: 'cancel' };
      }

      if (result.type !== 'success' || !result.url) {
        return { type: 'error', error: t('authFailed') };
      }

      const url = new URL(result.url);
      const error = url.searchParams.get('error');
      if (error) return { type: 'error', error: `Google login failed: ${error}` };

      const directToken = url.searchParams.get('token');
      if (!directToken) return { type: 'error', error: t('noAccessToken') };

      return { type: 'success', directToken };
    }

    // iOS: client-side flow với iOS OAuth client
    const clientId = getGoogleClientId();
    if (!clientId) throw new Error(t('googleClientIdMissing'));

    const reverseClientId = clientId.replace('.apps.googleusercontent.com', '');
    const redirectUri = makeRedirectUri({
      native: `com.googleusercontent.apps.${reverseClientId}:/oauth2redirect/google`
    });

    const request = new AuthRequest({
      clientId,
      scopes: GOOGLE_CONFIG.scopes,
      redirectUri,
      usePKCE: true,
      responseType: ResponseType.Code,
    });

    await request.makeAuthUrlAsync(GOOGLE_DISCOVERY);
    const codeVerifier = request.codeVerifier;

    const result = await request.promptAsync(GOOGLE_DISCOVERY);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { type: 'cancel' };
    }

    if (result.type !== 'success') {
      return { type: 'error', error: t('authFailed') };
    }

    if (!codeVerifier) {
      return { type: 'error', error: 'PKCE code verifier missing' };
    }

    const tokenResponse = await exchangeCodeAsync(
      {
        clientId,
        redirectUri,
        code: result.params.code,
        extraParams: { code_verifier: codeVerifier },
      },
      GOOGLE_DISCOVERY
    );

    const accessToken = tokenResponse.accessToken;
    const idToken = tokenResponse.idToken;

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
        sub: profile.id || profile.sub
      }
    };
  } catch (error) {

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

    return {
      type: 'error',
      error: error.message || t('appleAuthFailed')
    };
  }
}

/**
 * Generate PKCE code verifier (random string)
 */
function generateCodeVerifier(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let result = '';
  for (let i = 0; i < 64; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Authenticate with Zalo (native SDK first, fallback to server-side web flow)
 */
export async function authenticateWithZalo(): Promise<OAuthResult> {
  // --- Native ZaloKit (iOS & Android) ---
  try {
    const ZaloKit = require('react-native-zalo-kit');
    const loginFn = ZaloKit?.login ?? ZaloKit?.default?.login;
    if (loginFn) {
      console.log('[Zalo] flow=native_sdk');
      // Timeout 15s: nếu SDK bị treo sau dialog "Bản Zalo không tương thích" → fall through
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('zalo_timeout')), 15000)
      );
      const data = await Promise.race([loginFn('AUTH_VIA_APP'), timeout]);
      const accessToken: string = (data as any).accessToken;

      const profileRes = await fetch('https://graph.zalo.me/v2.0/me?fields=id,name,picture', {
        headers: { access_token: accessToken },
      });
      const profileJson = await profileRes.json();

      if (profileJson?.id) {
        console.log('[Zalo] native_sdk success, userId:', profileJson.id);
        return {
          type: 'success',
          token: accessToken,
          profile: {
            sub: profileJson.id,
            name: profileJson.name,
            picture: profileJson.picture?.data?.url,
          },
        };
      }
      console.log('[Zalo] native_sdk: no profile id, falling through to web');
    } else {
      console.log('[Zalo] native_sdk unavailable, falling through to web');
    }
  } catch (err: any) {
    console.log('[Zalo] native_sdk error:', err?.message ?? err, '→ fallback to web flow');
  }

  // --- Web / server-side callback flow (fallback) ---
  console.log('[Zalo] flow=web_callback');
  try {
    const appId = process.env.EXPO_PUBLIC_ZALO_APP_ID;
    if (!appId) return { type: 'error', error: 'Zalo App ID chưa được cấu hình' };

    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    if (!apiBase) return { type: 'error', error: 'API base URL chưa được cấu hình' };

    // Backend HTTPS endpoint — Zalo redirects here with ?code=
    const redirectUri = `${apiBase}/api/auth/zalo/callback`;

    const statePayload = btoa(JSON.stringify({ n: Date.now() }));

    const authUrl = `https://oauth.zaloapp.com/v4/permission?${new URLSearchParams({
      app_id: appId,
      redirect_uri: redirectUri,
      state: statePayload
    }).toString()}`;

    // Watch for backend redirecting back to the app deep link
    const appCallbackUri = 'asinu-lite://auth/zalo/callback';
    const result = await WebBrowser.openAuthSessionAsync(authUrl, appCallbackUri);

    if (result.type === 'cancel' || result.type === 'dismiss') {
      return { type: 'cancel' };
    }

    if (result.type !== 'success' || !result.url) {
      return { type: 'error', error: t('authFailed') };
    }

    const url = new URL(result.url);
    const error = url.searchParams.get('error');
    if (error) return { type: 'error', error: `Zalo login failed: ${error}` };

    const directToken = url.searchParams.get('token');
    if (!directToken) return { type: 'error', error: t('noAccessToken') };

    return { type: 'success', directToken };
  } catch (error) {

    return {
      type: 'error',
      error: error instanceof Error ? error.message : t('unknownError')
    };
  }
}

/**
 * Authenticate with Facebook (native FBSDK — opens Facebook app directly)
 */
export async function authenticateWithFacebook(): Promise<OAuthResult> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FBSDK = require('react-native-fbsdk-next');
    const LoginManager = FBSDK?.LoginManager ?? FBSDK?.default?.LoginManager;
    const AccessToken = FBSDK?.AccessToken ?? FBSDK?.default?.AccessToken;

    if (!LoginManager || !AccessToken) {
      return authenticateWithFacebookWeb();
    }

    // Đặt login behavior: native app trước, fallback web nếu chưa cài FB
    LoginManager.setLoginBehavior('native_with_fallback');

    const loginResult = await LoginManager.logInWithPermissions(['public_profile', 'email']);

    if (loginResult.isCancelled) {
      return { type: 'cancel' };
    }

    const tokenData = await AccessToken.getCurrentAccessToken();
    if (!tokenData?.accessToken) {
      return { type: 'error', error: t('noAccessToken') };
    }

    const fbAccessToken = tokenData.accessToken;

    // Gửi FB access token lên backend để đổi lấy JWT
    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    if (!apiBase) return { type: 'error', error: 'API base URL chưa được cấu hình' };

    const res = await fetch(`${apiBase}/api/auth/facebook/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: fbAccessToken }),
    });

    if (!res.ok) {
      // Fallback: thử endpoint cũ với server-side flow
      return authenticateWithFacebookWeb();
    }

    const json = await res.json();
    if (!json.token) return { type: 'error', error: t('authFailed') };

    return { type: 'success', directToken: json.token };
  } catch (error) {
    return {
      type: 'error',
      error: error instanceof Error ? error.message : t('unknownError')
    };
  }
}

/**
 * Fallback: Facebook web OAuth (server-side callback flow)
 */
async function authenticateWithFacebookWeb(): Promise<OAuthResult> {
  try {
    const appId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID;
    if (!appId) return { type: 'error', error: 'Facebook App ID chưa được cấu hình' };

    const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL || '';
    const redirectUri = `${apiBase}/api/auth/facebook/callback`;
    const appCallbackUri = 'asinu-lite://auth/facebook/callback';

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?${new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      scope: 'email,public_profile',
      response_type: 'code',
    }).toString()}`;

    const result = await WebBrowser.openAuthSessionAsync(authUrl, appCallbackUri);

    if (result.type === 'cancel' || result.type === 'dismiss') return { type: 'cancel' };
    if (result.type !== 'success' || !result.url) return { type: 'error', error: t('authFailed') };

    const url = new URL(result.url);
    const error = url.searchParams.get('error');
    if (error) return { type: 'error', error: `Facebook login failed: ${error}` };

    const directToken = url.searchParams.get('token');
    if (!directToken) return { type: 'error', error: t('noAccessToken') };

    return { type: 'success', directToken };
  } catch (error) {
    return {
      type: 'error',
      error: error instanceof Error ? error.message : t('unknownError')
    };
  }
}

/**
 * Main OAuth authentication function
 */
export async function authenticateWithProvider(provider: OAuthProvider): Promise<OAuthResult> {

  switch (provider) {
    case 'google':
      return authenticateWithGoogle();
    case 'apple':
      return authenticateWithApple();
    case 'zalo':
      return authenticateWithZalo();
    case 'facebook':
      return authenticateWithFacebook();
    default:
      return {
        type: 'error',
        error: `Unsupported provider: ${provider}`
      };
  }
}
