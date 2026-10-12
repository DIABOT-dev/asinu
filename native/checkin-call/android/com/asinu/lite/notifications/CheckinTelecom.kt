package com.asinu.lite.notifications

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.telecom.Connection
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import com.asinu.lite.R
import java.util.concurrent.ConcurrentHashMap

/** Telecom owns call state/audio routing; Asinu owns its branded UI and ringtone. */
object CheckinTelecom {
  const val ACCOUNT_ID = "asinu-checkin-branded"
  const val ATTEMPT_ID = "com.asinu.lite.CHECKIN_ATTEMPT_ID"
  const val ANSWERED = "com.asinu.lite.TELECOM_ANSWERED"
  private val handler = Handler(Looper.getMainLooper())
  private val connections = ConcurrentHashMap<String, CheckinTelecomConnection>()
  private val fallbacks = ConcurrentHashMap<String, () -> Unit>()

  fun accountHandle(context: Context) = PhoneAccountHandle(ComponentName(context, CheckinConnectionService::class.java), ACCOUNT_ID)
  private fun manager(context: Context) = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
  fun supported(context: Context): Boolean = Build.VERSION.SDK_INT >= 26 && manager(context) != null

  fun register(context: Context): Boolean = runCatching {
    val telecom = manager(context) ?: return false
    if (!supported(context)) return false
    // The permission-free self-managed query was introduced in Android 13.
    // On Android 8–12L, registering the same handle again is idempotent and
    // avoids requesting phone-number/contacts access just to inspect our account.
    if (Build.VERSION.SDK_INT < 33 || !telecom.ownSelfManagedPhoneAccounts.contains(accountHandle(context))) {
      telecom.registerPhoneAccount(PhoneAccount.builder(accountHandle(context), "Asinu")
        .setShortDescription(context.getString(R.string.checkin_call_channel_name))
        .setIcon(Icon.createWithResource(context, R.mipmap.ic_launcher))
        .setCapabilities(PhoneAccount.CAPABILITY_SELF_MANAGED)
        .setSupportedUriSchemes(listOf(PhoneAccount.SCHEME_SIP))
        .build())
    }
    for (legacy in listOf("asinu-checkin", "asinu-checkin-system")) {
      telecom.unregisterPhoneAccount(PhoneAccountHandle(ComponentName(context, CheckinConnectionService::class.java), legacy))
    }
    true
  }.getOrDefault(false)

  // Self-managed accounts are enabled by Android at registration.
  fun enabled(context: Context): Boolean = register(context)

  fun openSettings(context: Context): Boolean = runCatching {
    context.startActivity(Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
      .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    true
  }.getOrDefault(false)

  fun showIncoming(context: Context, id: String, fallback: () -> Unit): Boolean {
    if (!register(context) || !enabled(context) || CheckinCallStore.ringing(context, id) == null) return false
    fallbacks[id] = fallback
    return try {
      manager(context)!!.addNewIncomingCall(accountHandle(context), Bundle().apply {
        putString(ATTEMPT_ID, id)
        putParcelable(TelecomManager.EXTRA_INCOMING_CALL_ADDRESS, Uri.fromParts(PhoneAccount.SCHEME_SIP, "asinu", null))
      })
      // A missing/broken OEM service must not silently swallow a reminder.
      handler.postDelayed({ failed(context, id) }, 8_000)
      true
    } catch (_: Exception) {
      fallbacks.remove(id)
      false
    }
  }

  fun failed(context: Context, id: String) {
    val fallback = fallbacks.remove(id) ?: return
    connections[id]?.finish(DisconnectCause.ERROR)
    if (CheckinCallStore.ringing(context, id) != null) fallback()
  }

  fun attach(connection: CheckinTelecomConnection): Boolean {
    // A delayed service binding must not create a second call UI after the
    // watchdog has already handed this attempt back to the notification path.
    if (!fallbacks.containsKey(connection.attemptId)) return false
    if (connections.putIfAbsent(connection.attemptId, connection) != null) return false
    return true
  }

  fun showIncomingUi(context: Context, id: String) {
    if (!connections.containsKey(id)) return
    // Publish exactly once when Telecom permits presentation. Android displays
    // our full-screen CallStyle notification with the Asinu logo and sound.
    val present = fallbacks.remove(id) ?: return
    if (CheckinCallStore.ringing(context, id) != null) present()
  }
  fun answerFromUi(context: Context, id: String): Boolean {
    val connection = connections[id]
    if (connection != null) connection.accept(launchHandoff = false)
    else CheckinCallStore.answer(context, id)
    return CheckinCallStore.pending(context)?.optString("attemptId") == id
  }
  fun silence(context: Context, id: String) = CheckinCallNotifications.silence(context, id)

  fun remove(connection: CheckinTelecomConnection) { connections.remove(connection.attemptId, connection) }
  fun callIds(): List<String> = connections.keys.toList()
  fun isActive(id: String) = connections[id]?.state == Connection.STATE_ACTIVE
  fun confirmed(context: Context, id: String) = onMain {
    val data = CheckinCallStore.pending(context)?.takeIf { it.optString("attemptId") == id } ?: return@onMain
    connections[id]?.apply { setActive(); expireAt(data.optLong("expiresAt")) }
  }
  fun end(id: String) = onMain {
    fallbacks.remove(id)
    connections[id]?.finish(DisconnectCause.REMOTE)
  }
  fun onMain(action: () -> Unit) { if (Looper.myLooper() == Looper.getMainLooper()) action() else handler.post(action) }
}
