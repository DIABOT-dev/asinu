import type { TriageSummaryView } from "./checkin.api";

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
  if (result.speechText?.trim()) return result.speechText.trim();
  const notice = result.aiNotice?.trim() || fallbackNotice || "";
  const suffix = [result.closeMessage, notice].filter(Boolean).join(" ");
  const parts = parseCheckinNarrative(result.narrative).filter(
    (part) => part.type !== "heading"
  );
  const selected = parts.filter(
    (part, index) =>
      index === 0 ||
      /đi khám|chuyên gia|gọi\s*115|seek|assessment|health expert|call\s*115/iu.test(
        part.text
      )
  );
  const body: string[] = [];
  for (const part of selected)
    if ([...body, part.text, suffix].join(" ").length <= 1600)
      body.push(part.text);
  return [...body, suffix].join(" ");
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

// Keep the concise narration (blocks 1, 4, 6), then the fixed AI notice.
// Older servers can use the app's translated notice without changing the schedule.
export function structuredCheckinSpeech(
  result: StructuredCheckinConclusion,
  fallbackNotice?: string
): string {
  return [
    result.personalMessage,
    ...result.seeDoctorWhen,
    result.closeMessage,
    result.aiNotice?.trim() || fallbackNotice || "",
  ]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ");
}
