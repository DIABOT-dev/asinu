import { apiClient } from "../../lib/apiClient";
import { completeVoipCallAnswer } from "../../lib/voip";
import { useAuthStore } from "../auth/auth.store";
import { CheckinCallAcceptance } from "../checkin-call/checkin-call.handoff";
const acceptance = new CheckinCallAcceptance((id: string) =>
  apiClient<{ attempt: { deadline: string } }>(
    `/api/mobile/med-call-attempts/${encodeURIComponent(id)}/accept`,
    { method: "POST" },
  ),
);
export async function acceptMedicationCallOnce(id: string) {
  const token = useAuthStore.getState().token;
  try {
    const r = await acceptance.accept(id, token);
    if (useAuthStore.getState().token !== token)
      throw new Error("Session changed");
    await completeVoipCallAnswer(id, true, r.attempt.deadline);
    return r;
  } catch (e) {
    if (useAuthStore.getState().token === token)
      await completeVoipCallAnswer(id, false);
    throw e;
  }
}
