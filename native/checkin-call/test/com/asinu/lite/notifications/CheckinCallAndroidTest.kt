package com.asinu.lite.notifications

import android.app.Application
import android.app.KeyguardManager
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.UserManager
import android.os.Build
import android.net.Uri
import android.media.AudioAttributes
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.ScrollView
import androidx.work.Configuration
import androidx.work.WorkManager
import androidx.work.testing.SynchronousExecutor
import androidx.work.testing.WorkManagerTestInitHelper
import androidx.work.ListenableWorker
import androidx.work.testing.TestListenableWorkerBuilder
import androidx.work.workDataOf
import com.google.firebase.messaging.RemoteMessage
import okhttp3.mockwebserver.MockWebServer
import okhttp3.mockwebserver.MockResponse
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import org.robolectric.annotation.Implementation
import org.robolectric.annotation.Implements
import org.robolectric.shadows.ShadowNotificationManager
import java.time.Instant
import java.util.concurrent.TimeUnit

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class, shadows = [CheckinNotificationManagerShadow::class])
class CheckinCallAndroidTest {
  private val context: Context get() = RuntimeEnvironment.getApplication()
  private val id = "bca2c9da-26fe-44a3-ac05-3f8dd75bc9e0"
  private val episode = "4b66cfc4-9091-4c89-a3ef-b19501207388"
  private fun call() = mapOf("type" to "checkin_call", "attemptId" to id, "episodeId" to episode,
    "kind" to "INCOMING_CALL", "lang" to "vi", "ringDeadline" to Instant.now().plusSeconds(60).toString())

