package com.asinu.lite.notifications

import android.content.Context
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.net.Uri
import com.facebook.react.bridge.Promise
import java.io.File

/** Telecom owns focus/routing; voice prompts must not compete as music playback. */
object CheckinCallAudioPlayer {
  private class Entry(val callId: String, val player: MediaPlayer, val event: (Boolean, Boolean, String?) -> Unit, val cancelLoad: () -> Unit)
  private val players = mutableMapOf<String, Entry>() // main thread only

  fun load(context: Context, callId: String, playerId: String, uri: String, promise: Promise,
    event: (Boolean, Boolean, String?) -> Unit) = CheckinTelecom.onMain {
    var player: MediaPlayer? = null
    var settled = false
    try {
      check(CheckinTelecom.isActive(callId)) { "Call is not active" }
      check(CheckinCallStore.validId(playerId)) { "Invalid player" }
      val source = Uri.parse(uri)
      check(source.scheme == "file") { "Only downloaded app audio is allowed" }
      val file = File(source.path.orEmpty()).canonicalFile
      check(listOf(context.cacheDir, context.filesDir).any { file.path.startsWith(it.canonicalPath + File.separator) }) { "Audio must be in app storage" }
      check(file.isFile) { "Audio file is missing" }
      stopForCall(callId)
      val media = MediaPlayer()
      player = media
      val entry = Entry(callId, media, event) {
        if (!settled) { settled = true; promise.reject("CALL_AUDIO", "Call playback was cancelled") }
      }
      players[playerId] = entry
      media.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
      media.setDataSource(file.path)
      media.setOnPreparedListener { if (!settled) { settled = true; promise.resolve(true) } }
      media.setOnCompletionListener { event(true, false, null) }
      media.setOnErrorListener { _, _, _ ->
        if (!settled) { settled = true; promise.reject("CALL_AUDIO", "Could not load call audio") }
        else event(false, false, "Could not play call audio")
        release(playerId)
        true
      }
      media.prepareAsync()
    } catch (_: Exception) {
      players.remove(playerId)
      runCatching { player?.release() }
      if (!settled) { settled = true; promise.reject("CALL_AUDIO", "Could not load call audio") }
    }
  }

  fun play(id: String, promise: Promise) = CheckinTelecom.onMain {
    val entry = players[id]
    try {
      check(entry != null && CheckinTelecom.isActive(entry.callId)) { "Call is not active" }
      entry.player.start()
      entry.event(false, true, null)
      promise.resolve(true)
    } catch (_: Exception) { promise.reject("CALL_AUDIO", "Could not play call audio") }
  }
  fun pause(id: String, promise: Promise) = CheckinTelecom.onMain {
    runCatching { players[id]?.player?.let { if (it.isPlaying) it.pause() } }
    promise.resolve(true)
  }
  fun release(id: String) {
    val entry = players.remove(id) ?: return
    entry.cancelLoad()
    runCatching { entry.player.release() }
  }
  fun stopForCall(callId: String) { players.filterValues { it.callId == callId }.keys.toList().forEach { release(it) } }
  fun stopAll() = CheckinTelecom.onMain { players.keys.toList().forEach { release(it) } }
}
