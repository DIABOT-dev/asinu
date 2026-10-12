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
import android.widget.ImageView
import android.content.res.ColorStateList
import android.graphics.drawable.RippleDrawable
import android.view.KeyEvent
import android.view.View
import androidx.core.view.WindowCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.content.ContextCompat
import com.asinu.lite.MainActivity
import com.asinu.lite.R
import java.util.Locale

/** Only a generic incoming-call screen is exposed over the keyguard, not health data. */
class CheckinIncomingCallActivity : Activity() {
  private var attemptId = ""
  private var answering = false
  private var telecomAnswered = false
  private var showAnsweredUi: (() -> Unit)? = null
  private val handler = Handler(Looper.getMainLooper())
  private val timeout = Runnable { CheckinCallStore.end(this, attemptId); finish() }
  private val updates = object : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
      val activity = this@CheckinIncomingCallActivity
      if (CheckinCallStore.ringing(activity, attemptId) == null &&
        CheckinCallStore.pending(activity)?.optString("attemptId") != attemptId) finish()
    }
  }

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    attemptId = intent.getStringExtra("attemptId").orEmpty()
    telecomAnswered = intent.action == CheckinTelecom.ANSWERED
    val call = (if (telecomAnswered) CheckinCallStore.pending(this)?.takeIf { it.optString("attemptId") == attemptId }
      else CheckinCallStore.ringing(this, attemptId)) ?: run { finish(); return }
    if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
    else @Suppress("DEPRECATION") window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    // Waking once is not enough: a short device screen timeout can otherwise
    // leave an unanswered call ringing on a black screen. This window-scoped
    // flag only keeps the visible incoming screen awake, never a background app.
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    ContextCompat.registerReceiver(this, updates, IntentFilter(CheckinCallStore.CHANGED), ContextCompat.RECEIVER_NOT_EXPORTED)
    handler.postDelayed(timeout, (call.optLong("expiresAt") - System.currentTimeMillis()).coerceAtLeast(0))
    val configuration = resources.configuration.let { android.content.res.Configuration(it) }
    configuration.setLocale(Locale(if (call.optString("lang") == "en") "en" else "vi"))
    val localized = createConfigurationContext(configuration)
    fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    // One calm lock-screen scene: Asinu logo/name above familiar call controls.
    // No symptoms, profile, or health information is exposed before unlocking.
    val ink = Color.WHITE
    val muted = Color.rgb(191, 216, 211)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    WindowCompat.getInsetsController(window, window.decorView).apply {
      isAppearanceLightStatusBars = false; isAppearanceLightNavigationBars = false
    }
    val scroll = ScrollView(this).apply { setBackgroundColor(Color.rgb(15, 46, 43)); isFillViewport = true }
    val content = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL
      setPadding(dp(24), dp(32), dp(24), dp(28))
    }
    fun label(text: String, size: Float, bold: Boolean = false) = TextView(this).apply {
      this.text = text; textSize = size; gravity = Gravity.CENTER
      setTextColor(if (bold) ink else muted); setPadding(0, dp(8), 0, dp(8))
      if (bold) setTypeface(typeface, Typeface.BOLD)
    }
    content.addView(label(localized.getString(R.string.checkin_call_internet), 15f))
    content.addView(View(this), LinearLayout.LayoutParams(1, dp(20)))
    content.addView(ImageView(this).apply {
      setImageResource(R.mipmap.ic_launcher); scaleType = ImageView.ScaleType.FIT_CENTER
      contentDescription = "Asinu"; importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO
    }, LinearLayout.LayoutParams(dp(136), dp(136)))
    content.addView(label("Asinu", 36f, true), LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(20) })
    content.addView(label(localized.getString(R.string.checkin_call_title), 20f))
    content.addView(View(this), LinearLayout.LayoutParams(1, dp(48), 1f))
    val hint = label(localized.getString(if (telecomAnswered) R.string.checkin_call_unlock_hint else R.string.checkin_call_answer_hint), 16f)
    content.addView(hint)
    content.addView(View(this), LinearLayout.LayoutParams(1, dp(32)))
    val controls = LinearLayout(this).apply { gravity = Gravity.CENTER; orientation = LinearLayout.HORIZONTAL }
    fun callButton(title: String, color: Int, icon: Int, action: () -> Unit): Pair<Button, TextView> {
      val column = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER_HORIZONTAL }
      val view = Button(this).apply {
        contentDescription = title; minHeight = dp(80); minWidth = dp(80)
        background = RippleDrawable(ColorStateList.valueOf(0x44FFFFFF), GradientDrawable().apply {
          shape = GradientDrawable.OVAL; setColor(color)
        }, null)
        setCompoundDrawablesWithIntrinsicBounds(0, icon, 0, 0)
        compoundDrawableTintList = ColorStateList.valueOf(Color.WHITE)
        setPadding(dp(24), dp(24), dp(24), dp(24))
        setOnClickListener { action() }
      }
      column.addView(view, LinearLayout.LayoutParams(dp(80), dp(80)))
      val caption = label(title, 18f, true).apply { importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_NO }
      column.addView(caption,
        LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(10) })
      controls.addView(column, LinearLayout.LayoutParams(0, -2, 1f))
      return view to caption
    }
    val end = callButton(localized.getString(if (telecomAnswered) R.string.checkin_call_end else R.string.checkin_call_decline), Color.rgb(205, 47, 64), R.drawable.asinu_call_decline) {
      if (telecomAnswered) CheckinCallStore.end(this, attemptId, userDisconnected = true)
      else CheckinCallDeclineReceiver.decline(this, attemptId)
      finish()
    }
    val open = callButton(localized.getString(if (telecomAnswered) R.string.checkin_call_open else R.string.checkin_call_answer), Color.rgb(8, 132, 109), R.drawable.asinu_call_answer) { answer() }
    showAnsweredUi = {
      // Keep the answered state clear if the user cancels the PIN dialog.
      hint.text = localized.getString(R.string.checkin_call_unlock_hint)
      end.first.contentDescription = localized.getString(R.string.checkin_call_end)
      end.second.text = end.first.contentDescription
      open.first.contentDescription = localized.getString(R.string.checkin_call_open)
      open.second.text = open.first.contentDescription
    }
    content.addView(controls, LinearLayout.LayoutParams(-1, -2))
    content.addView(label(localized.getString(R.string.checkin_call_privacy), 13f), LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(26) })
    scroll.addView(content); setContentView(scroll)
    ViewCompat.setOnApplyWindowInsetsListener(scroll) { view, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
      insets
    }
    ViewCompat.requestApplyInsets(scroll)
    if (intent.action == CheckinCallStore.ANSWER || telecomAnswered) answer()
  }

  private fun answer() {
    if (answering || (if (telecomAnswered) CheckinCallStore.pending(this)?.takeIf { it.optString("attemptId") == attemptId }
      else CheckinCallStore.ringing(this, attemptId)) == null) return
    answering = true
    // A tap answers immediately and stops ringing even while PIN entry is open.
    if (!telecomAnswered) {
      if (!CheckinTelecom.answerFromUi(this, attemptId)) { answering = false; finish(); return }
      telecomAnswered = true
      showAnsweredUi?.invoke()
    }
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
    if (!telecomAnswered && !CheckinCallStore.answer(this, attemptId)) { finish(); return }
    if (telecomAnswered && CheckinCallStore.pending(this)?.optString("attemptId") != attemptId) { finish(); return }
    // Native pending state survives process startup; SessionProvider routes only after auth hydrates.
    startActivity(Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
    })
    finish()
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    if (keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP) {
      CheckinTelecom.silence(this, attemptId)
      return true
    }
    return super.onKeyDown(keyCode, event)
  }

  override fun onDestroy() {
    handler.removeCallbacks(timeout)
    showAnsweredUi = null
    window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    runCatching { unregisterReceiver(updates) }
    super.onDestroy()
  }
}
