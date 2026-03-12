import i18n from '../../i18n';
import { Profile } from './auth.store';

export const buildBypassProfile = (): Profile => ({
  id: 'dev-user',
  name: i18n.t('devUser', { ns: 'auth' }),
  email: 'dev@example.com',
  phone: '0912345678',
  relationship: i18n.t('devRelationship', { ns: 'auth' }),
  avatarUrl: undefined
});
