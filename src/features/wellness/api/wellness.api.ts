/**
 * Wellness Monitoring API Client
 * API calls cho hệ thống theo dõi sức khỏe
 */

import { apiClient } from '../../../lib/apiClient';

// =====================================================
// TYPES
// =====================================================

export type ActivityType = 
  | 'APP_OPEN' 
  | 'MOOD_CHECK' 
  | 'HEALTH_MEASUREMENT' 
  | 'QUESTION_ANSWERED' 
  | 'QUESTION_SKIPPED';

export type WellnessStatus = 'OK' | 'MONITOR' | 'CONCERN' | 'DANGER';

export type MoodType = 'OK' | 'TIRED' | 'NOT_OK' | 'NORMAL' | 'EMERGENCY';

export type AlertType = 'INFO' | 'WARNING' | 'URGENT' | 'EMERGENCY';

export type AlertStatus = 'pending' | 'sent' | 'read' | 'acknowledged' | 'dismissed';

export interface ActivityData {
  mood?: MoodType;
  type?: string; // for health measurements
  value?: number;
  systolic?: number;
  diastolic?: number;
  volume_ml?: number;
  question_id?: string;
  [key: string]: unknown;
}

export interface WellnessState {
  score: number;
  status: WellnessStatus;
  lastScoreAt: string | null;
  appOpensToday: number;
  streakDays: number;
  needsAttention: boolean;
  consecutiveNoResponse: number;
  consecutiveNegativeMood: number;
}

export interface ScoreBreakdown {
  consistency: number;
  mood: number;
  engagement: number;
  health: number;
}

export interface WellnessHistory {
  score: number;
  status: WellnessStatus;
  breakdown: ScoreBreakdown;
  calculatedAt: string;
}

export interface DailySummary {
  date: string;
  appOpens: number;
  moodChecks: number;
  questionsAnswered: number;
  questionsSkipped: number;
  healthMeasurements: number;
  moodPositive: number;
  moodNeutral: number;
  moodNegative: number;
  avgGlucose: number | null;
  avgBloodPressure: { systolic: number; diastolic: number } | null;
  avgWeight: number | null;
  totalWater: number | null;
  endOfDayScore: number | null;
  endOfDayStatus: WellnessStatus | null;
}

export interface CaregiverAlert {
  id: string;
  userId?: number;
  type: AlertType;
  status: AlertStatus;
  title: string;
  message: string;
  triggeredBy: string;
  contextData?: Record<string, unknown>;
  createdAt: string;
  sentAt: string | null;
  acknowledgedAt: string | null;
}

export interface PromptDecision {
  shouldPrompt: boolean;
  reason: string;
  promptType?: 'mood_check' | 'follow_up' | 'health_reminder';
}

// =====================================================
// API RESPONSES
// =====================================================

interface ActivityResponse {
  ok: boolean;
  activity: unknown;
  evaluation: {
    score: number;
    status: WellnessStatus;
    statusChanged: boolean;
  };
}

interface StateResponse {
  ok: boolean;
  state: WellnessState;
}

interface CalculateResponse {
  ok: boolean;
  score: number;
  status: WellnessStatus;
  breakdown: ScoreBreakdown;
  statusChanged: boolean;
  alertSent: boolean;
}

interface HistoryResponse {
  ok: boolean;
  history: WellnessHistory[];
}

interface SummaryResponse {
  ok: boolean;
  summaries: DailySummary[];
}

interface PromptResponse {
  ok: boolean;
  shouldPrompt: boolean;
  reason: string;
  promptType?: string;
}

interface AlertsResponse {
  ok: boolean;
  alerts: CaregiverAlert[];
}

interface HelpRequestResponse {
  ok: boolean;
  alertsSent: number;
  message: string;
}

interface AckAlertResponse {
  ok: boolean;
  alert: {
    id: string;
    status: AlertStatus;
    acknowledgedAt: string;
  };
}

// =====================================================
// API FUNCTIONS
// =====================================================

/**
 * Ghi lại hoạt động của user
 */
export async function logActivity(
  activityType: ActivityType,
  activityData: ActivityData = {},
  sessionId?: string
): Promise<ActivityResponse> {
  return apiClient<ActivityResponse>('/api/wellness/activity', {
    method: 'POST',
    body: {
      activity_type: activityType,
      activity_data: activityData,
      session_id: sessionId
    }
  });
}

