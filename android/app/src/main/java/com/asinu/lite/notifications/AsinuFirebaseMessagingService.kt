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
    private const val CALL_CHANNEL_ID = "asinu_checkin_call_v1"
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
    val title = data["title"] ?: getString(
      if (data["severity"] == "URGENT") R.string.checkin_call_urgent_title else R.string.checkin_call_title,
    )
    val body = data["body"] ?: getString(R.string.checkin_call_body)

    createCallChannel()

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

    val builder = NotificationCompat.Builder(this, CALL_CHANNEL_ID)
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

  private fun createCallChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val sound = Uri.parse("android.resource://$packageName/${R.raw.asinu_alert}")
    val audio = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val channel = NotificationChannel(
      CALL_CHANNEL_ID,
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
