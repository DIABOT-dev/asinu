package com.asinu.lite.zalo

import android.app.Activity
import android.util.Base64
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.zing.zalo.zalosdk.oauth.LoginVia
import com.zing.zalo.zalosdk.oauth.OAuthCompleteListener
import com.zing.zalo.zalosdk.oauth.OauthResponse
import com.zing.zalo.zalosdk.oauth.ZaloSDK
import com.zing.zalo.zalosdk.oauth.model.ErrorResponse
import java.security.MessageDigest
import java.security.SecureRandom

class AsinuZaloAuthModule(
  private val reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = NAME

  @ReactMethod
  fun login(authType: String?, promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Current Android activity is not available")
      return
    }

    val loginVia = when (authType) {
      "AUTH_VIA_APP" -> LoginVia.APP
      "AUTH_VIA_WEB" -> LoginVia.WEB
      else -> LoginVia.APP_OR_WEB
    }

    val codeVerifier = generateCodeVerifier()
    val codeChallenge = try {
      generateCodeChallenge(codeVerifier)
    } catch (error: Exception) {
      promise.reject("PKCE_ERROR", error.message, error)
      return
    }

    reactContext.runOnUiQueueThread {
      ZaloSDK.Instance.authenticateZaloWithAuthenType(
        activity,
        loginVia,
        codeChallenge,
        object : OAuthCompleteListener() {
          override fun onAuthenError(errorResponse: ErrorResponse) {
            promise.reject(
              errorResponse.errorCode.toString(),
              errorResponse.errorMsg ?: "Zalo authentication failed"
            )
          }

          override fun onGetOAuthComplete(response: OauthResponse) {
            exchangeOAuthCode(activity, response.oauthCode, codeVerifier, promise)
          }
        }
      )
    }
  }

  private fun exchangeOAuthCode(
    activity: Activity,
    oauthCode: String?,
    codeVerifier: String,
    promise: Promise
  ) {
    if (oauthCode.isNullOrBlank()) {
      promise.reject("NO_OAUTH_CODE", "Zalo did not return an OAuth code")
      return
    }

    Thread {
      try {
        ZaloSDK.Instance.getAccessTokenByOAuthCode(
          activity,
          oauthCode,
          codeVerifier
        ) { data ->
          val errorCode = data.optInt("error")
          if (errorCode != 0) {
            promise.reject(
              errorCode.toString(),
              data.optString("message", "Zalo token exchange failed")
            )
            return@getAccessTokenByOAuthCode
          }

          val accessToken = data.optString("access_token")
          if (accessToken.isBlank()) {
            promise.reject("NO_ACCESS_TOKEN", "Zalo did not return an access token")
            return@getAccessTokenByOAuthCode
          }

          val result = Arguments.createMap()
          result.putString("accessToken", accessToken)
          result.putString("refreshToken", data.optString("refresh_token"))
          promise.resolve(result)
        }
      } catch (error: Exception) {
        promise.reject("TOKEN_EXCHANGE_ERROR", error.message, error)
      }
    }.start()
  }

  private fun generateCodeVerifier(): String {
    val random = SecureRandom()
    val code = ByteArray(32)
    random.nextBytes(code)
    return Base64.encodeToString(code, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
  }

  private fun generateCodeChallenge(codeVerifier: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(codeVerifier.toByteArray())
    return Base64.encodeToString(digest, Base64.URL_SAFE or Base64.NO_WRAP or Base64.NO_PADDING)
  }

  companion object {
    const val NAME = "AsinuZaloAuth"
  }
}
