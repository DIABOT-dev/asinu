import type { CareCircleConnection } from './care-circle.api';

export type ConnectionEditValues = {
  relationship_type?: string;
  role?: string;
  permissions: CareCircleConnection['permissions'];
};

export function getConnectionEditChanges(
  saved: ConnectionEditValues,
  draft: ConnectionEditValues,
) {
  const updates: { relationship_type?: string; role?: string } = {};
  if (draft.relationship_type !== saved.relationship_type) {
    updates.relationship_type = draft.relationship_type;
  }
  if (draft.role !== saved.role) {
    updates.role = draft.role;
  }

  const permissionsChanged = (
    Object.keys(draft.permissions) as Array<keyof ConnectionEditValues['permissions']>
  ).some(key => draft.permissions[key] !== saved.permissions[key]);

  return {
    updates,
    permissionsChanged,
    hasChanges: Object.keys(updates).length > 0 || permissionsChanged,
  };
}
