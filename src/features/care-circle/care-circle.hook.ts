import { useCallback, useState } from 'react';
import i18n from '../../i18n';
import { careCircleApi, CareCircleConnection, CareCircleInvitation, CreateInvitationPayload } from './care-circle.api';

const t = (key: string) => i18n.t(key, { ns: 'careCircle' });

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


      // Combine and deduplicate by id
      const allInvitations = [...received, ...sent.filter(s => !received.find(r => r.id === s.id))];
      setInvitations(allInvitations);
    } catch (err: any) {

      setError(err.message || t('cannotLoadInvitations'));
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

      setError(err.message || t('cannotLoadConnections'));
    } finally {
      setLoading(false);
    }
  }, []);

  const createInvitation = useCallback(async (payload: CreateInvitationPayload) => {
    try {

      setLoading(true);
      setError(null);
      const invitation = await careCircleApi.createInvitation(payload);

      setInvitations((prev) => [invitation, ...prev]);
      return invitation;
    } catch (err: any) {

      setError(err.message || t('cannotCreateInvitation'));
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

      setError(err.message || t('cannotAcceptInvitation'));
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

      setError(err.message || t('cannotRejectInvitation'));
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

      setError(err.message || t('cannotDeleteConnection'));
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

      setError(err.message || t('cannotUpdateConnection'));
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
