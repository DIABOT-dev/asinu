import type { TFunction } from 'i18next';

export const DEFAULT_FAMILY_ROLE = 'than-nhan' as const;

const FAMILY_ROLES = [
  {
    id: 'than-nhan',
    labelKey: 'roleRelative',
    subtitleKey: 'roleRelativeDesc',
    legacyLabels: ['Thân nhân', 'Relative', 'Người thân', 'Family member'],
  },
  {
    id: 'nguoi-cham-soc',
    labelKey: 'rolePrimaryCaregiver',
    subtitleKey: 'roleCaregiverDesc',
    legacyLabels: ['Người chăm sóc chính', 'Primary Caregiver'],
  },
] as const;

export function getFamilyRoleLabel(value: string | undefined, t: TFunction<'careCircle'>): string {
  const role = FAMILY_ROLES.find((option) =>
    option.id === value || t(option.labelKey) === value ||
    option.legacyLabels.some((label) => label === value)
  );
  // Old caregiver labels remain readable, but there is only one family role now.
  return role || !value ? t('roleRelative') : '';
}
