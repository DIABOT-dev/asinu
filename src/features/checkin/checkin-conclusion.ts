import type { TriageSummaryView } from './checkin.api';

export type StructuredCheckinConclusion = TriageSummaryView & {
  conclusionVersion: 2;
  personalMessage: string;
  explanation: string;
  todo: string[];
  seeDoctorWhen: string[];
  disclaimer: string;
  closeMessage: string;
};

export function hasStructuredCheckinConclusion(
  value: TriageSummaryView | null,
): value is StructuredCheckinConclusion {
  const text = (s: unknown) => typeof s === 'string' && s.trim().length > 0;
  return (
    value?.conclusionVersion === 2 &&
    value.severity !== 'emergency' &&
    text(value.personalMessage) &&
    text(value.explanation) &&
    text(value.disclaimer) &&
    text(value.closeMessage) &&
    Array.isArray(value.todo) &&
    value.todo.length > 0 &&
    value.todo.every(text) &&
    Array.isArray(value.seeDoctorWhen) &&
    value.seeDoctorWhen.length > 0 &&
    value.seeDoctorWhen.every(text)
  );
}

// The explanation, activities and disclaimer remain readable on screen. Only
// blocks 1, 4 and 6 are spoken; never append a second locally invented schedule.
export function structuredCheckinSpeech(
  result: StructuredCheckinConclusion,
): string {
  return [result.personalMessage, ...result.seeDoctorWhen, result.closeMessage]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' ');
}
