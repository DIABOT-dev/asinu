package com.asinu.lite.notifications

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.ConnectionService
import android.telecom.DisconnectCause
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager

/** Exported solely to Android Telecom, protected by BIND_TELECOM_CONNECTION_SERVICE. */
class CheckinConnectionService : ConnectionService() {
  override fun onCreateIncomingConnection(account: PhoneAccountHandle?, request: ConnectionRequest): Connection {
    val id = request.extras?.getString(CheckinTelecom.ATTEMPT_ID).orEmpty()
    val call = if (account == CheckinTelecom.accountHandle(this)) CheckinCallStore.ringing(this, id) else null
    if (call == null) return Connection.createFailedConnection(DisconnectCause(DisconnectCause.CANCELED))
    val connection = CheckinTelecomConnection(applicationContext, id)
    if (!CheckinTelecom.attach(connection)) return Connection.createFailedConnection(DisconnectCause(DisconnectCause.CANCELED))
    connection.connectionProperties = Connection.PROPERTY_SELF_MANAGED
    connection.setAudioModeIsVoip(true)
    connection.setAddress(Uri.fromParts(PhoneAccount.SCHEME_SIP, "asinu", null), TelecomManager.PRESENTATION_ALLOWED)
    connection.setCallerDisplayName("Asinu", TelecomManager.PRESENTATION_ALLOWED)
    connection.setInitializing()
    connection.setRinging()
    connection.expireAt(call.optLong("expiresAt"))
    return connection
  }

  override fun onCreateIncomingConnectionFailed(account: PhoneAccountHandle?, request: ConnectionRequest) {
    CheckinTelecom.failed(this, request.extras?.getString(CheckinTelecom.ATTEMPT_ID).orEmpty())
  }

  // The reminder account must never initiate a carrier/SIP call from the dialer's call log.
  override fun onCreateOutgoingConnection(account: PhoneAccountHandle?, request: ConnectionRequest): Connection =
    Connection.createFailedConnection(DisconnectCause(DisconnectCause.ERROR))
}

class CheckinTelecomConnection(private val context: Context, val attemptId: String) : Connection() {
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable {
    val cause = if (state == STATE_RINGING) DisconnectCause.MISSED else DisconnectCause.REMOTE
    finish(cause)
    CheckinCallStore.end(context, attemptId)
  }
  private var finished = false

  fun expireAt(deadline: Long) {
    handler.removeCallbacks(timeout)
    handler.postDelayed(timeout, (deadline - System.currentTimeMillis()).coerceAtLeast(0))
  }

  override fun onShowIncomingCallUi() = CheckinTelecom.showIncomingUi(context, attemptId)
  override fun onSilence() = CheckinTelecom.silence(context, attemptId)
  override fun onAnswer() = accept(launchHandoff = true)
  fun accept(launchHandoff: Boolean) {
    if (finished || !CheckinCallStore.answer(context, attemptId)) return
    setActive()
    expireAt(CheckinCallStore.pending(context)!!.optLong("expiresAt"))
    if (!launchHandoff) return
    // Telecom's bound service can open this generic unlock handoff. Private health
    // content stays in MainActivity behind the secure keyguard and app session.
    try {
      context.startActivity(Intent(context, CheckinIncomingCallActivity::class.java).apply {
        action = CheckinTelecom.ANSWERED
        putExtra("attemptId", attemptId)
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
      })
    } catch (_: Exception) { CheckinCallStore.end(context, attemptId) }
  }
  override fun onAnswer(videoState: Int) = onAnswer()
  override fun onReject() {
    if (finished) return
    finish(DisconnectCause.REJECTED)
    CheckinCallDeclineReceiver.decline(context, attemptId)
  }
  override fun onReject(replyMessage: String?) = onReject()
  override fun onAbort() = onReject()
  override fun onDisconnect() {
    if (finished) return
    if (state == STATE_RINGING) { onReject(); return }
    finish(DisconnectCause.LOCAL)
    CheckinCallStore.end(context, attemptId, userDisconnected = true)
  }

  fun finish(cause: Int) {
    if (finished) return
    finished = true
    handler.removeCallbacks(timeout)
    CheckinTelecom.remove(this)
    CheckinCallAudioPlayer.stopForCall(attemptId)
    CheckinCallStore.cancelNotification(context, attemptId)
    setDisconnected(DisconnectCause(cause))
    destroy()
  }
}
