package com.asinu.lite.notifications

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager

/** Android implementation of the shared call handoff; iOS keeps its CallKit bridge. */
class AsinuCheckinCallModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName() = "AsinuCheckinCallModule"
  override fun initialize() { super.initialize(); CheckinCallStore.attach(context) }
  override fun invalidate() { CheckinCallStore.detach(context); super.invalidate() }
  @ReactMethod fun addListener(name: String) {}
  @ReactMethod fun removeListeners(count: Double) {}
  @ReactMethod fun isGuidanceSoundAllowed(promise: Promise) {
    val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    promise.resolve(audio.ringerMode == AudioManager.RINGER_MODE_NORMAL &&
      audio.getStreamVolume(AudioManager.STREAM_MUSIC) > 0)
  }
  @ReactMethod fun configure(apiBaseUrl: String, promise: Promise) {
    CheckinCallStore.preferences(context).edit().putString("apiBaseUrl", apiBaseUrl).commit()
    promise.resolve(true)
  }
  @ReactMethod fun getPendingCall(promise: Promise) {
    val data = CheckinCallStore.pending(context)
    if (data == null) { promise.resolve(null); return }
    val result = Arguments.createMap()
    listOf("episodeId", "attemptId", "kind", "severity", "lang").forEach { result.putString(it, data.optString(it)) }
    promise.resolve(result)
  }
  @ReactMethod fun consumePendingCall(promise: Promise) = getPendingCall(promise)
  @ReactMethod fun completeAnswer(id: String, connected: Boolean, deadline: String, promise: Promise) {
    if (!connected) { CheckinCallStore.end(context, id); promise.resolve(false); return }
    promise.resolve(CheckinCallStore.confirm(context, id, deadline, promoteRinging = true))
  }
  @ReactMethod fun setCallUIActive(id: String, active: Boolean, deadline: String, promise: Promise) {
    if (active) {
      CheckinCallStore.cancelNotification(context, id)
      CheckinCallStore.confirm(context, id, deadline)
    }
    // No native TTS/media owns Android audio: the existing shared app player is the sole owner.
    promise.resolve(false) // Expo must configure Android audio; native owns no audio session.
  }
  @ReactMethod fun endCall(id: String, promise: Promise) { CheckinCallStore.end(context, id); promise.resolve(true) }
  @ReactMethod fun getCallPermissions(promise: Promise) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val result = Arguments.createMap()
    result.putBoolean("notifications", NotificationManagerCompat.from(context).areNotificationsEnabled())
    result.putBoolean("fullScreen", Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent())
    val channels = listOf("asinu_checkin_call_warm_v2", "asinu_checkin_call_urgent_warm_v2")
    result.putBoolean("channels", Build.VERSION.SDK_INT < 26 || channels.all { id ->
      val channel = manager.getNotificationChannel(id)
      channel == null || channel.importance >= NotificationManager.IMPORTANCE_HIGH
    })
    promise.resolve(result)
  }
  @ReactMethod fun openCallSettings(fullScreen: Boolean, promise: Promise) {
    val intent = if (fullScreen && Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}"))
      else Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
    try { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); promise.resolve(true) }
    catch (_: Exception) { promise.resolve(false) }
  }
}

class AsinuCheckinCallPackage : ReactPackage {
  override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> = listOf(AsinuCheckinCallModule(context))
  override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
