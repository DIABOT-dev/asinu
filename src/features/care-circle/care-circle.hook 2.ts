import { useCallback, useState } from 'react';
import { careCircleApi, CareCircleConnection, CareCircleInvitation, CreateInvitationPayload } from './care-circle.api';

export function useCareCircle() {
  const [invitations, setInvitations] = useState<CareCircleInvitation[]>([]);
  const [connections, setConnections] = useState<CareCircleConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Fetch both received and sent invitations
      const [received, sent] = await Promise.all([
        careCircleApi.getInvitations('received'),
        careCircleApi.getInvitations('sent')
      ]);
      console.log('[care-circle] Fetched received invitations:', received);
      console.log('[care-circle] Fetched sent invitations:', sent);
      // Combine and deduplicate by id
      const allInvitations = [...received, ...sent.filter(s => !received.find(r => r.id === s.id))];
      setInvitations(allInvitations);
    } catch (err: any) {
      console.error('[care-circle] fetchInvitations error:', err);
      setError(err.message || 'Không thể tải lời mời');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConnections = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await careCircleApi.getConnections();
      setConnections(data);
    } catch (err: any) {
      console.error('[care-circle] fetchConnections error:', err);
      setError(err.message || 'Không thể tải kết nối');
    } finally {
      setLoading(false);
    }
  }, []);

  const createInvitation = useCallback(async (payload: CreateInvitationPayload) => {
    try {
      console.log('[care-circle] createInvitation - calling API with payload:', payload);
      setLoading(true);
      setError(null);
      const invitation = await careCircleApi.createInvitation(payload);
      console.log('[care-circle] createInvitation - success, received:', invitation);
      setInvitations((prev) => [invitation, ...prev]);
      return invitation;
    } catch (err: any) {
      console.error('[care-circle] createInvitation error:', err);
      setError(err.message || 'Không thể tạo lời mời');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const acceptInvitation = useCallback(async (invitationId: string) => {
    try {
      setLoading(true);
      setError(null);
      const connection = await careCircleApi.acceptInvitation(invitationId);
      // Remove from invitations and add to connections
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
      setConnections((prev) => [connection, ...prev]);
      return connection;
    } catch (err: any) {
      console.error('[care-circle] acceptInvitation error:', err);
      setError(err.message || 'Không thể chấp nhận lời mời');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const rejectInvitation = useCallback(async (invitationId: string) => {
    try {
      setLoading(true);
      setError(null);
      await careCircleApi.rejectInvitation(invitationId);
      // Remove from invitations
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    } catch (err: any) {
      console.error('[care-circle] rejectInvitation error:', err);
      setError(err.message || 'Không thể từ chối lời mời');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteConnection = useCallback(async (connectionId: string) => {
    try {
      setLoading(true);
      setError(null);
      await careCircleApi.deleteConnection(connectionId);
      // Remove from connections
      setConnections((prev) => prev.filter((conn) => conn.id !== connectionId));
    } catch (err: any) {
      console.error('[care-circle] deleteConnection error:', err);
      setError(err.message || 'Không thể xóa kết nối');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConnection = useCallback(async (connectionId: string, updates: { relationship_type?: string; role?: string }) => {
    try {
      setLoading(true);
      setError(null);
      const updatedConnection = await careCircleApi.updateConnection(connectionId, updates);
      // Update in connections list
      setConnections((prev) => prev.map((conn) => conn.id === connectionId ? updatedConnection : conn));
      return updatedConnection;
    } catch (err: any) {
      console.error('[care-circle] updateConnection error:', err);
      setError(err.message || 'Không thể cập nhật kết nối');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchInvitations(), fetchConnections()]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchInvitations, fetchConnections]);

  return {
    invitations,
    connections,
    loading,
    refreshing,
    error,
    fetchInvitations,
    fetchConnections,
    createInvitation,
    acceptInvitation,
    rejectInvitation,
    deleteConnection,
    updateConnection,
    refresh
  };
}
