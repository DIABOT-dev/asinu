import type { GuideStep } from './guidance.model';

export type GuidanceClip = 'welcome' | GuideStep;

// Literal requires let Metro bundle every Tuấn Anh recording for offline use.
export const guidanceAssets: Record<'vi' | 'en', Record<GuidanceClip, number>> = {
  vi: {
    welcome: require('../../../assets/sounds/guidance/vi_welcome.mp3'),
    'home.fine': require('../../../assets/sounds/guidance/vi_home_fine.mp3'),
    'home.unwell': require('../../../assets/sounds/guidance/vi_home_unwell.mp3'),
    'checkin.choices': require('../../../assets/sounds/guidance/vi_checkin_choices.mp3'),
    'checkin.other': require('../../../assets/sounds/guidance/vi_checkin_other.mp3'),
    'home.suggestions': require('../../../assets/sounds/guidance/vi_home_suggestions.mp3'),
    'circle.add': require('../../../assets/sounds/guidance/vi_circle_add.mp3'),
    'circle.phone': require('../../../assets/sounds/guidance/vi_circle_phone.mp3'),
    'circle.relationship': require('../../../assets/sounds/guidance/vi_circle_relationship.mp3'),
    'circle.send': require('../../../assets/sounds/guidance/vi_circle_send.mp3'),
    'circle.member': require('../../../assets/sounds/guidance/vi_circle_member.mp3'),
  },
  en: {
    welcome: require('../../../assets/sounds/guidance/en_welcome.mp3'),
    'home.fine': require('../../../assets/sounds/guidance/en_home_fine.mp3'),
    'home.unwell': require('../../../assets/sounds/guidance/en_home_unwell.mp3'),
    'checkin.choices': require('../../../assets/sounds/guidance/en_checkin_choices.mp3'),
    'checkin.other': require('../../../assets/sounds/guidance/en_checkin_other.mp3'),
    'home.suggestions': require('../../../assets/sounds/guidance/en_home_suggestions.mp3'),
    'circle.add': require('../../../assets/sounds/guidance/en_circle_add.mp3'),
    'circle.phone': require('../../../assets/sounds/guidance/en_circle_phone.mp3'),
    'circle.relationship': require('../../../assets/sounds/guidance/en_circle_relationship.mp3'),
    'circle.send': require('../../../assets/sounds/guidance/en_circle_send.mp3'),
    'circle.member': require('../../../assets/sounds/guidance/en_circle_member.mp3'),
  },
};
