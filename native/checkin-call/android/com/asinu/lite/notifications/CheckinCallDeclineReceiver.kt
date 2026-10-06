package com.asinu.lite.notifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.work.Constraints
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OutOfQuotaPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf

/** Explicit, non-exported receiver; works without a React runtime/login refresh. */
class CheckinCallDeclineReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val id = intent.getStringExtra("attemptId").orEmpty()
    decline(context, id)
  }

  companion object {
    fun decline(context: Context, id: String) {
      val data = CheckinCallStore.ringing(context, id) ?: return
      CheckinCallStore.end(context, id) // stop sound/UI immediately, even offline
      val capability = data.optString("declineCapability")
      if (capability.isBlank()) return // old server: never substitute a login token
      val builder = OneTimeWorkRequestBuilder<CheckinCallDeclineWorker>()
        .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
        .setInputData(workDataOf("attemptId" to id, "capability" to capability, "expiresAt" to data.optLong("expiresAt") + 30_000))
      if (Build.VERSION.SDK_INT >= 31) builder.setExpedited(OutOfQuotaPolicy.RUN_AS_NON_EXPEDITED_WORK_REQUEST)
      val work = builder.build()
      WorkManager.getInstance(context).enqueueUniqueWork("checkin-decline:$id", ExistingWorkPolicy.KEEP, work)
    }
  }
}
