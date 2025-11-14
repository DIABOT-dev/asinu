export interface SessionPayload {
  user_id: string;
  email?: string | null;
  phone?: string | null;
  display_name?: string | null;
}

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "asinu.sid";