  @Before fun reset() {
    CheckinNotificationManagerShadow.fullScreen = true
    CheckinCallStore.preferences(context).edit().clear().commit()
    (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancelAll()
    shadowOf(context.getSystemService(Context.USER_SERVICE) as UserManager).setUserUnlocked(true)
  }

  @Test fun validIncomingIsDurableAndDuplicateDoesNotRestartRinging() {
    assertTrue(CheckinCallStore.incoming(context, call()))
    val first = CheckinCallStore.ringing(context, id)!!.optLong("expiresAt")
    assertFalse(CheckinCallStore.incoming(context, call()))
    assertEquals(first, CheckinCallStore.ringing(context, id)!!.optLong("expiresAt"))
  }
  @Test fun delayedOrMalformedPushDoesNotShowCall() {
    assertFalse(CheckinCallStore.incoming(context, call() + ("ringDeadline" to Instant.now().minusSeconds(1).toString())))
    assertFalse(CheckinCallStore.incoming(context, call() + ("attemptId" to "bad")))
    assertFalse(CheckinCallStore.incoming(context, call() + ("ringDeadline" to "bad")))
    assertNull(CheckinCallStore.pending(context))
  }
  @Test fun remoteEndBeforeIncomingSuppressesDelayedDelivery() {
    CheckinCallStore.end(context, id)
    assertFalse(CheckinCallStore.incoming(context, call()))
    assertNull(CheckinCallStore.ringing(context, id))
  }
  @Test fun merelyViewingIncomingIsNotAcceptance() {
    CheckinCallStore.incoming(context, call())
    val controller = Robolectric.buildActivity(CheckinIncomingCallActivity::class.java,
      Intent(context, CheckinIncomingCallActivity::class.java).putExtra("attemptId", id)).create().start().resume()
    assertNull(CheckinCallStore.pending(context))
    assertNotNull(CheckinCallStore.ringing(context, id))
    controller.pause().stop().destroy()
  }
  @Test @Config(qualifiers = "w320dp-h640dp") fun largeTextOnSmallScreenKeepsBothActionsInsideScrollableLayout() {
    val resources = context.resources
    val configuration = android.content.res.Configuration(resources.configuration).apply { fontScale = 2f }
    @Suppress("DEPRECATION") resources.updateConfiguration(configuration, resources.displayMetrics)
    CheckinCallStore.incoming(context, call())
    val controller = Robolectric.buildActivity(CheckinIncomingCallActivity::class.java,
      Intent(context, CheckinIncomingCallActivity::class.java).putExtra("attemptId", id)).create().start().resume().visible()
    val activity = controller.get()
    val width = (320 * resources.displayMetrics.density).toInt()
    val height = (640 * resources.displayMetrics.density).toInt()
    val decor = activity.window.decorView
    decor.measure(View.MeasureSpec.makeMeasureSpec(width, View.MeasureSpec.EXACTLY), View.MeasureSpec.makeMeasureSpec(height, View.MeasureSpec.EXACTLY))
    decor.layout(0, 0, width, height)
    val content = activity.findViewById<ViewGroup>(android.R.id.content)
    val scroll = content.getChildAt(0) as ScrollView
    val layout = scroll.getChildAt(0) as ViewGroup
    val buttons = (0 until layout.childCount).map { layout.getChildAt(it) }.filterIsInstance<Button>()
    assertEquals(2, buttons.size)
    buttons.forEach { button ->
      assertTrue(button.measuredHeight >= 48 * resources.displayMetrics.density)
      assertTrue(button.left >= 0 && button.right <= layout.measuredWidth)
      assertTrue(button.text.isNotBlank())
    }
    assertTrue(layout.measuredHeight >= scroll.measuredHeight)
    controller.pause().stop().destroy()
  }
  @Test fun answerCreatesOneNonDestructiveAuthenticatedHandoff() {
    CheckinCallStore.incoming(context, call())
    assertTrue(CheckinCallStore.answer(context, id))
    assertFalse(CheckinCallStore.answer(context, id))
    assertFalse(CheckinCallStore.incoming(context, call()))
    assertEquals(id, CheckinCallStore.pending(context)!!.optString("attemptId"))
    assertEquals(id, CheckinCallStore.pending(context)!!.optString("attemptId"))
    assertNull(CheckinCallStore.ringing(context, id))
  }
  @Test fun notificationAnswerOpensMainActivityWithoutDeepLinkAuthRace() {
    CheckinCallStore.incoming(context, call())
    shadowOf(context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager).setKeyguardLocked(false)
    val controller = Robolectric.buildActivity(CheckinIncomingCallActivity::class.java,
      Intent(context, CheckinIncomingCallActivity::class.java).setAction(CheckinCallStore.ANSWER).putExtra("attemptId", id)).create()
    val started = shadowOf(RuntimeEnvironment.getApplication()).nextStartedActivity
    assertEquals("com.asinu.lite.MainActivity", started.component!!.className)
    assertNull(started.data) // route owned by SessionProvider after session hydration
    assertEquals(id, CheckinCallStore.pending(context)!!.optString("attemptId"))
    controller.destroy()
  }
  @Test fun endingDifferentAttemptCannotClearCurrentHandoff() {
    CheckinCallStore.incoming(context, call()); CheckinCallStore.answer(context, id)
    CheckinCallStore.end(context, "bca2c9da-26fe-44a3-ac05-3f8dd75bc9e1")
    assertNotNull(CheckinCallStore.pending(context))
    CheckinCallStore.end(context, id)
    assertNull(CheckinCallStore.pending(context))
    assertFalse(CheckinCallStore.incoming(context, call()))
  }
  @Test fun confirmedDeadlinePersistsButCannotConfirmAnotherAttempt() {
    CheckinCallStore.incoming(context, call()); CheckinCallStore.answer(context, id)
    val end = Instant.now().plusSeconds(300).toString()
    assertTrue(CheckinCallStore.confirm(context, id, end))
    assertEquals(CheckinCallStore.deadline(end), CheckinCallStore.pending(context)!!.optLong("expiresAt"))
    assertFalse(CheckinCallStore.confirm(context, episode, end))
  }
  @Test fun appAcceptanceClosesNativeRingingButAudioOwnershipCannotAutoAccept() {
    CheckinCallStore.incoming(context, call() + ("declineCapability" to "scoped-secret"))
    val deadline = Instant.now().plusSeconds(300).toString()
    assertFalse(CheckinCallStore.confirm(context, id, deadline))
    assertNotNull(CheckinCallStore.ringing(context, id))
    assertNull(CheckinCallStore.pending(context))
    assertTrue(CheckinCallStore.confirm(context, id, deadline, promoteRinging = true))
    assertNull(CheckinCallStore.ringing(context, id))
    assertFalse(CheckinCallStore.pending(context)!!.has("declineCapability"))
    assertFalse(CheckinCallStore.incoming(context, call()))
  }
  @Test fun tombstoneStorageIsBounded() {
    for (index in 1..140) CheckinCallStore.end(context, "bca2c9da-26fe-44a3-ac05-${index.toString().padStart(12, '0')}")
    assertTrue(CheckinCallStore.preferences(context).all.keys.count { it.startsWith("done:") } <= 128)
  }
  @Test @Config(sdk = [24, 31, 34, 35]) fun fcmNotificationHasTwoActionsAndNativeActivityNotWholeApp() {
    val service = Robolectric.buildService(AsinuFirebaseMessagingService::class.java).get()
    service.onMessageReceived(RemoteMessage.Builder("test").setData(call()).build())
    val notification = shadowOf(context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).allNotifications.single()
    assertEquals(2, notification.actions.size)
    assertEquals("call", notification.category)
    if (Build.VERSION.SDK_INT >= 26) assertTrue(notification.timeoutAfter in 1..60_000)
    val answerIntent = shadowOf(notification.actions.last().actionIntent).savedIntent
    assertEquals(CheckinIncomingCallActivity::class.java.name, answerIntent.component!!.className)
    assertEquals(CheckinCallStore.ANSWER, answerIntent.action)
    val declineIntent = shadowOf(notification.actions.first().actionIntent).savedIntent
    assertEquals(CheckinCallDeclineReceiver::class.java.name, declineIntent.component!!.className)
    service.onMessageReceived(RemoteMessage.Builder("test").setData(call() + ("kind" to "END_CALL")).build())
    assertTrue(shadowOf(context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).allNotifications.isEmpty())
  }
  @Test @Config(sdk = [24, 34]) fun incomingRingtonesMatchIosForNormalUrgentAndRepeatDeliveries() {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val service = Robolectric.buildService(AsinuFirebaseMessagingService::class.java).get()
    for (kind in listOf("INCOMING_CALL", "URGENT_REPEAT")) {
      for (severity in listOf("", "NONE", "MILD", "URGENT", "urgent")) {
        reset()
        val payload = call() + ("kind" to kind) + if (severity.isEmpty()) emptyMap() else mapOf("severity" to severity)
        service.onMessageReceived(RemoteMessage.Builder("test").setData(payload).build())
        val notification = shadowOf(manager).allNotifications.single()
        // The existing iOS CallKit ringtone is selected by severity alone.
        val resource = if (severity.equals("URGENT", ignoreCase = true)) "asinu_emergency" else "asinu_incoming"
        val expected = Uri.parse("android.resource://${context.packageName}/raw/$resource")
        assertEquals("$kind/$severity", expected, notification.sound)
        assertTrue(notification.flags and android.app.Notification.FLAG_INSISTENT != 0)
        if (Build.VERSION.SDK_INT >= 26) {
          val channel = manager.getNotificationChannel(notification.channelId)
          assertEquals("$kind/$severity channel", expected, channel.sound)
          assertEquals(AudioAttributes.USAGE_NOTIFICATION_RINGTONE, channel.audioAttributes.usage)
        }
        service.onMessageReceived(RemoteMessage.Builder("test").setData(payload + ("kind" to "END_CALL")).build())
        assertTrue(shadowOf(manager).allNotifications.isEmpty())
      }
    }
  }
  @Test fun checkinNoticesKeepTheMatchingIosNotificationSounds() {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val service = Robolectric.buildService(AsinuFirebaseMessagingService::class.java).get()
    val scenarios = listOf(
      Triple("FALLBACK", "NONE", "asinu_missed"),
      Triple("MISSED_CALL", "NONE", "asinu_missed"),
      Triple("FALLBACK", "URGENT", "asinu_emergency"),
    )
    for ((kind, severity, resource) in scenarios) {
      reset()
      service.onMessageReceived(RemoteMessage.Builder("test").setData(call() + mapOf("kind" to kind, "severity" to severity)).build())
      val notification = shadowOf(manager).allNotifications.single()
      val channel = manager.getNotificationChannel(notification.channelId)
      val expected = Uri.parse("android.resource://${context.packageName}/raw/$resource")
      assertEquals("$kind/$severity", expected, channel.sound)
      assertEquals(AudioAttributes.USAGE_NOTIFICATION, channel.audioAttributes.usage)
      assertEquals(0, notification.flags and android.app.Notification.FLAG_INSISTENT)
    }
  }
  @Test fun noFullScreenPermissionStillKeepsAnswerDeclineNotification() {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    CheckinNotificationManagerShadow.fullScreen = false
    Robolectric.buildService(AsinuFirebaseMessagingService::class.java).get()
      .onMessageReceived(RemoteMessage.Builder("test").setData(call()).build())
    val notification = shadowOf(manager).allNotifications.single()
    assertNull(notification.fullScreenIntent)
    assertEquals(2, notification.actions.size)
  }
  @Test fun declineActionCancelsImmediatelyAndEnqueuesOnlyOneScopedNetworkRequest() {
    val server = MockWebServer()
    server.enqueue(MockResponse().setResponseCode(200)); server.start()
    try {
      CheckinCallStore.preferences(context).edit().putString("apiBaseUrl", server.url("/").toString().trimEnd('/')).commit()
      WorkManagerTestInitHelper.initializeTestWorkManager(context, Configuration.Builder().setExecutor(SynchronousExecutor()).build())
      CheckinCallStore.incoming(context, call() + ("declineCapability" to "short-scoped-token"))
      CheckinCallDeclineReceiver().onReceive(context, Intent().putExtra("attemptId", id))
      assertNull(CheckinCallStore.ringing(context, id))
      assertNull(CheckinCallStore.pending(context))
      assertFalse(CheckinCallStore.incoming(context, call()))
      val manager = WorkManager.getInstance(context)
      val jobs = manager.getWorkInfosForUniqueWork("checkin-decline:$id").get()
      assertEquals(1, jobs.size)
      WorkManagerTestInitHelper.getTestDriver(context)!!.setAllConstraintsMet(jobs.single().id)
      val request = server.takeRequest(3, TimeUnit.SECONDS)
      assertNotNull(request)
      assertEquals("short-scoped-token", JSONObject(request!!.body.readUtf8()).getString("capability"))
      CheckinCallDeclineReceiver().onReceive(context, Intent().putExtra("attemptId", id))
      assertEquals(1, manager.getWorkInfosForUniqueWork("checkin-decline:$id").get().size)
      assertEquals(1, server.requestCount)
    } finally { server.shutdown() }
  }
  private fun worker(capability: String = "short-scoped-token", expiresAt: Long = System.currentTimeMillis() + 60_000): CheckinCallDeclineWorker =
    TestListenableWorkerBuilder.from(context, CheckinCallDeclineWorker::class.java)
      .setInputData(workDataOf("attemptId" to id, "capability" to capability, "expiresAt" to expiresAt)).build()

  @Test fun expiredDeclineDoesNotRetryOrMakeNetworkRequests() {
    assertEquals(ListenableWorker.Result.success(), worker(expiresAt = 1).doWork())
  }
  @Test fun declineUsesOnlyScopedCapabilityAndNeverSendsAuthorizationOrFollowsRedirects() {
    val server = MockWebServer()
    server.enqueue(MockResponse().setResponseCode(200))
    server.enqueue(MockResponse().setResponseCode(302).setHeader("Location", "/should-not-leak"))
    server.enqueue(MockResponse().setResponseCode(503))
    server.start()
    try {
      CheckinCallStore.preferences(context).edit().putString("apiBaseUrl", server.url("/").toString().trimEnd('/')).commit()
      assertEquals(ListenableWorker.Result.success(), worker().doWork())
      val request = server.takeRequest()
      assertNull(request.getHeader("Authorization"))
      assertEquals("/api/mobile/checkin-call/native/attempts/$id/decline", request.path)
      assertEquals("short-scoped-token", JSONObject(request.body.readUtf8()).getString("capability"))
      assertEquals(ListenableWorker.Result.failure(), worker().doWork())
      assertEquals(2, server.requestCount)
      assertEquals(ListenableWorker.Result.retry(), worker().doWork())
    } finally { server.shutdown() }
  }
}

/** Robolectric 4.16 does not implement Android 14 special-access checks yet. */
@Implements(NotificationManager::class)
class CheckinNotificationManagerShadow : ShadowNotificationManager() {
  companion object { var fullScreen = true }
  @Implementation(minSdk = 34) protected fun canUseFullScreenIntent() = fullScreen
}
