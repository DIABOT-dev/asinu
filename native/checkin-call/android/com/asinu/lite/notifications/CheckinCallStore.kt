package com.asinu.lite.notifications

import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.modules.core.DeviceEventManagerModule
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.text.ParsePosition
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/** Durable handoff only; no session/password/profile details. Sources survive Expo prebuild. */
object CheckinCallStore {
  const val CHANGED = "com.asinu.lite.CHECKIN_CALL_CHANGED"
  const val ANSWER = "com.asinu.lite.CHECKIN_CALL_ANSWER"
  const val PREFS = "asinu_checkin_calls"
  private var reactContext: ReactApplicationContext? = null

  fun attach(context: ReactApplicationContext) { reactContext = context }
  fun detach(context: ReactApplicationContext) { if (reactContext === context) reactContext = null }
  fun preferences(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
  fun validId(id: String): Boolean = try { UUID.fromString(id).toString().equals(id, true) } catch (_: Exception) { false }
  fun deadline(value: String?): Long {
    if (value == null || !Regex("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{3,9})?Z").matches(value)) return 0
    val normalized = value.replace(Regex("(\\.\\d{3})\\d+(?=Z$)"), "$1")
    val format = SimpleDateFormat(if (normalized.contains('.')) "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'" else "yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US)
    format.timeZone = TimeZone.getTimeZone("UTC"); format.isLenient = false
    val position = ParsePosition(0)
    val parsed = format.parse(normalized, position)
    return if (position.index == normalized.length) parsed?.time ?: 0L else 0L
  }

  @Synchronized fun incoming(context: Context, data: Map<String, String>): Boolean {
    val id = data["attemptId"].orEmpty()
    if (!validId(id) || !validId(data["episodeId"].orEmpty())) return false
    val prefs = preferences(context)
    if (prefs.contains("done:$id") || prefs.contains("answered:$id")) return false
    // New servers send the original deadline: delayed FCM cannot start a fresh ring.
    val supplied = data["ringDeadline"]
    val end = if (!supplied.isNullOrBlank()) deadline(supplied) else
      System.currentTimeMillis() + (data["ringSeconds"]?.toLongOrNull()?.coerceIn(30, 180) ?: 60) * 1000
    if (end <= System.currentTimeMillis()) return false
    val existing = prefs.getString("ring:$id", null)
    if (existing != null) return false // repeated delivery must not replay the ringtone
    prune(context)
    val stored = JSONObject()
    listOf("episodeId", "attemptId", "kind", "severity", "lang", "declineCapability").forEach { key ->
      data[key]?.let { stored.put(key, it) }
    }
    prefs.edit().putString("ring:$id", stored.put("expiresAt", end).toString()).commit()
    return true
  }

  @Synchronized fun ringing(context: Context, id: String): JSONObject? {
    val prefs = preferences(context)
    if (prefs.contains("done:$id")) return null
    val data = prefs.getString("ring:$id", null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return null
    if (data.optLong("expiresAt") <= System.currentTimeMillis()) { end(context, id); return null }
    return data
  }

  @Synchronized fun answer(context: Context, id: String): Boolean {
    val data = ringing(context, id) ?: return false
    data.remove("declineCapability")
    preferences(context).edit().remove("ring:$id").putLong("answered:$id", System.currentTimeMillis())
      .putString("pending", data.put("expiresAt", System.currentTimeMillis() + 120_000).toString()).commit()
    cancelNotification(context, id)
    changed(context)
    emit("onVoipCallAnswered", data)
    return true
  }

  @Synchronized fun pending(context: Context): JSONObject? {
    val data = preferences(context).getString("pending", null)?.let { runCatching { JSONObject(it) }.getOrNull() } ?: return null
    if (data.optLong("expiresAt") <= System.currentTimeMillis() || preferences(context).contains("done:${data.optString("attemptId")}")) {
      preferences(context).edit().remove("pending").commit()
      return null
    }
    return data
  }

  @Synchronized fun confirm(context: Context, id: String, end: String, promoteRinging: Boolean = false): Boolean {
    val data = pending(context)?.takeIf { it.optString("attemptId") == id }
      ?: (if (promoteRinging) ringing(context, id) else null) ?: return false
    data.remove("declineCapability")
    val expires = deadline(end).takeIf { it > System.currentTimeMillis() } ?: (System.currentTimeMillis() + 120_000)
    preferences(context).edit().remove("ring:$id").putLong("answered:$id", System.currentTimeMillis())
      .putString("pending", data.put("expiresAt", expires).toString()).commit()
    cancelNotification(context, id)
    changed(context)
    return true
  }

  @Synchronized fun end(context: Context, id: String) {
    if (!validId(id)) return
    val prefs = preferences(context)
    val data = prefs.getString("ring:$id", null)?.let { runCatching { JSONObject(it) }.getOrNull() }
      ?: prefs.getString("pending", null)?.let { runCatching { JSONObject(it) }.getOrNull() }?.takeIf { it.optString("attemptId") == id }
    val edit = prefs.edit().remove("ring:$id").putLong("done:$id", System.currentTimeMillis())
    if (prefs.getString("pending", null)?.let { runCatching { JSONObject(it).optString("attemptId") }.getOrNull() } == id) edit.remove("pending")
    edit.commit()
    cancelNotification(context, id)
    changed(context)
    if (data != null) emit("onVoipCallEnded", data)
    prune(context)
  }

  fun cancelNotification(context: Context, id: String) {
    NotificationManagerCompat.from(context).cancel("checkin:$id", 1)
    NotificationManagerCompat.from(context).cancel(id.hashCode()) // pre-upgrade notification
  }

  private fun changed(context: Context) { context.sendBroadcast(Intent(CHANGED).setPackage(context.packageName)) }
  private fun emit(name: String, data: JSONObject) {
    val context = reactContext ?: return
    if (!context.hasActiveReactInstance()) return
    val value = Arguments.createMap()
    listOf("episodeId", "attemptId", "kind", "severity", "lang").forEach { value.putString(it, data.optString(it)) }
    // Never send the decline credential into React/analytics/logging.
    runCatching { context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(name, value) }
  }

  private fun prune(context: Context) {
    val prefs = preferences(context)
    val edit = prefs.edit()
    val now = System.currentTimeMillis()
    prefs.all.filterKeys { it.startsWith("done:") || it.startsWith("answered:") }.entries
      .sortedByDescending { it.value as? Long ?: 0 }.forEachIndexed { index, entry ->
        if (index >= 128 || now - (entry.value as? Long ?: 0) > 86_400_000) edit.remove(entry.key)
      }
    prefs.all.filterKeys { it.startsWith("ring:") }.forEach { (key, value) ->
      val expires = runCatching { JSONObject(value as String).optLong("expiresAt") }.getOrDefault(0)
      if (expires <= now) edit.remove(key)
    }
    edit.apply()
  }
}
