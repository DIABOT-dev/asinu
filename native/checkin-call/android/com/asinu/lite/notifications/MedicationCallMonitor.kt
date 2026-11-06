package com.asinu.lite.notifications

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.asinu.lite.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.util.concurrent.Executors

/** Read-only, three-minute capability; no login credential is stored by native. */
object MedicationCallMonitor {
  private val handler = Handler(Looper.getMainLooper())
  private val worker = Executors.newSingleThreadExecutor()
  private val watching = java.util.concurrent.ConcurrentHashMap.newKeySet<String>()
  fun start(context: Context, id: String) {
    if (!watching.add(id)) return
    val stopAt = System.currentTimeMillis() + 180_000
    fun poll() {
      val data = CheckinCallStore.ringing(context, id) ?: CheckinCallStore.pending(context)?.takeIf { it.optString("attemptId") == id }
      if (data == null || data.optString("statusCapability").isBlank() || System.currentTimeMillis() > stopAt) { watching.remove(id); return }
      worker.execute {
        val active = readStatus(context, id, data.optString("statusCapability"))
        handler.post {
          if (active == false) { CheckinCallStore.end(context, id); watching.remove(id) }
          else handler.postDelayed({ poll() }, 3000)
        }
      }
    }
    handler.postDelayed({ poll() }, 3000)
  }
  internal fun readStatus(context: Context, id: String, capability: String): Boolean? {
    val base = CheckinCallStore.preferences(context).getString("apiBaseUrl", null) ?: return null
    val uri = runCatching { URI(base) }.getOrNull() ?: return null
    if ((uri.scheme != "https" && !(BuildConfig.DEBUG && uri.scheme == "http")) || uri.host == null || uri.userInfo != null || uri.query != null || uri.fragment != null || !CheckinCallStore.validId(id)) return null
    var connection: HttpURLConnection? = null
    return try {
      connection = URI(base.trimEnd('/') + "/api/mobile/med-native/$id/status").toURL().openConnection() as HttpURLConnection
      connection.requestMethod = "POST"; connection.instanceFollowRedirects = false
      connection.connectTimeout = 3000; connection.readTimeout = 3000; connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.outputStream.use { it.write(JSONObject().put("capability", capability).toString().toByteArray(Charsets.UTF_8)) }
      if (connection.responseCode != 200) null else JSONObject(connection.inputStream.bufferedReader().use { it.readText() }).optBoolean("active", true)
    } catch (_: Exception) { null } finally { connection?.disconnect() }
  }
}
