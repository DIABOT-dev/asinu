import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../lib/apiClient';
import { isExpertConsultationEnabled } from '../../lib/appEnv';

export type ScreeningStep = 'red_flags' | 'associated' | 'onset' | 'progression' | 'impact';
export type ScreeningAnswer = { step: ScreeningStep; values: string[]; text: string };
export type ScreeningQuestion = {
  step: ScreeningStep;
  title: string;
  options: { value: string; label: string }[];
  multiSelect: boolean;
  allowFreeText: boolean;
};
export type ScreeningResult = {
  status: 'question' | 'ready' | 'emergency' | 'needs_in_person' | 'incomplete';
  isDone: boolean;
  suitable_for_remote_care: boolean;
  risk_level: 'low' | 'medium' | 'high' | 'emergency';
  message: string | null;
  question?: ScreeningQuestion;
  recorded_answers: { step: ScreeningStep; question: string; answers: string[] }[];
  intake: {
    symptom_onset?: 'today' | 'two_to_seven_days' | 'over_one_week' | 'ongoing';
    progression?: 'improving' | 'stable' | 'worsening';
    severity?: 'mild' | 'moderate' | 'severe';
  };
};

type Inputs = {
  owner: string | null;
  ready: boolean;
  summary: string;
  answers: ScreeningAnswer[];
  locale: 'vi' | 'en';
  onAnswersChange: (answers: ScreeningAnswer[]) => void;
};
const fingerprint = (input: Inputs, answers = input.answers) =>
  JSON.stringify([input.owner, input.locale, input.summary.trim(), answers]);

export function useConsultationScreening(input: Inputs) {
  const current = useRef(input);
  current.current = input;
  const sequence = useRef(0);
  const pending = useRef<string | null>(null);
  const mounted = useRef(true);
  const [state, setState] = useState<{
    key: string; result: ScreeningResult | null; busy: boolean; error: boolean;
  }>({ key: '', result: null, busy: false, error: false });
  const key = fingerprint(input);

  const run = async (answers = current.current.answers) => {
    if (!isExpertConsultationEnabled) {return;}
    const snapshot = current.current;
    const requestKey = fingerprint(snapshot, answers);
    if (!snapshot.ready || !snapshot.owner || !snapshot.summary.trim() || pending.current === requestKey) {return;}
    const request = ++sequence.current;
    pending.current = requestKey;
    setState(previous => ({
      key: requestKey, result: previous.key === requestKey ? previous.result : null,
      busy: true, error: false,
    }));
    try {
      const response = await apiClient<{ data: ScreeningResult }>('/api/doctor/screening', {
        method: 'POST', body: { summary: snapshot.summary.trim(), answers, locale: snapshot.locale },
      });
      const result = response.data;
      if (!result || !['question', 'ready', 'emergency', 'needs_in_person', 'incomplete'].includes(result.status)
        || !['low', 'medium', 'high', 'emergency'].includes(result.risk_level)
        || !Array.isArray(result.recorded_answers)
        || (result.status === 'question' && (!result.question || !Array.isArray(result.question.options)))
        || (result.status === 'ready' && (!result.isDone || !result.suitable_for_remote_care
          || !result.intake?.symptom_onset || !result.intake.progression || !result.intake.severity
          || result.recorded_answers.length !== 5))) {
        throw new Error('Invalid screening response');
      }
      if (mounted.current && request === sequence.current && current.current.owner === snapshot.owner) {
        setState({ key: requestKey, result: response.data, busy: false, error: false });
      }
    } catch {
      if (mounted.current && request === sequence.current && current.current.owner === snapshot.owner) {
        setState({ key: requestKey, result: null, busy: false, error: true });
      }
    } finally {
      if (request === sequence.current) {pending.current = null;}
    }
  };

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  useEffect(() => {
    sequence.current++;
    pending.current = null;
    setState({ key: '', result: null, busy: false, error: false });
    if (input.ready && input.answers.length) {run();}
    // Draft hydration and account changes resume by rechecking the server.
    // Answers submitted during this mount are evaluated by answer() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.owner, input.ready, input.locale]);

  const result = state.key === key ? state.result : null;
  return {
    result,
    busy: state.key === key && state.busy,
    error: state.key === key && state.error,
    check: () => run(),
    answer: (answer: ScreeningAnswer) => {
      if (pending.current) {return Promise.resolve();}
      const answers = [...current.current.answers, answer];
      current.current.onAnswersChange(answers);
      return run(answers);
    },
    back: () => {
      sequence.current++;
      pending.current = null;
      const answers = current.current.answers.slice(0, -1);
      current.current.onAnswersChange(answers);
      return run(answers);
    },
    reset: () => {
      sequence.current++;
      pending.current = null;
      current.current.onAnswersChange([]);
      setState({ key: '', result: null, busy: false, error: false });
    },
  };
}

export type ConsultationScreening = ReturnType<typeof useConsultationScreening>;
