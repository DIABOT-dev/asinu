import { create } from 'zustand';
import i18n from '../../i18n';
import {
  careCircleApi,
  CareCircleConnection,
  CareCircleInvitation,
  CreateInvitationPayload,
} from './care-circle.api';

const t = (key: string) => i18n.t(key, { ns: 'careCircle' });

interface CareCircleStore {
  invitations: CareCircleInvitation[];
  connections: CareCircleConnection[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;

  fetchInvitations: (silent?: boolean) => Promise<void>;
  fetchConnections: (silent?: boolean) => Promise<void>;
  createInvitation: (payload: CreateInvitationPayload) => Promise<CareCircleInvitation>;
  cancelInvitation: (invitationId: string) => Promise<void>;
  acceptInvitation: (invitationId: string) => Promise<CareCircleConnection>;
  rejectInvitation: (invitationId: string) => Promise<void>;
  deleteConnection: (connectionId: string) => Promise<void>;
  updateConnection: (
    connectionId: string,
    updates: { relationship_type?: string; role?: string }
  ) => Promise<CareCircleConnection>;
  updatePermissions: (
    connectionId: string,
    permissions: { can_view_logs: boolean; can_receive_alerts: boolean; can_ack_escalation: boolean }
  ) => Promise<CareCircleConnection>;
  refresh: () => Promise<void>;
}

// Shared zustand store — mọi screen gọi useCareCircle() cùng đọc/ghi 1
// nguồn dữ liệu, optimistic update từ invite hiển thị ngay ở care-circle.
export const useCareCircle = create<CareCircleStore>((set, get) => ({
  invitations: [],
  connections: [],
  loading: false,
  refreshing: false,
  error: null,

  fetchInvitations: async (silent = false) => {
    try {
      if (!silent) set({ loading: true, error: null });
      const [received, sent] = await Promise.all([
        careCircleApi.getInvitations('received'),
        careCircleApi.getInvitations('sent'),
      ]);
      const allInvitations = [
        ...received,
        ...sent.filter((s) => !received.find((r) => r.id === s.id)),
      ];
      set({ invitations: allInvitations });
    } catch (err: any) {
      set({ error: err?.message || t('cannotLoadInvitations') });
    } finally {
      if (!silent) set({ loading: false });
    }
  },

  fetchConnections: async (silent = false) => {
    try {
      if (!silent) set({ loading: true, error: null });
      const data = await careCircleApi.getConnections();
      set({ connections: data });
    } catch (err: any) {
      set({ error: err?.message || t('cannotLoadConnections') });
    } finally {
      if (!silent) set({ loading: false });
    }
  },

  createInvitation: async (payload) => {
    try {
      set({ loading: true, error: null });
      const invitation = await careCircleApi.createInvitation(payload);
      // Optimistic insert — bất kỳ screen nào đang subscribe state này đều
      // thấy lời mời mới ngay lập tức, không cần refetch.
      set({ invitations: [invitation, ...get().invitations] });
      return invitation;
    } catch (err: any) {
      set({ error: err?.message || t('cannotCreateInvitation') });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  cancelInvitation: async (invitationId) => {
    try {
      set({ loading: true, error: null });
      await careCircleApi.cancelInvitation(invitationId);
      set({ invitations: get().invitations.filter((inv) => inv.id !== invitationId) });
    } catch (err: any) {
      set({ error: err?.message || t('cannotCancelInvitation') });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  acceptInvitation: async (invitationId) => {
    try {
      set({ loading: true, error: null });
      const connection = await careCircleApi.acceptInvitation(invitationId);
      set({
        invitations: get().invitations.filter((inv) => inv.id !== invitationId),
        connections: [connection, ...get().connections],
      });
      return connection;
    } catch (err: any) {
      set({ error: err?.message || t('cannotAcceptInvitation') });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  rejectInvitation: async (invitationId) => {
    try {
      set({ loading: true, error: null });
      await careCircleApi.rejectInvitation(invitationId);
      set({ invitations: get().invitations.filter((inv) => inv.id !== invitationId) });
    } catch (err: any) {
      set({ error: err?.message || t('cannotRejectInvitation') });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  deleteConnection: async (connectionId) => {
    try {
      set({ loading: true, error: null });
      await careCircleApi.deleteConnection(connectionId);
      set({ connections: get().connections.filter((conn) => conn.id !== connectionId) });
    } catch (err: any) {
      set({ error: err?.message || t('cannotDeleteConnection') });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updatePermissions: async (connectionId, permissions) => {
    try {
      set({ loading: true, error: null });
      const updatedConnection = await careCircleApi.updatePermissions(connectionId, permissions);
      set({
        connections: get().connections.map((conn) =>
          conn.id === connectionId ? { ...conn, ...updatedConnection } : conn
        ),
      });
      return updatedConnection;
    } catch (err: any) {
      set({ error: err?.message || t('cannotUpdateConnection') });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  updateConnection: async (connectionId, updates) => {
    try {
      set({ loading: true, error: null });
      const updatedConnection = await careCircleApi.updateConnection(connectionId, updates);
      set({
        connections: get().connections.map((conn) =>
          conn.id === connectionId ? { ...conn, ...updatedConnection } : conn
        ),
      });
      return updatedConnection;
    } catch (err: any) {
      set({ error: err?.message || t('cannotUpdateConnection') });
      throw err;
    } finally {
      set({ loading: false });
    }
  },

  refresh: async () => {
    set({ refreshing: true });
    try {
      await Promise.all([
        get().fetchInvitations(true),
        get().fetchConnections(true),
      ]);
    } finally {
      set({ refreshing: false });
    }
  },
}));
