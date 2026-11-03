export const BP_STANDARD: "AHA_ACC_2025";
export const BP_LIMITS: Readonly<{
  systolicMin: number;
  systolicMax: number;
  diastolicMin: number;
  diastolicMax: number;
  pulseMin: number;
  pulseMax: number;
}>;
export type BPProfile = {
  dateOfBirth?: string | null;
  age?: number | null;
  birthYear?: number | string | null;
};
export type BPCategory = "normal" | "elevated" | "stage1" | "stage2" | "severe";
export type BPValidation =
  | { ok: true; systolic: number; diastolic: number; pulse?: number }
  | { ok: false; error: "numbers" | "order" | "range" | "pulse" };
export function bloodPressureNumber(value: unknown): number | null;
export function validateBloodPressure(
  systolic: unknown,
  diastolic: unknown,
  pulse?: unknown
): BPValidation;
export function bloodPressureAge(
  profile?: BPProfile | null,
  now?: Date
): number | null;
export function assessBloodPressure(
  systolic: unknown,
  diastolic: unknown,
  profile?: BPProfile | null,
  now?: Date
): {
  standard: typeof BP_STANDARD;
  valid: boolean;
  scope: "unknown_age" | "under18" | "adult";
  category: BPCategory | null;
  displayCategory: BPCategory | "low" | null;
  low: boolean;
  veryHigh: boolean;
  repeatHigh: boolean;
};
export function bloodPressureMetricStatus(
  systolic: unknown,
  diastolic: unknown,
  profile?: BPProfile | null,
  now?: Date
): "unavailable" | "danger" | "available" | "monitor" | "stable";
