import { NextRequest } from "next/server";
import { jsonError, jsonSuccess } from "@/lib/http/response";
import {
  EMAIL_REGEX,
  PASSWORD_REGEX,
  createUserWithPassword,
  deriveDisplayName,
  findUserByEmail,
  findUserByPhone,
  normalizeEmail,
  normalizeVietnamPhone,
  recordLogin,
  verifyUserPassword,
} from "@/modules/auth/userService";
import { setSession, clearSession } from "@/infrastructure/auth/session";

type FieldErrors = Record<string, { code: string; message: string }>;

type RegisterBody = {
  contactType?: "email" | "phone";
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
  display_name?: string;
  agreeTerms?: boolean;
  agreeAI?: boolean;
};

type LoginBody = {
  contactType?: "email" | "phone";
  email?: string;
  phone?: string;
  password?: string;
};

function sessionMetadata(req: NextRequest, method: string) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : req.ip ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;
  return {
    method,
    ip,
    user_agent: userAgent,
  };
}

function validateRegister(body: RegisterBody): FieldErrors {
  const errors: FieldErrors = {};
  const contactType = body.contactType ?? (body.phone ? "phone" : "email");

  if (!body.agreeTerms) {
    errors.agreeTerms = {
      code: "TERMS_NOT_ACCEPTED",
      message: "Bạn phải đồng ý với điều khoản sử dụng.",
    };
  }
  if (!body.agreeAI) {
    errors.agreeAI = {
      code: "AI_NOT_ACCEPTED",
      message: "Bạn cần đồng ý cho phép cá nhân hóa AI.",
    };
  }

  if (!body.password || !PASSWORD_REGEX.test(body.password)) {
    errors.password = {
      code: "WEAK_PASSWORD",
      message: "Mật khẩu phải có tối thiểu 8 ký tự, gồm chữ và số.",
    };
  }

  if (!body.confirmPassword) {
    errors.confirmPassword = {
      code: "PASSWORD_CONFIRM_REQUIRED",
      message: "Vui lòng xác nhận lại mật khẩu.",
    };
  } else if (body.password && body.password !== body.confirmPassword) {
    errors.confirmPassword = {
      code: "PASSWORD_MISMATCH",
      message: "Mật khẩu xác nhận không khớp.",
    };
  }

  if (contactType === "phone") {
    if (!body.phone) {
      errors.phone = { code: "PHONE_REQUIRED", message: "Số điện thoại là bắt buộc." };
    } else if (!normalizeVietnamPhone(body.phone)) {
      errors.phone = { code: "PHONE_INVALID", message: "Số điện thoại không hợp lệ." };
    }
  } else {
    if (!body.email) {
      errors.email = { code: "EMAIL_REQUIRED", message: "Email là bắt buộc." };
    } else if (!EMAIL_REGEX.test(body.email.trim())) {
      errors.email = { code: "EMAIL_INVALID", message: "Email không hợp lệ." };
    }
  }

  return errors;
}

function validateLogin(body: LoginBody): FieldErrors {
  const errors: FieldErrors = {};
  const contactType = body.contactType ?? (body.phone ? "phone" : "email");

  if (!body.password) {
    errors.password = {
      code: "PASSWORD_REQUIRED",
      message: "Mật khẩu là bắt buộc.",
    };
  }

  if (contactType === "phone") {
    if (!body.phone) {
      errors.phone = {
        code: "PHONE_REQUIRED",
        message: "Số điện thoại là bắt buộc.",
      };
    } else if (!normalizeVietnamPhone(body.phone)) {
      errors.phone = { code: "PHONE_INVALID", message: "Số điện thoại không hợp lệ." };
    }
  } else {
    const normalized = body.email?.trim().toLowerCase();
    if (!body.email) {
      errors.email = { code: "EMAIL_REQUIRED", message: "Email là bắt buộc." };
    } else if (!normalized || !EMAIL_REGEX.test(normalized)) {
      errors.email = { code: "EMAIL_INVALID", message: "Email không hợp lệ." };
    }
  }

  return errors;
}

function buildFieldErrorResponse(req: NextRequest, errors: FieldErrors) {
  return jsonError("VALIDATION_ERROR", {
    request: req,
    details: {
      fieldErrors: errors,
    },
  });
}

