package com.asinu.lite.notifications

import android.app.Application
import android.app.NotificationManager
import android.content.Context
import android.os.Bundle
import android.os.Looper
import android.os.UserManager
import android.telecom.Connection
import android.telecom.ConnectionRequest
import android.telecom.DisconnectCause
import android.telecom.TelecomManager
import com.google.firebase.messaging.RemoteMessage
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.time.Instant
import java.time.Duration

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class, shadows = [CheckinNotificationManagerShadow::class, CheckinTelecomManagerShadow::class])
class CheckinTelecomTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()
  private val id = "bca2c9da-26fe-44a3-ac05-3f8dd75bc9e0"
  private val episode = "4b66cfc4-9091-4c89-a3ef-b19501207388"
  private val telecom get() = context.getSystemService(Context.TELECOM_SERVICE) as TelecomManager
  private fun call() = mapOf("type" to "checkin_call", "attemptId" to id, "episodeId" to episode,
    "kind" to "INCOMING_CALL", "lang" to "vi", "ringDeadline" to Instant.now().plusSeconds(60).toString())
  private fun receive(data: Map<String, String> = call()) = Robolectric.buildService(AsinuFirebaseMessagingService::class.java).get()
    .onMessageReceived(RemoteMessage.Builder("test").setData(data).build())
  private fun connection(): CheckinTelecomConnection {
    if (shadowOf(telecom).allIncomingCalls.isEmpty()) assertTrue(CheckinTelecom.showIncoming(context, id) {})
    val request = ConnectionRequest(CheckinTelecom.accountHandle(context), null, Bundle().apply { putString(CheckinTelecom.ATTEMPT_ID, id) })
    return Robolectric.buildService(CheckinConnectionService::class.java).get()
      .onCreateIncomingConnection(CheckinTelecom.accountHandle(context), request) as CheckinTelecomConnection
  }

  @Before fun reset() {
    CheckinCallStore.preferences(context).edit().clear().commit()
    shadowOf(RuntimeEnvironment.getApplication()).denyPermissions(android.Manifest.permission.READ_PHONE_NUMBERS)
    shadowOf(context.getSystemService(Context.USER_SERVICE) as UserManager).setUserUnlocked(true)
    shadowOf(telecom).setDefaultDialerPackage("com.android.dialer")
    assertTrue(CheckinTelecom.register(context))
  }
  @After fun clean() { CheckinTelecom.end(id); shadowOf(Looper.getMainLooper()).idle() }

  @Test fun brandedAccountMigratesLegacyAndNeedsNoPhoneNumberPermissionOrManualEnable() {
    val old = android.telecom.PhoneAccountHandle(android.content.ComponentName(context, CheckinConnectionService::class.java), "asinu-checkin")
    telecom.registerPhoneAccount(android.telecom.PhoneAccount.builder(old, "Asinu").setCapabilities(android.telecom.PhoneAccount.CAPABILITY_CALL_PROVIDER).build())
    assertTrue(CheckinTelecom.register(context))
    assertTrue(CheckinTelecom.enabled(context))
    assertNull(telecom.getPhoneAccount(old))
    val account = telecom.getPhoneAccount(CheckinTelecom.accountHandle(context))
    assertFalse(account.hasCapabilities(android.telecom.PhoneAccount.CAPABILITY_CALL_PROVIDER))
    assertTrue(account.hasCapabilities(android.telecom.PhoneAccount.CAPABILITY_SELF_MANAGED))
  }
  @Test fun telecomPublishesOneBrandedNotificationOnlyWhenItRequestsIncomingUi() {
    receive(); receive()
    assertEquals(1, shadowOf(telecom).allIncomingCalls.size)
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    assertTrue(shadowOf(manager).allNotifications.isEmpty())
    assertNull(CheckinCallStore.pending(context))
    val call = connection()
    assertEquals(Connection.STATE_RINGING, call.state)
    assertTrue(call.connectionProperties and Connection.PROPERTY_SELF_MANAGED != 0)
    call.onShowIncomingCallUi(); call.onShowIncomingCallUi()
    val notification = shadowOf(manager).allNotifications.single()
    assertEquals(2, notification.actions.size)
    assertNotNull(notification.fullScreenIntent)
    assertNotNull(notification.getLargeIcon())
    assertEquals("android.resource://${context.packageName}/raw/asinu_incoming", manager.getNotificationChannel(notification.channelId).sound.toString())
    call.onSilence()
    val quiet = shadowOf(manager).allNotifications.single()
    assertTrue(quiet.flags and android.app.Notification.FLAG_ONLY_ALERT_ONCE != 0)
    assertEquals(0, quiet.flags and android.app.Notification.FLAG_INSISTENT)
    assertEquals(2, quiet.actions.size)
    call.onAnswer()
    assertTrue(shadowOf(manager).allNotifications.isEmpty())
  }
  @Test fun silenceAndRemoteEndNeverRestartRinging() {
    receive(); val call = connection(); call.onShowIncomingCallUi(); call.onSilence()
    CheckinCallStore.end(context, id); receive()
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    assertTrue(shadowOf(manager).allNotifications.isEmpty())
    assertEquals(Connection.STATE_DISCONNECTED, call.state)
  }
  @Test fun serviceBindFailureFallsBackOnceAndRemoteEndSuppressesFallback() {
    receive()
    CheckinTelecom.failed(context, id); CheckinTelecom.failed(context, id)
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    assertEquals(1, shadowOf(manager).allNotifications.size)
    val request = ConnectionRequest(CheckinTelecom.accountHandle(context), null, Bundle().apply { putString(CheckinTelecom.ATTEMPT_ID, id) })
    val late = Robolectric.buildService(CheckinConnectionService::class.java).get()
      .onCreateIncomingConnection(CheckinTelecom.accountHandle(context), request)
    assertEquals(Connection.STATE_DISCONNECTED, late.state)
    CheckinCallStore.end(context, id)
    shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(9))
    assertTrue(shadowOf(manager).allNotifications.isEmpty())
  }
  @Test fun answerCreatesDurableHandoffThenConfirmationUpdatesActiveDeadline() {
    CheckinCallStore.incoming(context, call())
    val call = connection()
    call.onAnswer(); call.onAnswer()
    assertEquals(Connection.STATE_ACTIVE, call.state)
    assertEquals(id, CheckinCallStore.pending(context)!!.optString("attemptId"))
    val next = shadowOf(RuntimeEnvironment.getApplication()).nextStartedActivity
    assertEquals(CheckinTelecom.ANSWERED, next.action)
    assertEquals("com.asinu.lite.notifications.CheckinIncomingCallActivity", next.component!!.className)
    val deadline = Instant.now().plusSeconds(300).toString()
    assertTrue(CheckinCallStore.confirm(context, id, deadline))
    assertTrue(CheckinTelecom.isActive(id))
    assertEquals(CheckinCallStore.deadline(deadline), CheckinCallStore.pending(context)!!.optLong("expiresAt"))
  }
  @Test fun rejectAndActiveHangupClearStateWithoutConfirmingHealth() {
    CheckinCallStore.incoming(context, call())
    val call = connection()
    call.onReject()
    assertEquals(DisconnectCause.REJECTED, call.disconnectCause.code)
    assertNull(CheckinCallStore.pending(context))
    assertFalse(CheckinCallStore.incoming(context, call()))
  }
  @Test fun hangupAndRemoteEndDestroyActiveConnections() {
    CheckinCallStore.incoming(context, call())
    val call = connection(); call.onAnswer(); call.onDisconnect()
    assertEquals(Connection.STATE_DISCONNECTED, call.state)
    assertFalse(CheckinTelecom.isActive(id))
    assertNull(CheckinCallStore.pending(context))
  }
  @Test fun lateServiceBindingAfterRemoteEndCannotCreateCall() {
    CheckinCallStore.incoming(context, call()); CheckinCallStore.end(context, id)
    val request = ConnectionRequest(CheckinTelecom.accountHandle(context), null, Bundle().apply { putString(CheckinTelecom.ATTEMPT_ID, id) })
    val call = Robolectric.buildService(CheckinConnectionService::class.java).get()
      .onCreateIncomingConnection(CheckinTelecom.accountHandle(context), request)
    assertEquals(Connection.STATE_DISCONNECTED, call.state)
  }
  @Test fun expiredRingingDisconnectsAndDoesNotReplayOnDuplicatePush() {
    CheckinCallStore.incoming(context, call())
    val call = connection(); call.onShowIncomingCallUi()
    shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(61))
    assertEquals(DisconnectCause.MISSED, call.disconnectCause.code)
    assertFalse(CheckinCallStore.incoming(context, call()))
  }
}

/** Robolectric has not implemented Telecom's permission-free self-managed account query. */
@org.robolectric.annotation.Implements(TelecomManager::class)
class CheckinTelecomManagerShadow : org.robolectric.shadows.ShadowTelecomManager() {
  @org.robolectric.annotation.Implementation(minSdk = 26)
  protected fun getOwnSelfManagedPhoneAccounts(): List<android.telecom.PhoneAccountHandle> =
    allPhoneAccounts.filter { it.hasCapabilities(android.telecom.PhoneAccount.CAPABILITY_SELF_MANAGED) }.map { it.accountHandle }
}
