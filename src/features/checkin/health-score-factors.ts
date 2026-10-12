import type { Ionicons } from '@expo/vector-icons';

type HealthScoreFactor = {
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

export const HEALTH_SCORE_FACTORS: Record<string, HealthScoreFactor> = {
  status_tired: { labelKey: 'healthFactorStatusTired', icon: 'bed-outline', color: '#d97706' },
  triage_severity_medium: { labelKey: 'healthFactorSeverityMedium', icon: 'eye-outline', color: '#d97706' },
  triage_severity_high: { labelKey: 'healthFactorSeverityHigh', icon: 'alert-circle-outline', color: '#dc2626' },
  triage_severity_emergency: { labelKey: 'healthFactorSeverityEmergency', icon: 'warning', color: '#991b1b' },
  glucose_high: { labelKey: 'healthFactorGlucoseHigh', icon: 'water-outline', color: '#d97706' },
  glucose_very_high: { labelKey: 'healthFactorGlucoseVeryHigh', icon: 'water', color: '#dc2626' },
  glucose_very_low: { labelKey: 'healthFactorGlucoseVeryLow', icon: 'water', color: '#dc2626' },
  systolic_high: { labelKey: 'healthFactorSystolicHigh', icon: 'heart-outline', color: '#d97706' },
  systolic_very_high: { labelKey: 'healthFactorSystolicVeryHigh', icon: 'heart', color: '#dc2626' },
  emergency_triggered: { labelKey: 'healthFactorEmergencyTriggered', icon: 'warning-outline', color: '#dc2626' },
};
