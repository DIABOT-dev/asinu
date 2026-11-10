import type { CheckinSession, TriageAnswer, TriageSummaryView } from "./checkin.api";

// Only symptom answers belong in this label. Timing, severity, and negative
// warning-sign answers remain part of the assessment, not the symptom list.
export function recordedCheckinSymptoms({
  session, answers, isFine, translate, recordedSymptoms,
}: {
  session: CheckinSession | null;
  answers?: TriageAnswer[];
  isFine?: boolean;
  translate?: (key: string) => string;
  recordedSymptoms?: string[];
}): string {
  if (isFine) return translate?.('checkinSymptomsStable') || '';

  const isSymptomAnswer = ({ step, question }: TriageAnswer) => {
    if (step) return ['symptoms', 'associated', 'followup_detail'].includes(step)
      || /^detail_.+_associated$/.test(step);
    // Older clients saved question text without a step. Exclude other facts
    // before checking symptom wording, since onset questions also say "khó chịu".
    if (/khi nào|bao lâu|bắt đầu|từ lúc|thời điểm|mức độ|ở đâu|vùng nào|đỡ hơn|nặng hơn|thay đổi thế nào|diễn biến|dễ chịu|đã thử|đã làm|how long|when|where|severity|better|worse|progress|reliev/iu.test(question || '')) return false;
    return /triệu chứng|symptom|khó chịu|biểu hiện|vấn đề/iu.test(question || '');
  };
  const source = Array.isArray(recordedSymptoms)
    ? recordedSymptoms
    : (answers?.length ? answers : session?.triage_messages || [])
      .filter(isSymptomAnswer).map(answer => answer.answer);
  const found: string[] = [];
  const seen = new Set<string>();
  for (const answer of source) {
    for (const part of String(answer || '').split(/[,;\n]+/)) {
      const value = part.normalize('NFC').trim();
      const key = value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
      const empty = /^(?:không(?: có)?(?: gì)?|không có gì thêm|không có triệu chứng mới|không có dấu hiệu nào|không rõ(?: nữa)?|không biết|không nhớ|khác|bình thường|none|no|nothing(?: else to add)?|unsure|unknown|not sure|normal)$/u.test(key);
      if (key && !empty && !seen.has(key)) { seen.add(key); found.push(value); }
    }
  }
  if (found.length) return found.join(', ');
  return translate?.(session?.current_status === 'tired'
    ? 'checkinSymptomsTired' : 'checkinSymptomsUrgentFallback') || '';
}

export type StructuredCheckinConclusion = TriageSummaryView & {
  conclusionVersion: 2;
  personalMessage: string;
  explanation: string;
  todo: string[];
  seeDoctorWhen: string[];
  disclaimer: string;
  closeMessage: string;
};

export type NarrativeCheckinConclusion = TriageSummaryView & {
  conclusionFormat: "narrative";
  narrative: string;
  disclaimer: string;
  closeMessage: string;
};
export type DisplayCheckinConclusion =
  | StructuredCheckinConclusion
  | NarrativeCheckinConclusion;

export function hasNarrativeCheckinConclusion(
  value: TriageSummaryView | null
): value is NarrativeCheckinConclusion {
  return (
    value?.conclusionFormat === "narrative" &&
    value.severity !== "emergency" &&
    typeof value.narrative === "string" &&
    value.narrative.trim().length > 0 &&
    typeof value.disclaimer === "string" &&
    value.disclaimer.trim().length > 0 &&
    typeof value.closeMessage === "string" &&
    value.closeMessage.trim().length > 0
  );
}

export function hasDisplayCheckinConclusion(
  value: TriageSummaryView | null
): value is DisplayCheckinConclusion {
  return (
    hasNarrativeCheckinConclusion(value) ||
    hasStructuredCheckinConclusion(value)
  );
}

export type NarrativePart = {
  type: "paragraph" | "bullet" | "heading";
  text: string;
};
export function parseCheckinNarrative(value: string): NarrativePart[] {
  const parts: NarrativePart[] = [];
  let continued = false;
  for (const raw of value.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) {
      continued = false;
      continue;
    }
    const bullet = line.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
    const heading =
      line.match(/^#{1,6}\s+(.+)$/) || line.match(/^\*\*(.+?)\*\*:?$/);
    const clean = (text: string) =>
      text
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
    if (bullet) {
      parts.push({ type: "bullet", text: clean(bullet[1]) });
      continued = true;
    } else if (heading) {
      parts.push({ type: "heading", text: clean(heading[1]) });
      continued = false;
    } else if (continued && parts.length) {
      parts[parts.length - 1].text += " " + clean(line);
    } else {
      parts.push({ type: "paragraph", text: clean(line) });
      continued = true;
    }
  }
  return parts;
}

export function checkinConclusionSpeech(
  result: DisplayCheckinConclusion,
  fallbackNotice?: string
): string {
  if (!hasNarrativeCheckinConclusion(result))
    return structuredCheckinSpeech(result, fallbackNotice);
  // Derive narration from the visible result so old saved responses carrying an
  // abbreviated speechText also read every explanation and practical action.
  return joinConclusionSpeech(
    parseCheckinNarrative(result.narrative).map(part => part.text),
    result, fallbackNotice,
  );
}

function joinConclusionSpeech(body: string[], result: TriageSummaryView, fallbackNotice?: string): string {
  const parts = body.map(text => text.replace(/\s+/g, ' ').trim()).filter(Boolean);
  for (const value of [result.disclaimer, result.closeMessage, result.aiNotice?.trim() || fallbackNotice || '']) {
    const text = value?.replace(/\s+/g, ' ').trim();
    if (text && !parts.some(part => part === text || part.endsWith(' ' + text))) parts.push(text);
  }
  return parts.join(' ');
}

export function hasStructuredCheckinConclusion(
  value: TriageSummaryView | null
): value is StructuredCheckinConclusion {
  const text = (s: unknown) => typeof s === "string" && s.trim().length > 0;
  return (
    value?.conclusionVersion === 2 &&
    value.severity !== "emergency" &&
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

// Read every displayed block in order; the audio service handles provider-sized
// requests and never relies on excluding advice to fit one TTS submission.
export function structuredCheckinSpeech(
  result: StructuredCheckinConclusion,
  fallbackNotice?: string
): string {
  return joinConclusionSpeech([
    result.personalMessage,
    result.explanation,
    ...result.todo,
    ...result.seeDoctorWhen,
  ], result, fallbackNotice);
}
