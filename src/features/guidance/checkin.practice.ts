import type {
  CheckinSession,
  CheckinStatus,
  TriageAnswer,
  TriageResult,
} from "../checkin/checkin.api";

type Translate = (key: string, options?: Record<string, unknown>) => unknown;

// Presentation order only, matching the compact interview. No assessment,
// clinical branching, persistence, timers or real answers belong in this file.
export const PRACTICE_CHECKIN_GROUPS = [
  ["symptoms", 1, true],
  ["red_flags", 2, true],
  ["impact", 3, false],
  ["timeline", 4, true],
  ["character", 5, true],
  ["clinical_context", 6, true],
  ["source", 7, true],
  ["associated", 8, true],
] as const;

/** Entirely in-memory examples. Never imports HTTP, storage, AI or call APIs. */
export function createCheckinPractice(
  translate: Translate,
  addressing = { honorific: "bạn", Honorific: "Bạn", CallName: "Bạn" }
) {
  let session: CheckinSession | null = null;
  let followingUp = false;
  const text = (key: string, options?: Record<string, unknown>) =>
    String(translate(key, { ...addressing, ...options }));
  const guide = (key: string) =>
    text(`guidance.practiceCheckin.${key}`, { ns: "onboarding" });
  const list = (key: string) =>
    translate(`guidance.practiceCheckin.${key}`, {
      ns: "onboarding",
      returnObjects: true,
    }) as string[];
  const steps = () =>
    followingUp
      ? ([
          ["followup_status", 4, false],
          ["followup_detail", 1, true],
        ] as const)
      : PRACTICE_CHECKIN_GROUPS;
  const fieldOf = (step: string) => step.replace(/^compact_/, "");
  const exampleAnswer = (step: string) => {
    const field = fieldOf(step);
    const region = session?.body_locations?.[0];
    return ["symptoms", "character"].includes(field) && region
      ? list(`${field}ByRegion.${region}`)[0]
      : list(`${field}.options`)[0];
  };
  const makeSession = (status: CheckinStatus): CheckinSession => {
    const now = new Date().toISOString();
    return {
      id: -1,
      user_id: -1,
      session_date: now.slice(0, 10),
      initial_status: status,
      current_status: status,
      flow_state: status === "fine" ? "resolved" : "monitoring",
      triage_messages: [],
      triage_summary: null,
      triage_severity: null,
      triage_completed_at: null,
      next_checkin_at: null,
      no_response_count: 0,
      family_alerted: false,
      emergency_triggered: false,
      resolved_at: status === "fine" ? now : null,
      created_at: now,
    };
  };
  return {
    async getToday() {
      return { ok: true, session: null };
    },
    exampleAnswer,
    async start(
      status: CheckinStatus,
      locations?: string[] | null,
      _other?: string | null,
      _restart?: boolean
    ) {
      followingUp = false;
      session = { ...makeSession(status), body_locations: locations || null };
      return { ok: true, session };
    },
    async followUp(_id: number, status: CheckinStatus) {
      followingUp = true;
      session = makeSession(status);
      return { ok: true, session };
    },
    async triage(
      _id: number,
      answers: TriageAnswer[],
      _phaseId?: string,
      _signal?: AbortSignal
    ): Promise<TriageResult> {
      const plan = steps();
      const next = plan[answers.length];
      if (next) {
        const [field, group, multiSelect] = next;
        const choices =
          ["symptoms", "character"].includes(field) &&
          session?.body_locations?.length
            ? [
                ...new Set(
                  session.body_locations.flatMap((region) =>
                    list(`${field}ByRegion.${region}`)
                  )
                ),
              ].slice(0, 8)
            : list(`${field}.options`);
        const unknown = guide("unknown"),
          other = guide("other"),
          none = guide("none");
        const absence = [
          "red_flags",
          "source",
          "associated",
          "followup_detail",
        ].includes(field);
        return {
          ok: true,
          isDone: false,
          step: followingUp ? field : `compact_${field}`,
          question: guide(`${field}.question`),
          options: [...choices, ...(absence ? [none] : []), unknown, other],
          multiSelect,
          allowFreeText: true,
          freeTextOption: other,
          skipAnswerLabel: unknown,
          exclusiveOptions: [...(absence ? [none] : []), unknown],
          exclusiveOptionGroups:
            field === "clinical_context"
              ? [choices.slice(0, 3), choices.slice(3, 5)]
              : field === "timeline" ? [choices.slice(0, 4), choices.slice(4)] : [],
          ...(field === "timeline" ? { optionsGrouped: [
            { key: "onset", label: guide("onset.question"), icon: "", items: choices.slice(0, 4) },
            { key: "progression", label: guide("progression.question"), icon: "", items: choices.slice(4) },
            { key: "other", label: guide("timeline.label"), icon: "", items: [unknown, other] },
          ] } : {}),
          questionProgress: { current: answers.length + 1, total: plan.length },
          questionGroup: {
            key: field,
            label: guide(`${field}.label`),
            index: group,
            total: 8,
            kind: "topic",
          },
        };
      }
      // A fixed example, never a risk decision based on taps or typed speech.
      return {
        ok: true,
        isDone: true,
        summary: text("guidance.practiceSummary", { ns: "onboarding" }),
        severity: "medium",
        recommendation: text("guidance.practiceAdvice", { ns: "onboarding" }),
        conclusionVersion: 2,
        conclusionFormat: "narrative",
        narrative: guide("narrative"),
        disclaimer: guide("disclaimer"),
        closeMessage: guide("close"),
        recordedSymptoms: [guide("sampleSymptoms")],
        needsDoctor: true,
        needsFamilyAlert: false,
      };
    },
  };
}
