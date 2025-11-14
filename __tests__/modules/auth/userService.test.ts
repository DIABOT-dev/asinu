import { describe, it, expect } from "vitest";
import {
  deriveDisplayName,
  normalizeEmail,
  normalizeVietnamPhone,
} from "@/modules/auth/userService";

describe("auth user helpers", () => {
  it("normalizes emails to lowercase", () => {
    expect(normalizeEmail("User@Example.com")).toBe("user@example.com");
    expect(normalizeEmail("   CASE@DOMAIN.VN ")).toBe("case@domain.vn");
  });

  it("normalizes Vietnam phone numbers", () => {
    expect(normalizeVietnamPhone("0912 345 678")).toBe("+84912345678");
    expect(normalizeVietnamPhone("+84981234567")).toBe("+84981234567");
    expect(normalizeVietnamPhone("84981234567")).toBe("+84981234567");
    expect(normalizeVietnamPhone("123")).toBeNull();
  });

  it("derives display names", () => {
    expect(deriveDisplayName("member@example.com", null, null)).toBe("member");
    expect(deriveDisplayName(null, "+84912345678", null)).toBe("Member 5678");
    expect(deriveDisplayName(null, null, " Custom Name ")).toBe("Custom Name");
  });
});
