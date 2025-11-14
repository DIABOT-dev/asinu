import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/http/response";
import { issueOtp, verifyOtp } from "@/modules/auth/otpService";
import {
  createPhoneOtpUser,
  findUserByPhone,
  normalizeVietnamPhone,
  recordLogin,
} from "@/modules/auth/userService";
import { setSession } from "@/infrastructure/auth/session";

type FieldErrors = Record<string, { code: string; message: string }>;

type SendBody = {
  phone?: string;
};

type VerifyBody = {
  phone?: string;
  otp?: string;
};

export async function handlePhoneSend(req: NextRequest) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as SendBody;
  if (!body.phone) {
    return jsonError("VALIDATION_ERROR", {
      request: req,
      details: {
        fieldErrors: {
          phone: { code: "PHONE_REQUIRED", message: "Số điện thoại là bắt buộc." },
        },
      },
    });
  }
  const normalized = normalizeVietnamPhone(body.phone);
  if (!normalized) {
    return jsonError("VALIDATION_ERROR", {
      request: req,
      details: {
        fieldErrors: {
          phone: { code: "PHONE_INVALID", message: "Số điện thoại không hợp lệ." },
        },
      },
    });
  }

  try {
    const result = await issueOtp(normalized);
    return jsonSuccess(
      {
        code: "OTP_SENT",
        message: "OTP đã được gửi.",
        expires_at: result.expires_at.toISOString(),
      },
      { request: req },
    );
  } catch (error) {
    console.error("[auth/phone/send] failed", error);
    return jsonError("INTERNAL_ERROR", {
      request: req,
      message: "Không thể gửi OTP vào lúc này.",
    });
  }
}

export async function handlePhoneVerify(req: NextRequest) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as VerifyBody;
  if (!body.phone || !body.otp) {
    const fieldErrors: FieldErrors = {};
    if (!body.phone) {
      fieldErrors.phone = { code: "PHONE_REQUIRED", message: "Số điện thoại là bắt buộc." };
    }
    if (!body.otp) {
      fieldErrors.otp = { code: "OTP_REQUIRED", message: "OTP là bắt buộc." };
    }
    return jsonError("VALIDATION_ERROR", {
      request: req,
      details: {
        fieldErrors,
      },
    });
  }

  const verification = await verifyOtp(body.phone, body.otp);
  if (!verification.ok) {
    let message = "OTP không hợp lệ.";
    if (verification.reason === "EXPIRED") {
      message = "OTP đã hết hạn.";
    } else if (verification.reason === "NOT_REQUESTED") {
      message = "OTP chưa được yêu cầu.";
    } else if (verification.reason === "INVALID_PHONE") {
      message = "Số điện thoại không hợp lệ.";
    }
    return jsonError("UNAUTHORIZED", {
      request: req,
      message,
    });
  }

  let user = await findUserByPhone(verification.phone);
  if (!user) {
    user = await createPhoneOtpUser(verification.phone);
  }
  await recordLogin(user.user_id, "phone_otp");

  const res = jsonSuccess(
    {
      code: "OTP_VERIFIED",
      message: "Đăng nhập thành công.",
    },
    { request: req, cacheControl: "no-store" },
  );
  await setSession(res, user, {
    method: "phone_otp",
    ip: req.ip ?? null,
    user_agent: req.headers.get("user-agent") ?? null,
  });
  return res;
}
