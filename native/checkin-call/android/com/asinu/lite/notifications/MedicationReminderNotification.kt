package com.asinu.lite.notifications

import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.asinu.lite.MainActivity
import com.asinu.lite.R

/** Ordinary push fallback. Every action opens the authenticated app; none confirms a dose in native code. */
object MedicationReminderNotification {
  @SuppressLint("MissingPermission")
  fun show(context: Context, data: Map<String, String>) {
    val dose = data["medDoseId"].orEmpty()
    if (!CheckinCallStore.validId(dose)) return
    val en = data["lang"] == "en"
    val channel = "asinu_medication_reminder_v1"
    if (Build.VERSION.SDK_INT >= 26) {
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
        .createNotificationChannel(NotificationChannel(channel, if (en) "Medication reminders" else "Nhắc thuốc", NotificationManager.IMPORTANCE_HIGH))
    }
    fun open(button: Int): PendingIntent {
      val uri = Uri.Builder().scheme("asinu-lite").authority("medication").appendPath("call").appendPath(dose)
        .apply { if (button > 0) appendQueryParameter("quickButton", button.toString()) }.build()
      val intent = Intent(context, MainActivity::class.java).setAction(Intent.ACTION_VIEW).setData(uri)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      return PendingIntent.getActivity(context, dose.hashCode() + button, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val builder = NotificationCompat.Builder(context, channel)
      .setSmallIcon(R.drawable.asinu_notification_small)
      .setContentTitle(data["title"] ?: if (en) "Medication reminder" else "Đến giờ nhắc thuốc")
      .setContentText(data["body"] ?: if (en) "Open Asinu to respond." else "Mở Asinu để trả lời.")
      .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_REMINDER)
      .setContentIntent(open(0)).setAutoCancel(true).setTimeoutAfter(2 * 60 * 60 * 1000L)
      .addAction(0, if (en) "Taken" else "Đã uống", open(1))
      .addAction(0, if (en) "Skip" else "Bỏ qua", open(2))
      .addAction(0, if (en) "Out of medicine" else "Hết thuốc", open(3))
    try { NotificationManagerCompat.from(context).notify(dose.hashCode(), builder.build()) }
    catch (_: SecurityException) { /* Notification permission may be revoked. */ }
  }
}
