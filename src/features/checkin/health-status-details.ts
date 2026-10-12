import type { CheckinSession } from './checkin.api';
import type { LogEntry } from '../logs/logs.store';

export type HealthReading = {
  type: 'glucose' | 'blood-pressure';
  labelKey: string;
  value: string;
  unit: string;
  recordedAt: string;
};

/** Keep the same 24-hour window as the health-score API, without using old logs as today's evidence. */
export function getRecentHealthReadings(logs: LogEntry[], now = Date.now()): HealthReading[] {
  const recent = logs
    .filter(log => {
      const recorded = Date.parse(log.recordedAt || '');
      return Number.isFinite(recorded) && recorded <= now && recorded >= now - 24 * 60 * 60 * 1000;
    })
    .sort((a, b) => Date.parse(b.recordedAt!) - Date.parse(a.recordedAt!));
  const glucose = recent.find(log => log.type === 'glucose' && Number.isFinite(log.value));
  const pressure = recent.find(log => log.type === 'blood-pressure' && Number.isFinite(log.systolic));
  const readings: HealthReading[] = [];
  if (glucose) {
    readings.push({
      type: 'glucose', labelKey: 'healthStatusGlucose', value: String(glucose.value),
      unit: glucose.unit || 'mg/dL', recordedAt: glucose.recordedAt!,
    });
  }
  if (pressure) {
    const hasDiastolic = Number.isFinite(pressure.diastolic);
    readings.push({
      type: 'blood-pressure',
      labelKey: hasDiastolic ? 'healthStatusBloodPressure' : 'healthStatusSystolic',
      value: hasDiastolic ? `${pressure.systolic}/${pressure.diastolic}` : String(pressure.systolic),
      unit: pressure.unit || 'mmHg', recordedAt: pressure.recordedAt!,
    });
  }
  return readings;
}

/** Show answers with their questions; an onset or a negated answer must not become a symptom label. */
export function getCheckinAnswers(session: CheckinSession | null) {
  return (Array.isArray(session?.triage_messages) ? session.triage_messages : []).flatMap(message => {
    const question = typeof message.question === 'string' ? message.question.trim() : '';
    const rawAnswer: unknown = message.answer;
    const answer = Array.isArray(rawAnswer)
      ? rawAnswer.filter((part): part is string => typeof part === 'string').join(', ').trim()
      : typeof rawAnswer === 'string' ? rawAnswer.trim() : '';
    return question && answer ? [{ question, answer }] : [];
  });
}
