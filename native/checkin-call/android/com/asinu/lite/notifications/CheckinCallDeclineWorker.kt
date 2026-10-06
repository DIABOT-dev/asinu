package com.asinu.lite.notifications

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import com.asinu.lite.BuildConfig
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI

/** Idempotent decline; short-lived capability only, with no long-lived login credential. */
class CheckinCallDeclineWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    val id = inputData.getString("attemptId").orEmpty()
    val capability = inputData.getString("capability").orEmpty()
    if (!CheckinCallStore.validId(id) || capability.isBlank() || System.currentTimeMillis() >= inputData.getLong("expiresAt", 0)) return Result.success()
    // Trusted app configuration, NEVER a URL supplied by an incoming push.
    val base = CheckinCallStore.preferences(applicationContext).getString("apiBaseUrl", null) ?: return Result.retry()
    val uri = runCatching { URI(base) }.getOrNull() ?: return Result.failure()
    if ((uri.scheme != "https" && !(BuildConfig.DEBUG && uri.scheme == "http")) || uri.host == null || uri.userInfo != null || uri.query != null || uri.fragment != null) return Result.failure()
    var connection: HttpURLConnection? = null
    return try {
      connection = URI(base.trimEnd('/') + "/api/mobile/checkin-call/native/attempts/$id/decline").toURL().openConnection() as HttpURLConnection
      connection.requestMethod = "POST"
      connection.instanceFollowRedirects = false // capability cannot leak to redirects
      connection.connectTimeout = 8_000
      connection.readTimeout = 8_000
      connection.doOutput = true
      connection.setRequestProperty("Content-Type", "application/json")
      connection.outputStream.use { it.write(JSONObject().put("capability", capability).toString().toByteArray(Charsets.UTF_8)) }
      val status = connection.responseCode
      when {
        status in 200..299 -> Result.success()
        status == 429 || status >= 500 -> Result.retry()
        else -> Result.failure() // expired/malformed/unsupported endpoint: do not retry forever
      }
    } catch (_: Exception) { Result.retry() } finally { connection?.disconnect() }
  }
}