/**
 * Lấy trạng thái wellness hiện tại
 */
export async function getWellnessState(): Promise<StateResponse> {
  return apiClient<StateResponse>('/api/wellness/state');
}

/**
 * Trigger tính điểm mới
 */
export async function calculateScore(checkAlert = true): Promise<CalculateResponse> {
  return apiClient<CalculateResponse>('/api/wellness/calculate', {
    method: 'POST',
    body: { checkAlert }
  });
}

/**
 * Lấy lịch sử điểm wellness
 */
export async function getWellnessHistory(days = 7): Promise<HistoryResponse> {
  return apiClient<HistoryResponse>(`/api/wellness/history?days=${days}`);
}

/**
 * Lấy tổng hợp hoạt động theo ngày
 */
export async function getDailySummaries(days = 7): Promise<SummaryResponse> {
  return apiClient<SummaryResponse>(`/api/wellness/summary?days=${days}`);
}

/**
 * Kiểm tra có nên prompt user không
 */
export async function checkShouldPrompt(): Promise<PromptResponse> {
  return apiClient<PromptResponse>('/api/wellness/should-prompt');
}

/**
 * Lấy alerts của user
 */
export async function getMyAlerts(status?: AlertStatus, limit = 20): Promise<AlertsResponse> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('limit', String(limit));
  
  return apiClient<AlertsResponse>(`/api/wellness/alerts?${params.toString()}`);
}

/**
 * Gửi yêu cầu giúp đỡ đến người thân
 */
export async function sendHelpRequest(message?: string): Promise<HelpRequestResponse> {
  return apiClient<HelpRequestResponse>('/api/wellness/help-request', {
    method: 'POST',
    body: { message }
  });
}

/**
 * [CAREGIVER] Lấy alerts cho người thân
 */
export async function getCaregiverAlerts(unreadOnly = false, limit = 20): Promise<AlertsResponse> {
  const params = new URLSearchParams();
  if (unreadOnly) params.append('unreadOnly', 'true');
  params.append('limit', String(limit));
  
  return apiClient<AlertsResponse>(`/api/wellness/caregiver/alerts?${params.toString()}`);
}

/**
 * [CAREGIVER] Acknowledge một alert
 */
export async function acknowledgeAlert(alertId: string): Promise<AckAlertResponse> {
  return apiClient<AckAlertResponse>(`/api/wellness/alerts/${alertId}/ack`, {
    method: 'POST'
  });
}

// =====================================================
// CONVENIENCE FUNCTIONS
// =====================================================

/**
 * Ghi lại mở app
 */
export function logAppOpen(sessionId?: string) {
  return logActivity('APP_OPEN', {}, sessionId);
}

/**
 * Ghi lại mood check
 */
export function logMoodCheck(mood: MoodType, sessionId?: string) {
  return logActivity('MOOD_CHECK', { mood }, sessionId);
}

/**
 * Ghi lại đo đường huyết
 */
export function logGlucoseMeasurement(value: number, sessionId?: string) {
  return logActivity('HEALTH_MEASUREMENT', { type: 'glucose', value }, sessionId);
}

/**
 * Ghi lại đo huyết áp
 */
export function logBloodPressureMeasurement(systolic: number, diastolic: number, sessionId?: string) {
  return logActivity('HEALTH_MEASUREMENT', { type: 'blood_pressure', systolic, diastolic }, sessionId);
}

/**
 * Ghi lại cân nặng
 */
export function logWeightMeasurement(value: number, sessionId?: string) {
  return logActivity('HEALTH_MEASUREMENT', { type: 'weight', value }, sessionId);
}

/**
 * Ghi lại uống nước
 */
export function logWaterIntake(volumeMl: number, sessionId?: string) {
  return logActivity('HEALTH_MEASUREMENT', { type: 'water', volume_ml: volumeMl }, sessionId);
}

/**
 * Ghi lại trả lời câu hỏi
 */
export function logQuestionAnswered(questionId?: string, sessionId?: string) {
  return logActivity('QUESTION_ANSWERED', { question_id: questionId }, sessionId);
}

/**
 * Ghi lại bỏ qua câu hỏi
 */
export function logQuestionSkipped(questionId?: string, sessionId?: string) {
  return logActivity('QUESTION_SKIPPED', { question_id: questionId }, sessionId);
}
