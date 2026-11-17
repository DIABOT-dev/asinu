export type MeasurementKind = "height" | "weight";
export const RULER_TICK_SPACING = 10;
export function measurementRange(kind: MeasurementKind, value: string) {
  const current = Number(value);
  const usable = Boolean(value) && Number.isFinite(current) && current > 0;
  const defaults =
    kind === "height"
      ? { min: 50, max: 250, step: 1, value: 170 }
      : { min: 10, max: 300, step: 0.1, value: 65 };
  return {
    min: usable
      ? Math.min(defaults.min, current < 1 ? current : Math.floor(current))
      : defaults.min,
    max: usable ? Math.max(defaults.max, Math.ceil(current)) : defaults.max,
    step: defaults.step,
    initial: usable ? current : defaults.value,
  };
}
export function rulerValueAtOffset(
  offset: number,
  range: { min: number; max: number; step: number }
) {
  const index = Math.round(Math.max(0, offset) / RULER_TICK_SPACING);
  return Math.min(
    range.max,
    Math.max(range.min, Number((range.min + index * range.step).toFixed(1)))
  );
}
export function rulerOffsetForValue(
  value: number,
  range: { min: number; max: number; step: number }
) {
  return Number(
    (
      ((Math.min(range.max, Math.max(range.min, value)) - range.min) /
        range.step) *
      RULER_TICK_SPACING
    ).toFixed(6)
  );
}
