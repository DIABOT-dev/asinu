package com.asinu.lite.notifications

import android.app.Activity
import android.app.Application
import android.provider.Settings
import com.facebook.react.bridge.BridgeReactContext
import com.facebook.react.bridge.Promise
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.RuntimeEnvironment
import org.robolectric.Shadows.shadowOf
import org.robolectric.annotation.Config
import java.lang.reflect.Proxy

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34], application = Application::class)
class CheckinPermissionSettingsTest {
  private class Decision {
    val values = mutableListOf<Any?>()
    val promise = Proxy.newProxyInstance(Promise::class.java.classLoader, arrayOf(Promise::class.java)) { _, method, args ->
      when (method.name) {
        "resolve" -> values.add(args?.firstOrNull())
        "reject" -> fail("Unexpected permission rejection")
      }
      null
    } as Promise
  }

  @Test fun fullScreenSettingsResolveOnlyAfterReturningAndIgnoreUnrelatedResults() {
    val controller = Robolectric.buildActivity(Activity::class.java).setup()
    val activity = controller.get()
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())
    context.onHostResume(activity)
    val module = AsinuCheckinCallModule(context)
    module.initialize()
    val first = Decision()
    module.openCallSettings(true, first.promise)
    val started = shadowOf(activity).nextStartedActivityForResult
    assertEquals(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, started.intent.action)
    assertEquals("package:${context.packageName}", started.intent.data.toString())
    assertTrue(first.values.isEmpty())
    context.onActivityResult(activity, started.requestCode + 1, Activity.RESULT_CANCELED, null)
    assertTrue(first.values.isEmpty())
    val duplicate = Decision()
    module.openCallSettings(true, duplicate.promise)
    assertEquals(listOf(false), duplicate.values)
    assertNull(shadowOf(activity).nextStartedActivityForResult)
    context.onActivityResult(activity, started.requestCode, Activity.RESULT_CANCELED, null)
    context.onActivityResult(activity, started.requestCode, Activity.RESULT_OK, null)
    assertEquals(listOf(true), first.values)
    module.invalidate()
    controller.pause().stop().destroy()
  }

  @Test fun notificationSettingsAlsoWaitForActivityResultAndInvalidateReleasesPendingWork() {
    val controller = Robolectric.buildActivity(Activity::class.java).setup()
    val activity = controller.get()
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())
    context.onHostResume(activity)
    val module = AsinuCheckinCallModule(context)
    module.initialize()
    val decision = Decision()
    module.openCallSettings(false, decision.promise)
    val started = shadowOf(activity).nextStartedActivityForResult
    assertEquals(Settings.ACTION_APP_NOTIFICATION_SETTINGS, started.intent.action)
    assertEquals(context.packageName, started.intent.getStringExtra(Settings.EXTRA_APP_PACKAGE))
    assertTrue(decision.values.isEmpty())
    module.invalidate()
    assertEquals(listOf(false), decision.values)
    context.onActivityResult(activity, started.requestCode, Activity.RESULT_OK, null)
    assertEquals(listOf(false), decision.values)
    controller.pause().stop().destroy()
  }

  @Test fun missingForegroundActivityDoesNotLaunchSettingsOrRetainAPromise() {
    val context = BridgeReactContext(RuntimeEnvironment.getApplication())
    val module = AsinuCheckinCallModule(context)
    module.initialize()
    val decision = Decision()
    module.openCallSettings(true, decision.promise)
    assertEquals(listOf(false), decision.values)
    assertNull(shadowOf(RuntimeEnvironment.getApplication()).nextStartedActivity)
    module.invalidate()
  }
}