export async function handleEmailRegister(req: NextRequest) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as RegisterBody;
  const contactType = body.contactType ?? (body.phone ? "phone" : "email");
  const errors = validateRegister({ ...body, contactType });
  if (Object.keys(errors).length > 0) {
    return buildFieldErrorResponse(req, errors);
  }

  try {
    const normalizedEmail = contactType === "email" ? normalizeEmail(body.email ?? null) : null;
    const normalizedPhone = contactType === "phone" ? normalizeVietnamPhone(body.phone ?? null) : null;
    const user = await createUserWithPassword({
      email: normalizedEmail ?? undefined,
      phone: normalizedPhone ?? undefined,
      password: body.password!,
      displayName: body.display_name ?? deriveDisplayName(normalizedEmail, normalizedPhone, null),
      provider: contactType === "phone" ? "phone_password" : "email_password",
    });

    const res = jsonSuccess(
      {
        code: "REGISTER_SUCCESS",
        message: "Tạo tài khoản thành công. Vui lòng đăng nhập.",
      },
      { request: req, status: 201, cacheControl: "no-store" },
    );
    await setSession(res, user, sessionMetadata(req, "register"));
    return res;
  } catch (error: any) {
    if (error?.code === "23505") {
      const detail = (error.detail as string) || "";
      const isEmail = detail.includes("(email)");
      const isPhone = detail.includes("(phone)");
      return jsonError("CONFLICT", {
        request: req,
        message: isEmail
          ? "Email đã được sử dụng."
          : isPhone
            ? "Số điện thoại đã được sử dụng."
            : "Tài khoản đã tồn tại.",
      });
    }
    console.error("[auth/email/register] failed", error);
    return jsonError("INTERNAL_ERROR", {
      request: req,
      message: "Không thể tạo tài khoản vào lúc này.",
    });
  }
}

export async function handleEmailLogin(req: NextRequest) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as LoginBody;
  const contactType = body.contactType ?? (body.phone ? "phone" : "email");
  const errors = validateLogin({ ...body, contactType });
  if (Object.keys(errors).length > 0) {
    return buildFieldErrorResponse(req, errors);
  }

  const normalizedEmail = contactType === "email" ? normalizeEmail(body.email ?? null) : null;
  const normalizedPhone = contactType === "phone" ? normalizeVietnamPhone(body.phone ?? null) : null;
  const identifier = contactType === "phone" ? normalizedPhone : normalizedEmail;
  if (!identifier) {
    return jsonError("VALIDATION_ERROR", {
      request: req,
      details: { fieldErrors: { identifier: { code: "IDENTIFIER_REQUIRED", message: "Thiếu thông tin đăng nhập." } } },
    });
  }

  const user =
    contactType === "phone"
      ? await findUserByPhone(identifier)
      : await findUserByEmail(identifier);

  if (!user) {
    const res = jsonError("UNAUTHORIZED", {
      request: req,
      message: "Sai thông tin đăng nhập.",
    });
    await clearSession(res, req);
    return res;
  }

  const valid = await verifyUserPassword(user, body.password!);
  if (!valid) {
    const res = jsonError("UNAUTHORIZED", {
      request: req,
      message: "Sai thông tin đăng nhập.",
    });
    await clearSession(res, req);
    return res;
  }

  await recordLogin(user.user_id, contactType === "phone" ? "phone_password" : "email_password");

  const url = new URL(req.url);
  const redirectTo =
    url.searchParams.get("next") ||
    url.searchParams.get("redirect") ||
    "/dashboard";

  const res = jsonSuccess(
    {
      code: "LOGIN_SUCCESS",
      message: "Đăng nhập thành công.",
      redirect_to: redirectTo,
    },
    { request: req, cacheControl: "no-store" },
  );
  await setSession(res, user, sessionMetadata(req, "login"));
  return res;
}

export async function handleEmailAction(req: NextRequest) {
  const body = ((await req.json().catch(() => ({}))) ?? {}) as (RegisterBody & { action?: string });
  const action = (body.action ?? "").toLowerCase();
  if (action === "register") {
    return handleEmailRegister(req);
  }
  if (action === "login" || !action) {
    return handleEmailLogin(req);
  }
  return jsonError("BAD_REQUEST", {
    request: req,
    message: "Hành động không hợp lệ.",
  });
}
