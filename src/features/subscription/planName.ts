type TranslatePlanName = (key: string) => string;

/** Store and API product names are metadata, not localized UI copy. */
export function localizedPlanName(
  planCode: string | null | undefined,
  t: TranslatePlanName,
): string {
  switch (planCode) {
    case 'antam_2':
      return t('planNames.antam2');
    case 'antam_4':
      return t('planNames.antam4');
    case 'antam_8':
      return t('planNames.antam8');
    default:
      return t('planNames.free');
  }
}
