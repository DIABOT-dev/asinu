import { apiClient } from '../../lib/apiClient';

export type CareCircleInvitation = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  requested_by: string;
  relationship_type?: string;
  role?: string;
  permissions: {
    can_view_logs: boolean;
    can_receive_alerts: boolean;
    can_ack_escalation: boolean;
  };
  requester_name?: string;
  addressee_name?: string;
  requester_full_name?: string;
  addressee_full_name?: string;
  requester_email?: string;
  addressee_email?: string;
  requester_phone?: string;
  addressee_phone?: string;
  created_at: string;
  updated_at: string;
};

export type CareCircleConnection = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'accepted';
  relationship_type?: string;
  role?: string;
  permissions: {
    can_view_logs: boolean;
    can_receive_alerts: boolean;
    can_ack_escalation: boolean;
  };
  requester_name?: string;
  addressee_name?: string;
  requester_full_name?: string;
  addressee_full_name?: string;
  requester_email?: string;
  addressee_email?: string;
  requester_phone?: string;
  addressee_phone?: string;
  created_at: string;
  updated_at: string;
};

export type CreateInvitationPayload = {
  addressee_id: string;
  relationship_type?: string;
  role?: string;
  permissions: {
    can_view_logs: boolean;
    can_receive_alerts: boolean;
    can_ack_escalation: boolean;
  };
};

export const careCircleApi = {
  // Create invitation
  async createInvitation(payload: CreateInvitationPayload) {
    console.log('[careCircleApi] createInvitation called with payload:', payload);
    const response = await apiClient<{ ok: boolean; invitation: CareCircleInvitation }>(
      '/api/care-circle/invitations',
      { method: 'POST', body: payload }
    );
    console.log('[careCircleApi] createInvitation response:', response);
    return response.invitation;
  },

  // Get invitations (sent or received)
  async getInvitations(direction?: 'sent' | 'received') {
    const url = direction 
      ? `/api/care-circle/invitations?direction=${direction}`
      : '/api/care-circle/invitations';
    const response = await apiClient<{ ok: boolean; invitations: CareCircleInvitation[] }>(url);
    return response.invitations;
  },

  // Accept invitation
  async acceptInvitation(invitationId: string) {
    const response = await apiClient<{ ok: boolean; connection: CareCircleConnection }>(
      `/api/care-circle/invitations/${invitationId}/accept`,
      { method: 'POST' }
    );
    return response.connection;
  },

  // Reject invitation
  async rejectInvitation(invitationId: string) {
    const response = await apiClient<{ ok: boolean; message: string }>(
      `/api/care-circle/invitations/${invitationId}/reject`,
      { method: 'POST' }
    );
    return response;
  },

  // Get connections
  async getConnections() {
    const response = await apiClient<{ ok: boolean; connections: CareCircleConnection[] }>(
      '/api/care-circle/connections'
    );
    return response.connections;
  },

  // Delete connection
  async deleteConnection(connectionId: string) {
    const response = await apiClient<{ ok: boolean; message: string }>(
      `/api/care-circle/connections/${connectionId}`,
      { method: 'DELETE' }
    );
    return response;
  },

  // Update connection
  async updateConnection(connectionId: string, updates: { relationship_type?: string; role?: string }) {
    const response = await apiClient<{ ok: boolean; connection: CareCircleConnection }>(
      `/api/care-circle/connections/${connectionId}`,
      { 
        method: 'PUT',
        body: JSON.stringify(updates)
      }
    );
    return response.connection;
  },

  // Search users for invitation
  async searchUsers(query: string) {
    const response = await apiClient<{ 
      ok: boolean; 
      users: Array<{
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
      }>;
    }>(`/api/auth/users/search?q=${encodeURIComponent(query)}`);
    return response.users;
  }
};
