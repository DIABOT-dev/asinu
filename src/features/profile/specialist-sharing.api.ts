import { randomUUID } from "expo-crypto";
import { isDoctorFeaturesEnabled } from "../../lib/appEnv";
import { apiClient } from "../../lib/apiClient";
import { env } from "../../lib/env";
import { useAuthStore } from "../auth/auth.store";

export type SharingIdentity = {
  userId: string;
  token: string;
  consentVersion: string;
};
export const sameSharingIdentity = (identity: SharingIdentity) => {
  const current = useAuthStore.getState();
  return (
    current.profile?.id === identity.userId && current.token === identity.token
  );
};
export const newSharingRequestId = () => randomUUID();

export const specialistSharingApi = {
  async read(identity: SharingIdentity): Promise<boolean | null> {
    if (!isDoctorFeaturesEnabled) return null;
    if (!sameSharingIdentity(identity)) return null;
    const response = await apiClient<{
      ok: boolean;
      data?: { sharing_enabled?: boolean };
    }>(
      `/api/doctor/privacy?tenant_id=${encodeURIComponent(env.doctorTenantId)}`,
      { headers: { Authorization: `Bearer ${identity.token}` } }
    );
    if (!sameSharingIdentity(identity)) return null;
    if (!response.ok || typeof response.data?.sharing_enabled !== "boolean")
      throw new Error("Specialist sharing status unavailable");
    return response.data.sharing_enabled;
  },
  async save(
    identity: SharingIdentity,
    enabled: boolean,
    requestId: string
  ): Promise<boolean> {
    if (!isDoctorFeaturesEnabled) return false;
    if (!sameSharingIdentity(identity)) return false;
    const action = enabled ? "grant_consent" : "withdraw_consent";
    const response = await apiClient<{
      ok: boolean;
      data?: { action?: string };
    }>("/api/doctor/privacy", {
      method: "POST",
      headers: { Authorization: `Bearer ${identity.token}` },
      body: {
        tenant_id: env.doctorTenantId,
        action,
        request_id: requestId,
        ...(enabled ? { consent_version: identity.consentVersion } : {}),
        confirmation: "CONFIRM_DOCTOR_DATA_REQUEST",
        reason: "Patient self-service request from ASINU mobile",
      },
    });
    if (!sameSharingIdentity(identity)) return false;
    if (!response.ok || response.data?.action !== action)
      throw new Error("Specialist sharing request unsuccessful");
    return true;
  },
};
