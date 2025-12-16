import { Profile } from './auth.store';

export const buildBypassProfile = (): Profile => ({
  id: 'dev-user',
  name: 'Dev Caregiver',
  email: 'dev@example.com',
  phone: '+84 912 345 678',
  relationship: 'Con gái chăm sóc bố',
  avatarUrl: undefined
});
