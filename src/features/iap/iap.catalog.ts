import type { IapProduct } from './iap.types';
import { Platform } from 'react-native';

/**
 * Display catalogue used when the backend or native Store is unavailable.
 * The backend remains authoritative for product IDs during a real purchase;
 * these values keep the plan comparison visible in local and review builds.
 */
export const FALLBACK_IAP_PRODUCTS: readonly IapProduct[] = [
  {
    id: Platform.OS === 'ios' ? 'asinu.premium.monthly' : 'asinu.antam2.monthly',
    plan_code: 'antam_2',
    plan_name: 'An Tâm 2',
    billing_period: 'monthly',
    plan_months: 1,
    protected_members: 2,
    consultation_credits: 0,
    display_price_vnd: 149000,
  },
  {
    id: Platform.OS === 'ios' ? 'asinu.premium.yearly' : 'asinu.antam2.yearly',
    plan_code: 'antam_2',
    plan_name: 'An Tâm 2',
    billing_period: 'yearly',
    plan_months: 12,
    protected_members: 2,
    consultation_credits: 2,
    display_price_vnd: 1199000,
  },
  {
    id: 'asinu.antam4.monthly',
    plan_code: 'antam_4',
    plan_name: 'An Tâm 4',
    billing_period: 'monthly',
    plan_months: 1,
    protected_members: 4,
    consultation_credits: 0,
    display_price_vnd: 199000,
  },
  {
    id: 'asinu.antam4.yearly',
    plan_code: 'antam_4',
    plan_name: 'An Tâm 4',
    billing_period: 'yearly',
    plan_months: 12,
    protected_members: 4,
    consultation_credits: 4,
    display_price_vnd: 1499000,
  },
  {
    id: 'asinu.antam8.monthly',
    plan_code: 'antam_8',
    plan_name: 'An Tâm 8',
    billing_period: 'monthly',
    plan_months: 1,
    protected_members: 8,
    consultation_credits: 0,
    display_price_vnd: 249000,
  },
  {
    id: 'asinu.antam8.yearly',
    plan_code: 'antam_8',
    plan_name: 'An Tâm 8',
    billing_period: 'yearly',
    plan_months: 12,
    protected_members: 8,
    consultation_credits: 8,
    display_price_vnd: 1799000,
  },
];
