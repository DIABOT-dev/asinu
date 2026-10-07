import type { CheckinSession, CheckinStatus, TriageAnswer, TriageResult } from '../checkin/checkin.api';

type Translate = (key: string, options?: Record<string, unknown>) => unknown;

/** Entirely in-memory examples. Never imports HTTP, storage, AI or call APIs. */
export function createCheckinPractice(translate: Translate) {
  let session: CheckinSession | null = null;
  const text = (key: string, options?: Record<string, unknown>) => String(translate(key, options));
  const questions = [
    { step: 'symptoms', questionKey: 'checkinFallbackInitial2Question', optionsKey: 'checkinFallbackInitial2Options', multiSelect: true },
    { step: 'onset', questionKey: 'checkinFallbackInitial3Question', optionsKey: 'checkinFallbackInitial3Options', multiSelect: false },
    { step: 'progression', questionKey: 'checkinFallbackProgressionQuestion', multiSelect: false },
    { step: 'red_flags', questionKey: 'checkinFallbackRedFlagsQuestion', optionsKey: 'checkinFallbackRedFlagsOptions', multiSelect: true },
  ];
  const makeSession = (status: CheckinStatus): CheckinSession => {
    const now = new Date().toISOString();
    return { id: -1, user_id: -1, session_date: now.slice(0, 10), initial_status: status,
      current_status: status, flow_state: status === 'fine' ? 'resolved' : 'monitoring',
      triage_messages: [], triage_summary: null, triage_severity: null, triage_completed_at: null,
      next_checkin_at: null, no_response_count: 0, family_alerted: false, emergency_triggered: false,
      resolved_at: status === 'fine' ? now : null, created_at: now };
  };
  return {
    async getToday() { return { ok: true, session: null }; },
    async start(status: CheckinStatus, _locations?: string[] | null, _other?: string | null, _restart?: boolean) {
      session = makeSession(status);
      return { ok: true, session };
    },
    async followUp(_id: number, status: CheckinStatus) {
      session = makeSession(status);
      return { ok: true, session };
    },
    async triage(_id: number, answers: TriageAnswer[]): Promise<TriageResult> {
      const question = questions[answers.length];
      if (question) {
        return { ok: true, isDone: false, step: question.step, question: text(question.questionKey),
          options: question.optionsKey ? translate(question.optionsKey, { returnObjects: true }) as string[] : [],
          multiSelect: question.multiSelect, allowFreeText: true };
      }
      const severity = session?.initial_status === 'very_tired' ? 'high' : 'medium';
      return { ok: true, isDone: true, summary: text('guidance.practiceSummary', { ns: 'onboarding' }),
        severity, recommendation: String(translate('guidance.practiceAdvice', { ns: 'onboarding' })),
        needsDoctor: severity === 'high', needsFamilyAlert: false };
    },
  };
}
