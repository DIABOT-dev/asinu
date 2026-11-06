import type { ComponentProps } from 'react';
import type { MaterialCommunityIcons } from '@expo/vector-icons';

type TriageOptionIcon = ComponentProps<typeof MaterialCommunityIcons>['name'];

// Presentation only: labels and icons never change the answer sent to the API.
export function formatTriageOptionLabel(value: string): string {
  // Keep the observable warning sign visible; a suspected diagnosis is an
  // internal annotation, while the original value still goes to the API.
  return value.trim().normalize('NFC')
    .replace(/\s*\(nghi suy tim\)/giu, '')
    .replace(/\p{L}/u, letter => letter.toLocaleUpperCase());
}

const ICON_RULES: Array<[RegExp, TriageOptionIcon]> = [
  [/^(khong co(?:\b|$)|none$|no new symptoms$|nothing$)/, 'check-circle-outline'],
  [/^(khong ro|khong biet|unsure|unknown|not sure)/, 'help-circle-outline'],
  [/^(khac|other)(?:\b|$)/, 'text-box-outline'],
  [/do hon|do dan|better|improv/, 'trending-down'],
  [/nang hon|worse|worsening/, 'trending-up'],
  [/van nhu cu|about the same|unchanged/, 'arrow-right'],
  [/vua moi|gio truoc|tu sang|tu hom qua|ngay nay|just now|hours? ago|since |for a few days/, 'clock-outline'],
  [/trieu chung moi|new symptoms/, 'clipboard-plus-outline'],
  [/mat ngu|kho ngu|insomnia|trouble sleeping/, 'sleep-off'],
  [/buon ba|sadness/, 'emoticon-sad-outline'],
  [/lo au|cang thang|anxiety|stress/, 'brain'],
  [/met moi|fatigue/, 'battery-low'],
  [/chong mat|dizziness/, 'head-sync-outline'],
  [/hoa mat|mo mat|thi luc|nhin doi|blurred vision|light-headed|vision loss/, 'eye-outline'],
  [/u tai|ngua tai|tinnitus|hearing/, 'ear-hearing'],
  [/dau dau|dau nua dau|headache|migraine/, 'head-alert-outline'],
  [/dau hong|sore throat/, 'account-voice'],
  [/kho tho|\bho\b|breath|cough/, 'lungs'],
  [/dau nguc|tuc nguc|hoi hop|tim dap|chest|palpitation|heartbeat/, 'heart-pulse'],
  [/buon non|\bnon\b|nausea|vomit/, 'emoticon-sick-outline'],
  [/tieu chay|tao bon|di ngoai|diarrhea|constipation/, 'toilet'],
  [/dau bung|day hoi|kho tieu|chuong bung|stomach|abdom|bloat|indigestion/, 'stomach'],
  [/te tay|te chan|te nua nguoi|numb|tingling/, 'hand-back-right-outline'],
  [/dau khop|sung khop|joint/, 'bone'],
  [/dau vai|chuot rut|yeu co|shoulder|cramp|muscle weakness/, 'arm-flex-outline'],
  [/dau lung|back pain/, 'human'],
  [/bi nga|\bfall\b/, 'human-cane'],
  [/phat ban|ngua|rash|itch/, 'allergy'],
  [/vang da|nong rat|vet bam|da kho|yellow skin|burning|bruise|dry skin/, 'hand-back-right-outline'],
  [/on lanh|chills/, 'snowflake-thermometer'],
  [/va mo hoi|sweat/, 'water-outline'],
  [/run ray|trembl/, 'vibrate'],
  [/dau nhuc toan than|body aches/, 'human'],
  [/\bsot\b|fever/, 'thermometer'],
  [/\bngat\b|lu mo|faint|drowsy/, 'head-alert-outline'],
  [/khat nuoc|uong nuoc|thirst|drank water/, 'water-outline'],
];

export function getTriageOptionIcon(value: string): TriageOptionIcon {
  const normalized = value.toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
  return ICON_RULES.find(([pattern]) => pattern.test(normalized))?.[1] || 'clipboard-text-outline';
}
