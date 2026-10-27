package com.asinu.lite.updates

import android.app.Activity
import android.content.Intent
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.play.core.appupdate.AppUpdateManager
import com.google.android.play.core.appupdate.AppUpdateManagerFactory
import com.google.android.play.core.appupdate.AppUpdateOptions
import com.google.android.play.core.install.InstallException
import com.google.android.play.core.install.InstallStateUpdatedListener
import com.google.android.play.core.install.model.AppUpdateType
import com.google.android.play.core.install.model.InstallStatus
import com.google.android.play.core.install.model.UpdateAvailability

/** Play owns the download, signing and installation; JS only displays Play's real state. */
class AsinuAppUpdateModule(context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  companion object { private const val UPDATE_REQUEST = 7643 }
  private val manager: AppUpdateManager = AppUpdateManagerFactory.create(context)
  private var pendingStart: Promise? = null
  private var versionCode = 0
  private var downloadedBytes = 0L
  private var totalBytes = 0L
  private var currentStatus = InstallStatus.UNKNOWN
  private var stateRevision = 0L

  private fun rememberVersion(version: Int) {
    if (version <= 0) return
    if (version < versionCode) return
    if (version != versionCode) { downloadedBytes = 0L; totalBytes = 0L; currentStatus = InstallStatus.UNKNOWN }
    versionCode = version
  }

  private fun statusName(status: Int) = when (status) {
    InstallStatus.PENDING -> "pending"
    InstallStatus.DOWNLOADING -> "downloading"
    InstallStatus.DOWNLOADED -> "downloaded"
    InstallStatus.INSTALLING -> "installing"
    InstallStatus.INSTALLED -> "installed"
    InstallStatus.CANCELED -> "cancelled"
    InstallStatus.FAILED -> "error"
    else -> "available"
  }

  private fun snapshot(status: Int = currentStatus, errorCode: Int = 0): WritableMap = Arguments.createMap().apply {
    putString("phase", statusName(status))
    putDouble("downloadedBytes", downloadedBytes.toDouble())
    putDouble("totalBytes", totalBytes.toDouble())
    if (versionCode > 0) putDouble("versionCode", versionCode.toDouble())
    if (errorCode != 0) putInt("errorCode", errorCode)
  }

  private fun emitState(status: Int, errorCode: Int = 0) {
    stateRevision += 1
    currentStatus = status
    if (!reactApplicationContext.hasActiveReactInstance()) return
    val emitter = reactApplicationContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
    emitter.emit("AsinuUpdateProgress", snapshot(status, errorCode))
    // Keep compatibility with builds/screens listening only for ready-to-install.
    if (status == InstallStatus.DOWNLOADED) emitter.emit("AsinuUpdateDownloaded", null)
  }

  private val listener = InstallStateUpdatedListener { state ->
    // Play only defines byte counts while DOWNLOADING. Retain the last real
    // counts for later states; never synthesize a percentage or a file size.
    if (state.installStatus() == InstallStatus.DOWNLOADING) {
      downloadedBytes = state.bytesDownloaded().coerceAtLeast(0L)
      totalBytes = state.totalBytesToDownload().coerceAtLeast(0L)
    }
    emitState(state.installStatus(), state.installErrorCode())
  }

  private val activityListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != UPDATE_REQUEST) return
      val promise = pendingStart ?: return
      pendingStart = null
      when (resultCode) {
        Activity.RESULT_OK -> {
          // A consent result is not a download progress event. Only show pending
          // if a later Play state hasn't already arrived while consent closed.
          if (currentStatus == InstallStatus.UNKNOWN || currentStatus == InstallStatus.CANCELED || currentStatus == InstallStatus.FAILED) {
            emitState(InstallStatus.PENDING)
          }
          promise.resolve("started")
        }
        Activity.RESULT_CANCELED -> {
          emitState(InstallStatus.CANCELED)
          promise.resolve("cancelled")
        }
        else -> {
          emitState(InstallStatus.FAILED, resultCode)
          promise.resolve("failed")
        }
      }
    }
  }

  override fun getName() = "AsinuAppUpdate"
  override fun initialize() {
    super.initialize()
    manager.registerListener(listener)
    reactApplicationContext.addActivityEventListener(activityListener)
  }
  override fun invalidate() {
    manager.unregisterListener(listener)
    reactApplicationContext.removeActivityEventListener(activityListener)
    pendingStart?.resolve("cancelled")
    pendingStart = null
    super.invalidate()
  }

  @ReactMethod
  fun check(promise: Promise) {
    val revision = stateRevision
    manager.appUpdateInfo.addOnSuccessListener { info ->
      val available = info.updateAvailability() == UpdateAvailability.UPDATE_AVAILABLE
      val inProgress = info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS
      val previousVersion = versionCode
      if (available || inProgress) rememberVersion(info.availableVersionCode())
      // Don't rewind a listener event with an older asynchronous query result.
      if (revision == stateRevision || previousVersion != versionCode) {
        currentStatus = info.installStatus()
        if (currentStatus == InstallStatus.DOWNLOADING) {
          downloadedBytes = info.bytesDownloaded().coerceAtLeast(0L)
          totalBytes = info.totalBytesToDownload().coerceAtLeast(0L)
        }
      }
      promise.resolve(snapshot().apply {
        putBoolean("available", available)
        putBoolean("downloaded", currentStatus == InstallStatus.DOWNLOADED)
        putBoolean("downloading", currentStatus == InstallStatus.DOWNLOADING || currentStatus == InstallStatus.PENDING)
        putBoolean("inProgress", inProgress)
      })
    }.addOnFailureListener { promise.reject("UPDATE_CHECK_FAILED", "Google Play update check unavailable") }
  }

  @ReactMethod
  fun start(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      if (pendingStart != null) { promise.resolve("busy"); return@runOnUiThread }
      pendingStart = promise
      val revision = stateRevision
      // AppUpdateInfo is single use; refresh before every user-initiated flow.
      manager.appUpdateInfo.addOnSuccessListener { info ->
        if (pendingStart !== promise) return@addOnSuccessListener
        val activity = reactApplicationContext.currentActivity
        if (activity == null || activity.isFinishing) {
          pendingStart = null; promise.resolve("unavailable"); return@addOnSuccessListener
        }
        val previousVersion = versionCode
        rememberVersion(info.availableVersionCode())
        val useSnapshot = revision == stateRevision || previousVersion != versionCode
        val status = if (useSnapshot) info.installStatus() else currentStatus
        if (status == InstallStatus.DOWNLOADED) {
          pendingStart = null; emitState(InstallStatus.DOWNLOADED); promise.resolve("downloaded"); return@addOnSuccessListener
        }
        if (status == InstallStatus.DOWNLOADING || status == InstallStatus.PENDING) {
          if (status == InstallStatus.DOWNLOADING && useSnapshot) {
            downloadedBytes = info.bytesDownloaded().coerceAtLeast(0L)
            totalBytes = info.totalBytesToDownload().coerceAtLeast(0L)
          }
          pendingStart = null; emitState(status); promise.resolve("started"); return@addOnSuccessListener
        }
        val type = when {
          info.updateAvailability() == UpdateAvailability.DEVELOPER_TRIGGERED_UPDATE_IN_PROGRESS -> AppUpdateType.IMMEDIATE
          info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE) -> AppUpdateType.FLEXIBLE
          info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE) -> AppUpdateType.IMMEDIATE
          else -> { pendingStart = null; promise.resolve("unavailable"); return@addOnSuccessListener }
        }
        try {
          @Suppress("DEPRECATION")
          val started = manager.startUpdateFlowForResult(info, activity, AppUpdateOptions.newBuilder(type).build(), UPDATE_REQUEST)
          if (!started) { pendingStart = null; promise.resolve("unavailable") }
          // The activity result settles the promise, including cancel/failure,
          // so JS's native presenter stays busy until consent actually closes.
        } catch (_: Exception) { pendingStart = null; promise.resolve("unavailable") }
      }.addOnFailureListener {
        if (pendingStart === promise) { pendingStart = null; promise.resolve("unavailable") }
      }
    }
  }

  @ReactMethod
  fun complete(promise: Promise) {
    manager.appUpdateInfo.addOnSuccessListener { info ->
      if (info.installStatus() != InstallStatus.DOWNLOADED) { promise.resolve(false); return@addOnSuccessListener }
      manager.completeUpdate().addOnSuccessListener { promise.resolve(true) }
        .addOnFailureListener { error ->
          emitState(InstallStatus.FAILED, (error as? InstallException)?.errorCode ?: 0)
          promise.reject("UPDATE_INSTALL_FAILED", "Google Play could not install update")
        }
    }.addOnFailureListener { promise.resolve(false) }
  }

  @ReactMethod fun addListener(eventName: String) { /* NativeEventEmitter contract. */ }
  @ReactMethod fun removeListeners(count: Int) { /* NativeEventEmitter contract. */ }
}
