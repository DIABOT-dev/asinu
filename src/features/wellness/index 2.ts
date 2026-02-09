/**
 * Wellness Monitoring Feature
 * Re-export all wellness related modules
 */

// API
export * from './api/wellness.api';

// Store
export {
    useCaregiverAlertsCount, useWellnessPrompt, useWellnessStatus, useWellnessStore
} from './store/wellness.store';

// Provider
export { WellnessProvider, useWellness } from './providers/WellnessProvider';

// Types (re-export from API)
export type {
    ActivityData, ActivityType, AlertStatus, AlertType, CaregiverAlert, DailySummary, MoodType, PromptDecision, ScoreBreakdown,
    WellnessHistory, WellnessState, WellnessStatus
} from './api/wellness.api';

