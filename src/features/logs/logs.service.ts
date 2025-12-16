export const toMgdl = (mmol: number) => parseFloat((mmol * 18).toFixed(1));
export const toMmol = (mgdl: number) => parseFloat((mgdl / 18).toFixed(1));

// Accepts numbers that are multiples of 0.5 (within float epsilon)
export const isHalfStepNumber = (value: number) => {
  const HALF_STEP_EPS = 1e-6;
  return Number.isFinite(value) && Math.abs(value * 2 - Math.round(value * 2)) < HALF_STEP_EPS;
};
