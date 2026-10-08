package com.asinu.lite.notifications

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.ActivityOptions
import android.app.NotificationManager
import android.app.Notification
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.UserManager
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import com.asinu.lite.MainActivity
import com.asinu.lite.R
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/** Native call actions stay available when React is not running. */
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
    // Credential-protected handoff/work storage is unavailable before first unlock.
    if (Build.VERSION.SDK_INT >= 24 && !(getSystemService(Context.USER_SERVICE) as UserManager).isUserUnlocked) return
    showCheckinCall(data)
  }

  @SuppressLint("MissingPermission")
  private fun showCheckinCall(data: Map<String, String>) {
    val episodeId = data["episodeId"].orEmpty()
    if (episodeId.isBlank()) return

    val attemptId = data["attemptId"].orEmpty()
    val requestCode = (attemptId.ifBlank { episodeId }).hashCode()
    if (data["action"] == "END_CALL" || data["kind"] == "END_CALL") {
      CheckinCallStore.end(this, attemptId)
      NotificationManagerCompat.from(this).cancel(requestCode)
      return
    }
    val kind = data["kind"].orEmpty()
    val incomingCall = kind == "INCOMING_CALL" || kind == "URGENT_REPEAT"
    if (incomingCall && !CheckinCallStore.incoming(this, data)) return
    val hasUrgentSeverity = data["severity"].equals("URGENT", ignoreCase = true)
    val urgent = hasUrgentSeverity || kind == "URGENT_REPEAT"
    val missed = kind == "FALLBACK" || kind == "MISSED_CALL"
    val channelId = when {
      incomingCall && hasUrgentSeverity -> URGENT_CHANNEL_ID
      incomingCall -> CALL_CHANNEL_ID
      urgent -> ALERT_CHANNEL_ID
      missed -> MISSED_CHANNEL_ID
      else -> NOTICE_CHANNEL_ID
    }
    // CallKit selects the ringtone by severity, including repeat deliveries.
    // Keep the Android channel and pre-O sound aligned with that same choice.
    val soundName = when {
      incomingCall && !hasUrgentSeverity -> "asinu_incoming"
      urgent -> "asinu_emergency"
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
      val call = CheckinCallStore.ringing(this, attemptId) ?: return
      fun callIntent(action: String) = Intent(this, CheckinIncomingCallActivity::class.java).apply {
        this.action = action
        this.data = Uri.parse("asinu-internal://checkin/$attemptId/$action")
        putExtra("attemptId", attemptId)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      }
      val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
      // Grant only these immutable, explicit incoming-call Activity intents.
      // No blanket background launches or overlay permissions are used.
      val options = if (Build.VERSION.SDK_INT >= 35) ActivityOptions.makeBasic().apply {
        setPendingIntentCreatorBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED)
      }.toBundle() else null
      val view = PendingIntent.getActivity(this, requestCode, callIntent(Intent.ACTION_VIEW), flags, options)
      val answer = PendingIntent.getActivity(this, requestCode, callIntent(CheckinCallStore.ANSWER), flags, options)
      val decline = PendingIntent.getBroadcast(this, requestCode, Intent(this, CheckinCallDeclineReceiver::class.java).apply {
        this.data = Uri.parse("asinu-internal://checkin/$attemptId/decline")
        putExtra("attemptId", attemptId)
      }, flags)
      builder
        .setStyle(NotificationCompat.CallStyle.forIncomingCall(Person.Builder().setName(title).setImportant(true).build(), decline, answer))
        .setContentIntent(view)
        .setTimeoutAfter((call.optLong("expiresAt") - System.currentTimeMillis()).coerceAtLeast(1))
      val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (Build.VERSION.SDK_INT < 34 || manager.canUseFullScreenIntent()) builder.setFullScreenIntent(view, true)
    }

    try {
      val notification = builder.build()
      if (incomingCall) notification.flags = notification.flags or Notification.FLAG_INSISTENT
      if (incomingCall) NotificationManagerCompat.from(this).notify("checkin:$attemptId", 1, notification)
      else NotificationManagerCompat.from(this).notify(requestCode, notification)
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
      getString(when (channelId) {
        URGENT_CHANNEL_ID, ALERT_CHANNEL_ID -> R.string.checkin_call_urgent_title
        MISSED_CHANNEL_ID -> R.string.checkin_call_missed_channel_name
        NOTICE_CHANNEL_ID -> R.string.checkin_call_notice_channel_name
        else -> R.string.checkin_call_channel_name
      }),
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
