import { NextRequest } from "next/server";
import { ensureDbConnection, getPool } from "@/lib/db_client";
import { hashPassword } from "@/lib/auth/password";
import { jsonError, jsonSuccess } from "@/lib/http/response";

type ValidationError = {
  code: string;
  message: string;
};

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

const EMAIL_REGEX =
  /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;
const TRANSIENT_DB_ERROR_CODES = new Set([
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "EHOSTUNREACH",
  "ECONNRESET",
]);

function isDbUnavailableError(error: any): boolean {
  if (!error) return false;
  if (TRANSIENT_DB_ERROR_CODES.has(error.code)) return true;
  const message = typeof error.message === "string" ? error.message : "";
  return message.includes("DB_CONNECT_FAIL") || message.includes("connect ECONN");
}

function normalizeVietnamPhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) {
    return `+84${digits.slice(1)}`;
  }
  if (digits.startsWith("84")) {
    return `+${digits}`;
  }
  if (digits.startsWith("+84")) {
    return digits;
  }
  if (digits.length >= 9 && digits.length <= 11) {
    return `+84${digits}`;
  }
  return null;
}

function buildValidationErrors(body: RegisterBody) {
  const errors: Record<string, ValidationError> = {};

  if (!body.agreeTerms) {
    errors.terms = {
      code: "TERMS_NOT_ACCEPTED",
      message: "Bạn phải đồng ý với điều khoản sử dụng.",
    };
  }
  if (!body.agreeAI) {
    errors.aiConsent = {
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

  if (body.contactType === "phone") {
    if (!body.phone) {
      errors.phone = {
        code: "PHONE_REQUIRED",
        message: "Số điện thoại là bắt buộc.",
      };
    } else {
      const normalized = normalizeVietnamPhone(body.phone);
      if (!normalized) {
        errors.phone = {
          code: "PHONE_INVALID",
          message: "Số điện thoại không hợp lệ.",
        };
      }
    }
  } else {
    if (!body.email) {
      errors.email = {
        code: "EMAIL_REQUIRED",
        message: "Email là bắt buộc.",
      };
    } else if (!EMAIL_REGEX.test(body.email)) {
      errors.email = {
        code: "EMAIL_INVALID",
        message: "Email không hợp lệ.",
      };
    }
  }

  return errors;
}

export async function POST(req: NextRequest) {
  const payload = (await req.json().catch(() => ({}))) as RegisterBody;
  const contactType = payload.contactType ?? (payload.phone ? "phone" : "email");
  const displayName = payload.display_name?.trim() || null;

  const validationErrors = buildValidationErrors({ ...payload, contactType });
  if (Object.keys(validationErrors).length > 0) {
    const issues = Object.entries(validationErrors).map(([field, detail]) => ({
      field,
      code: detail.code,
      message: detail.message,
    }));
    return jsonError("VALIDATION_ERROR", { request: req, details: { issues } });
  }

  const normalizedEmail = payload.email?.trim().toLowerCase() || null;
  const normalizedPhone = payload.phone ? normalizeVietnamPhone(payload.phone) : null;
  const passwordHash = await hashPassword(payload.password!);

  const pool = getPool();
  let db: Awaited<ReturnType<typeof pool.connect>> | null = null;
  let transactionStarted = false;
  try {
    await ensureDbConnection();
    db = await pool.connect();
    await db.query("BEGIN");
    transactionStarted = true;

    if (normalizedEmail) {
      const emailExists = await db.query("SELECT 1 FROM app_user WHERE lower(email) = $1 LIMIT 1", [
        normalizedEmail,
      ]);
      if (emailExists.rowCount > 0) {
        await db.query("ROLLBACK").catch(() => {});
        transactionStarted = false;
        return jsonError("CONFLICT", {
          request: req,
          message: "Email đã được sử dụng.",
        });
      }
    }

    if (normalizedPhone) {
      const phoneExists = await db.query("SELECT 1 FROM app_user WHERE phone = $1 LIMIT 1", [
        normalizedPhone,
      ]);
      if (phoneExists.rowCount > 0) {
        await db.query("ROLLBACK").catch(() => {});
        transactionStarted = false;
        return jsonError("CONFLICT", {
          request: req,
          message: "Số điện thoại đã được sử dụng.",
        });
      }
    }

    const derivedName =
      displayName ||
      (normalizedEmail ? normalizedEmail.split("@")[0] : null) ||
      normalizedPhone;

    const insertUser = await db.query(
      `INSERT INTO app_user (email, phone, display_name)
       VALUES ($1, $2, $3)
       RETURNING user_id`,
      [normalizedEmail, normalizedPhone, derivedName],
    );
    const userId = (insertUser.rows[0] as { user_id: string } | undefined)?.user_id;

    if (!userId) {
      throw new Error("FAILED_TO_CREATE_USER");
    }

    const authPrefsPatch = JSON.stringify({
      auth: {
        password_hash: passwordHash,
        password_algo: "scrypt",
        last_changed_at: new Date().toISOString(),
        contact_type: contactType,
      },
    });

    await db.query(
      `INSERT INTO user_settings (user_id, prefs, created_at, updated_at)
       VALUES ($1, $2::jsonb, now(), now())
       ON CONFLICT (user_id) DO UPDATE
       SET prefs = COALESCE(user_settings.prefs, '{}'::jsonb) || EXCLUDED.prefs,
           updated_at = now()`,
      [userId, authPrefsPatch],
    );

    await db.query("COMMIT");
    transactionStarted = false;
    console.info("[auth/register] created user", userId);

    return jsonSuccess(
      {
        code: "REGISTER_SUCCESS",
        message: "Tạo tài khoản thành công. Vui lòng đăng nhập.",
      },
      { request: req, status: 201, cacheControl: "no-store" },
    );
  } catch (error: any) {
    if (transactionStarted && db) {
      await db.query("ROLLBACK").catch(() => {});
    }
    if (isDbUnavailableError(error)) {
      console.error("[auth/register] database unavailable:", error?.message ?? error);
      return jsonError("DB_UNAVAILABLE", {
        request: req,
        message: "Hệ thống đang bận. Vui lòng thử lại sau.",
      });
    }
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
    console.error("[auth/register] failed:", error);
    return jsonError("INTERNAL_ERROR", {
      request: req,
      message: "Không thể tạo tài khoản vào lúc này.",
    });
  } finally {
    db?.release();
  }
}
