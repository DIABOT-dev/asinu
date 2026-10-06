import type { CareCircleConnection } from './care-circle.api';

/** Consent is directional: sharing mine never grants access to theirs. */
export function getConnectionHealthAccess(connection: CareCircleConnection, userId?: string | number) {
  const requester = String(connection.requester_id) === String(userId);
  const addressee = String(connection.addressee_id) === String(userId);
  if (connection.status !== 'accepted' || (!requester && !addressee)) {
    return { sharingMine: false, canViewTheirs: false };
  }
  const requesterGrant = connection.permissions?.can_view_logs === true;
  const addresseeGrant = connection.addressee_can_view_logs === true;
  return {
    sharingMine: requester ? requesterGrant : addresseeGrant,
    canViewTheirs: requester ? addresseeGrant : requesterGrant,
  };
}
