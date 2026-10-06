package com.asinu.lite.notifications

import android.app.Activity
import android.app.KeyguardManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.asinu.lite.MainActivity
import com.asinu.lite.R
import java.util.Locale

/** Only a generic incoming-call screen is exposed over the keyguard, not health data. */
class CheckinIncomingCallActivity : Activity() {
  private var attemptId = ""
  private var answering = false
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { CheckinCallStore.end(this, attemptId); finish() }
  private val updates = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      if (!answering && CheckinCallStore.ringing(this@CheckinIncomingCallActivity, attemptId) == null) finish()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    attemptId = intent.getStringExtra("attemptId").orEmpty()
    val call = CheckinCallStore.ringing(this, attemptId) ?: run { finish(); return }
    if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
    else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    ContextCompat.registerReceiver(this, updates, IntentFilter(CheckinCallStore.CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED)
    handler.postDelayed(timeout, (call.optLong("expiresAt") - System.currentTimeMillis()).coerceAtLeast(0))
    val configuration = resources.configuration.let { android.content.res.Configuration(it) }
    configuration.setLocale(Locale(if (call.optString("lang") == "en") "en" else "vi"))
    val localized = createConfigurationContext(configuration)
    fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    val scroll = ScrollView(this).apply { setBackgroundColor(Color.rgb(239, 251, 249)); isFillViewport = true }
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER
      setPadding(dp(28), dp(48), dp(28), dp(48))
    }
    fun label(text: String, size: Float, bold: Boolean) = TextView(this).apply {
      this.text = text; textSize = size; gravity = Gravity.CENTER
      setTextColor(Color.rgb(15, 62, 54)); setPadding(0, dp(12), 0, dp(12))
      if (bold) setTypeface(typeface, Typeface.BOLD)
    }
    content.addView(label("Asinu", 32f, true))
    content.addView(label(localized.getString(R.string.checkin_call_title), 26f, true))
    content.addView(label(localized.getString(R.string.checkin_call_answer_hint), 18f, false))
    fun button(title: String, color: Int, action: () -> Unit) {
      val view = Button(this).apply {
        text = title; textSize = 20f; isAllCaps = false; minHeight = dp(64)
        setTextColor(Color.WHITE)
        background = GradientDrawable().apply { setColor(color); cornerRadius = dp(24).toFloat() }
        setPadding(dp(16), dp(12), dp(16), dp(12))
        setOnClickListener { action() }
      }
      content.addView(view, LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(20) })
    }
    button(localized.getString(R.string.checkin_call_answer), Color.rgb(8, 132, 109)) { answer() }
    button(localized.getString(R.string.checkin_call_decline), Color.rgb(190, 55, 64)) { CheckinCallDeclineReceiver.decline(this, attemptId); finish() }
    content.addView(label(localized.getString(R.string.checkin_call_privacy), 16f, false))
    scroll.addView(content); setContentView(scroll)
    // Respect cutouts/system bars and very large text; never clip the action buttons.
    scroll.setOnApplyWindowInsetsListener { view, insets ->
      @Suppress("DEPRECATION")
      view.setPadding(0, insets.systemWindowInsetTop, 0, insets.systemWindowInsetBottom)
      insets
    }
    if (intent.action == CheckinCallStore.ANSWER) answer()
  }

  private fun answer() {
    if (answering || CheckinCallStore.ringing(this, attemptId) == null) return
    answering = true
    val keyguard = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (Build.VERSION.SDK_INT >= 26 && keyguard.isKeyguardLocked) {
      keyguard.requestDismissKeyguard(this, object : KeyguardManager.KeyguardDismissCallback() {
        override fun onDismissSucceeded() { openApp() }
        override fun onDismissCancelled() { answering = false }
        override fun onDismissError() { answering = false }
      })
    } else openApp() // pre-26: normal MainActivity remains behind the secure keyguard
  }

  private fun openApp() {
    if (!CheckinCallStore.answer(this, attemptId)) { finish(); return }
    // Native pending state survives process startup; SessionProvider routes only after auth hydrates.
    startActivity(Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    })
    finish()
  }

  override fun onDestroy() {
    handler.removeCallbacks(timeout)
    runCatching { unregisterReceiver(updates) }
    super.onDestroy()
  }
}
