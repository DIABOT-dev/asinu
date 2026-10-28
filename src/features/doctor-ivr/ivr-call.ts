import { apiClient } from "../../lib/apiClient";
import { useAuthStore } from "../auth/auth.store";
import { CheckinCallAcceptance } from "../checkin-call/checkin-call.handoff";
import { completeVoipCallAnswer } from "../../lib/voip";
const acceptance = new CheckinCallAcceptance(async (id: string) => {
  const value = await apiClient<{
    data: { session_id: string; expires_at: string };
  }>(`/api/doctor/ivr/calls/${encodeURIComponent(id)}/action`, {
    method: "POST",
    body: { action: "accept" },
  });
  return value.data;
});
export async function endDoctorIvrCall(id: string) {
  if (!/^[\da-f-]{36}$/i.test(id)) return;
  await apiClient(`/api/doctor/ivr/calls/${encodeURIComponent(id)}/action`, {
    method: "POST",
    body: { action: "end" },
  });
}
export async function acceptDoctorIvrCallOnce(id: string) {
  const token = useAuthStore.getState().token;
  try {
    const value = await acceptance.accept(id, token);
    if (token !== useAuthStore.getState().token)
      throw new Error("Session changed");
    await completeVoipCallAnswer(id, true, value.expires_at);
    return value;
  } catch (e) {
    if (token === useAuthStore.getState().token)
      await completeVoipCallAnswer(id, false);
    throw e;
  }
}
