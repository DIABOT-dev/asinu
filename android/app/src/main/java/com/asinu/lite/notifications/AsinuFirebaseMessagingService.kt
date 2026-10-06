package com.asinu.lite.notifications

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.asinu.lite.MainActivity
import com.asinu.lite.R
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

class AsinuFirebaseMessagingService : ExpoFirebaseMessagingService() {
  companion object {
    private const val CALL_CHANNEL_ID = "asinu_checkin_call_warm_v2"
    private const val URGENT_CHANNEL_ID = "asinu_checkin_call_urgent_warm_v2"
    private const val ALERT_CHANNEL_ID = "asinu_checkin_alert_warm_v2"
    private const val MISSED_CHANNEL_ID = "asinu_checkin_missed_warm_v2"
    private const val NOTICE_CHANNEL_ID = "asinu_checkin_notice_warm_v2"
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    if (data["type"] != "checkin_call") {
      super.onMessageReceived(remoteMessage)
      return
    }
    showCheckinCall(data)
  }

  @SuppressLint("MissingPermission")
  private fun showCheckinCall(data: Map<String, String>) {
    val episodeId = data["episodeId"].orEmpty()
    if (episodeId.isBlank()) return

    val attemptId = data["attemptId"].orEmpty()
    val requestCode = (attemptId.ifBlank { episodeId }).hashCode()
    if (data["action"] == "END_CALL" || data["kind"] == "END_CALL") {
      NotificationManagerCompat.from(this).cancel(requestCode)
      return
    }
    val kind = data["kind"].orEmpty()
    val incomingCall = kind == "INCOMING_CALL" || kind == "URGENT_REPEAT"
    val urgent = data["severity"].equals("URGENT", ignoreCase = true) || kind == "URGENT_REPEAT"
    val missed = kind == "FALLBACK" || kind == "MISSED_CALL"
    val channelId = when {
      urgent && incomingCall -> URGENT_CHANNEL_ID
      urgent -> ALERT_CHANNEL_ID
      incomingCall -> CALL_CHANNEL_ID
      missed -> MISSED_CHANNEL_ID
      else -> NOTICE_CHANNEL_ID
    }
    val soundName = when {
      urgent -> "asinu_emergency"
      incomingCall -> "asinu_incoming"
      missed -> "asinu_missed"
      else -> "asinu_notification"
    }
    // Named resource URIs remain stable when raw resource IDs change on upgrade.
    val sound = Uri.parse("android.resource://$packageName/raw/$soundName")
    val title = data["title"] ?: getString(
      if (data["severity"] == "URGENT") R.string.checkin_call_urgent_title else R.string.checkin_call_title,
    )
    val body = data["body"] ?: getString(R.string.checkin_call_body)

    createCallChannel(channelId, sound, incomingCall)

    val deepLink = Uri.Builder()
      .scheme("asinu-lite")
      .authority("checkin-call")
      .appendPath(episodeId)
      .appendQueryParameter("attemptId", attemptId)
      .build()
    val intent = Intent(Intent.ACTION_VIEW, deepLink, this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra("asinuIncomingCall", incomingCall)
    }
    val pendingIntent = PendingIntent.getActivity(
      this,
      requestCode,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = NotificationCompat.Builder(this, channelId)
      .setSmallIcon(R.mipmap.ic_launcher)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setColor(Color.rgb(8, 132, 109))
      .setCategory(if (incomingCall) NotificationCompat.CATEGORY_CALL else NotificationCompat.CATEGORY_ALARM)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(pendingIntent)
      .setAutoCancel(!incomingCall)
      .setOngoing(incomingCall)
      // Explicit sound for pre-O Android; Android O+ follows its channel.
      .setSound(sound)
      .setVibrate(longArrayOf(0, 700, 300, 700, 300, 700))

    if (incomingCall) {
      val ringSeconds = data["ringSeconds"]?.toLongOrNull()?.coerceIn(30, 180) ?: 60L
      builder
        .setFullScreenIntent(pendingIntent, true)
        .setTimeoutAfter(ringSeconds * 1000)
    }

    try {
      NotificationManagerCompat.from(this).notify(requestCode, builder.build())
    } catch (_: SecurityException) {
      // Android 13+ notification permission can be revoked at any time.
    }
  }

  private fun createCallChannel(channelId: String, sound: Uri, incomingCall: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val audio = AudioAttributes.Builder()
      .setUsage(if (incomingCall) AudioAttributes.USAGE_NOTIFICATION_RINGTONE else AudioAttributes.USAGE_NOTIFICATION)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val channel = NotificationChannel(
      channelId,
      getString(R.string.checkin_call_channel_name),
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      description = getString(R.string.checkin_call_channel_description)
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 700, 300, 700, 300, 700)
      lockscreenVisibility = NotificationCompat.VISIBILITY_PUBLIC
      setSound(sound, audio)
    }
    manager.createNotificationChannel(channel)
  }
}
