import { query } from "@/lib/db_client";
import { normalizeVietnamPhone } from "@/modules/auth/userService";

const STATIC_OTP = process.env.OTP_STATIC_VALUE || "123456";
const OTP_TTL_SECONDS = Number(process.env.OTP_TTL_SECONDS || 5 * 60);

export type OtpIssueResult = {
  phone: string;
  otp: string;
  expires_at: Date;
};

export type OtpVerifyResult =
  | { ok: true; phone: string }
  | { ok: false; reason: "NOT_REQUESTED" | "EXPIRED" | "INVALID_OTP" | "INVALID_PHONE" };

function expiryDate(): Date {
  return new Date(Date.now() + OTP_TTL_SECONDS * 1000);
}

export async function issueOtp(phoneInput: string): Promise<OtpIssueResult> {
  const phone = normalizeVietnamPhone(phoneInput);
  if (!phone) {
    throw new Error("PHONE_INVALID");
  }
  const expiresAt = expiryDate();
  await query("DELETE FROM auth_otp_store WHERE expires_at <= now() OR consumed_at IS NOT NULL");
  await query("DELETE FROM auth_otp_store WHERE phone = $1", [phone]);
  await query(
    `INSERT INTO auth_otp_store (phone, otp, expires_at)
     VALUES ($1, $2, $3)`,
    [phone, STATIC_OTP, expiresAt.toISOString()],
  );
  return { phone, otp: STATIC_OTP, expires_at: expiresAt };
}

export async function verifyOtp(phoneInput: string, otp: string): Promise<OtpVerifyResult> {
  const phone = normalizeVietnamPhone(phoneInput);
  if (!phone) {
    return { ok: false, reason: "INVALID_PHONE" };
  }
  const result = await query<{
    id: string;
    expires_at: Date;
    otp: string;
  }>(
    `SELECT id, expires_at, otp
     FROM auth_otp_store
     WHERE phone = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phone],
  );
  if (result.rowCount === 0) {
    return { ok: false, reason: "NOT_REQUESTED" };
  }
  const record = result.rows[0];
  if (record.expires_at <= new Date()) {
    await query("DELETE FROM auth_otp_store WHERE id = $1", [record.id]);
    return { ok: false, reason: "EXPIRED" };
  }
  if (record.otp !== STATIC_OTP || otp !== STATIC_OTP) {
    return { ok: false, reason: "INVALID_OTP" };
  }
  await query("UPDATE auth_otp_store SET consumed_at = now() WHERE id = $1", [record.id]);
  return { ok: true, phone };
}
