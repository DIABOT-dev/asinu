// Each entry is a fixed, read-only example, never a live check-in session.
export const CHECKIN_UI_PREVIEWS = [
  { id: 'checkin-status', key: 'status', icon: 'heart-outline' },
  { id: 'checkin-followup', key: 'followup', icon: 'moon-outline' },
  { id: 'checkin-location', key: 'location', icon: 'body-outline' },
  { id: 'checkin-multiple', key: 'multiple', icon: 'checkbox-outline' },
  { id: 'checkin-grouped', key: 'grouped', icon: 'list-outline' },
  { id: 'checkin-single', key: 'single', icon: 'radio-button-on-outline' },
  { id: 'checkin-text', key: 'text', icon: 'mic-outline' },
  { id: 'checkin-loading', key: 'loading', icon: 'hourglass-outline' },
  { id: 'checkin-result-fine', key: 'fine', icon: 'checkmark-circle-outline' },
  { id: 'checkin-result-low', key: 'low', icon: 'leaf-outline' },
  { id: 'checkin-result-medium', key: 'medium', icon: 'information-circle-outline' },
  { id: 'checkin-result-high', key: 'high', icon: 'alert-circle-outline' },
  { id: 'checkin-result-emergency', key: 'emergency', icon: 'warning-outline' },
  { id: 'checkin-result-no-caregiver', key: 'noCaregiver', icon: 'people-outline' },
  { id: 'checkin-result-followup', key: 'followupResult', icon: 'sunny-outline' },
] as const;

export type CheckinUiPreviewId = (typeof CHECKIN_UI_PREVIEWS)[number]['id'];
