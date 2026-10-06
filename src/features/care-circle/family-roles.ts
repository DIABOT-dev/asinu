import type { TFunction } from 'i18next';
import type { DropdownOption } from '../../components/Dropdown';

const FAMILY_ROLES = [
  {
    id: 'than-nhan',
    labelKey: 'roleRelative',
    subtitleKey: 'roleRelativeDesc',
    legacyLabels: ['Thân nhân', 'Relative'],
  },
  {
    id: 'nguoi-cham-soc',
    labelKey: 'rolePrimaryCaregiver',
    subtitleKey: 'roleCaregiverDesc',
    legacyLabels: ['Người chăm sóc chính', 'Primary Caregiver'],
  },
] as const;

export function getFamilyRoleOptions(t: TFunction<'careCircle'>): DropdownOption[] {
  return FAMILY_ROLES.map((role) => ({
    id: role.id,
    label: t(role.labelKey),
    subtitle: t(role.subtitleKey),
  }));
}

export function getFamilyRoleLabel(value: string | undefined, t: TFunction<'careCircle'>): string {
  const role = FAMILY_ROLES.find((option) =>
    option.id === value || t(option.labelKey) === value ||
    option.legacyLabels.some((label) => label === value)
  );
  return role ? t(role.labelKey) : '';
}
