import type { Profile } from "../auth/auth.store";
import type { UpdateProfilePayload } from "../auth/auth.api";
import { findProvince, findWard } from "./administrative-units";

export type PersonalProfileField =
  | "name"
  | "phone"
  | "gender"
  | "dateOfBirth"
  | "heightCm"
  | "weightKg"
  | "bloodType"
  | "chronicDiseases"
  | "address";
export type ProfileAddress = {
  province: string;
  ward: string;
  street: string;
  provinceCode?: string;
  wardCode?: string;
};
export type ProfileFieldDraft = string | string[] | ProfileAddress;
export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
export const PROFILE_FIELD_LABELS: Record<PersonalProfileField, string> = {
  name: "fullName",
  phone: "phone",
  gender: "gender",
  dateOfBirth: "dateOfBirth",
  heightCm: "height",
  weightKg: "weight",
  bloodType: "bloodType",
  chronicDiseases: "chronicDiseases",
  address: "address",
};
export const normalizeConditions = (values: string[]) => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];
export function initialFieldDraft(
  field: PersonalProfileField,
  profile: Profile
): ProfileFieldDraft {
  if (field === "address") {
    const province = findProvince(
      profile.address?.provinceCode,
      profile.address?.province
    );
    const ward = findWard(
      province,
      profile.address?.wardCode,
      profile.address?.ward
    );
    return {
      province: province?.name ?? profile.address?.province ?? "",
      ward: ward?.name ?? profile.address?.ward ?? "",
      street: profile.address?.street ?? "",
      provinceCode: province?.code ?? "",
      wardCode: ward?.code ?? "",
    };
  }
  if (field === "chronicDiseases")
    return normalizeConditions(profile.chronicDiseases ?? []);
  if (field === "dateOfBirth") return profile.dateOfBirth?.slice(0, 10) ?? "";
  if (field === "bloodType")
    return String(profile.bloodType ?? "")
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");
  return String(profile[field] ?? "");
}
export function normalizedDraft(
  field: PersonalProfileField,
  draft: ProfileFieldDraft
) {
  if (field === "address") {
    const address = draft as ProfileAddress;
    return JSON.stringify({
      provinceCode: address.provinceCode ?? "",
      wardCode: address.wardCode ?? "",
      province: address.province.trim(),
      ward: address.ward.trim(),
      street: address.street.trim(),
    });
  }
  if (field === "chronicDiseases")
    return JSON.stringify(normalizeConditions(draft as string[]).sort());
  const value = String(draft).trim();
  if (field === "bloodType") return value.toUpperCase().replace(/\s+/g, "");
  if (
    ["heightCm", "weightKg"].includes(field) &&
    value &&
    Number.isFinite(Number(value))
  )
    return String(Number(value));
  return value;
}
export function validBirthDate(value: string, today = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const limit = new Date(
    today.getFullYear() - 150,
    today.getMonth(),
    today.getDate()
  );
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date >= limit &&
    date <= end
  );
}
export function dateParts(value: string, today = new Date()) {
  const values = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split("-").map(Number)
    : [today.getFullYear() - 40, 1, 1];
  return { year: values[0], month: values[1], day: values[2] };
}
export function changeBirthDate(
  value: string,
  part: "day" | "month" | "year",
  next: number
) {
  const parts = { ...dateParts(value), [part]: next };
  const day = Math.min(
    parts.day,
    new Date(parts.year, parts.month, 0).getDate()
  );
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    day
  ).padStart(2, "0")}`;
}
export function fieldError(
  field: PersonalProfileField,
  draft: ProfileFieldDraft
): string | null {
  const value = String(draft).trim();
  if (field === "name" && (!value || value.length > 200)) return "nameRequired";
  if (
    field === "phone" &&
    !/^(0\d{9}|\+?84\d{9})$/.test(value.replace(/[\s().-]/g, ""))
  )
    return "phoneInvalid";
  if (field === "gender" && !["Nam", "Nữ", "Khác"].includes(value))
    return "genderRequired";
  if (field === "dateOfBirth" && !validBirthDate(value))
    return "dateOfBirthInvalid";
  if (
    field === "heightCm" &&
    (!Number.isFinite(Number(value)) ||
      Number(value) <= 0 ||
      Number(value) > 300)
  )
    return "heightPositive";
  if (
    field === "weightKg" &&
    (!Number.isFinite(Number(value)) ||
      Number(value) <= 0 ||
      Number(value) > 700)
  )
    return "weightPositive";
  if (
    field === "bloodType" &&
    value &&
    !BLOOD_TYPES.includes(normalizedDraft(field, draft))
  )
    return "bloodTypeInvalid";
  if (field === "address") {
    const address = draft as ProfileAddress;
    const { province, ward, street } = address;
    if (
      province.length > 120 ||
      ward.length > 120 ||
      street.length > 300 ||
      [province, ward, street].some((value) => value.includes("\u0000"))
    )
      return "addressRequired";
    const hasProvince = !!(province.trim() || address.provinceCode);
    const hasWard = !!(ward.trim() || address.wardCode);
    const selectedProvince = findProvince(address.provinceCode, province);
    if (
      (hasProvince && !selectedProvince) ||
      (hasWard &&
        (!selectedProvince ||
          !findWard(selectedProvince, address.wardCode, ward)))
    )
      return "addressSelectionRequired";
  }
  return null;
}
/** A field sheet must never send values belonging to a different field. */
export function fieldUpdate(
  field: PersonalProfileField,
  draft: ProfileFieldDraft
): UpdateProfilePayload {
  if (field === "address") {
    const address = JSON.parse(normalizedDraft(field, draft)) as ProfileAddress;
    if (![address.province, address.ward, address.street].some(Boolean))
      return { address: null };
    const province = findProvince(address.provinceCode, address.province);
    const ward = findWard(province, address.wardCode, address.ward);
    if (fieldError(field, draft))
      throw new Error("Invalid administrative address selection");
    return {
      address: {
        provinceCode: province?.code ?? "",
        province: province?.name ?? "",
        wardCode: ward?.code ?? "",
        ward: ward?.name ?? "",
        street: address.street,
      },
    };
  }
  if (field === "chronicDiseases")
    return { chronicDiseases: normalizeConditions(draft as string[]) };
  if (field === "heightCm" || field === "weightKg")
    return { [field]: Number(draft) };
  if (field === "bloodType")
    return { bloodType: normalizedDraft(field, draft) || null };
  return { [field]: String(draft).trim() };
}
export function formatProfileAddress(address?: ProfileAddress | null) {
  return address
    ? [address.street, address.ward, address.province]
        .filter(Boolean)
        .join(", ")
    : "";
}
