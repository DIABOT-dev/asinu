import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../features/auth/auth.store';
import { type CareCircleInvitation, useCareCircle } from '../features/care-circle';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { showToast } from '../stores/toast.store';
import { colors, radius, spacing } from '../styles';
import { ScaledText as Text } from './ScaledText';

type Props = { enabled?: boolean };

function requesterName(invitation: CareCircleInvitation, fallbackName: string) {
  return (
    invitation.requester_full_name ||
    invitation.requester_name ||
    invitation.requester_phone ||
    invitation.requester_email ||
    fallbackName
  );
}

/**
 * Global consent prompt for received Care Circle invitations.
 * It is mounted for the authenticated app lifetime so older users do not
 * need to discover the Care Circle screen before they can accept a request.
 */
export function CareCircleInvitationModal({ enabled = true }: Props) {
  const { t } = useTranslation('careCircle');
  const profile = useAuthStore((state) => state.profile);
  const token = useAuthStore((state) => state.token);
  const invitations = useCareCircle((state) => state.invitations);
  const fetchInvitations = useCareCircle((state) => state.fetchInvitations);
  const acceptInvitation = useCareCircle((state) => state.acceptInvitation);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const appState = useRef(AppState.currentState);
  const typography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(typography), [isDark, typography]);

  const pending = useMemo(
    () =>
      invitations.find(
        (item) =>
          item.status === 'pending' &&
          String(item.addressee_id) === String(profile?.id) &&
          !dismissedIds.includes(item.id)
      ) ?? null,
    [dismissedIds, invitations, profile?.id]
  );

  const refresh = useCallback(() => {
    if (!token || !profile?.id) return;
    void fetchInvitations(true);
  }, [fetchInvitations, profile?.id, token]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      const returnedToApp = appState.current !== 'active' && nextState === 'active';
      appState.current = nextState;
      if (returnedToApp) {
        setDismissedIds([]);
        setError(null);
        refresh();
      }
    });
    return () => subscription.remove();
  }, [refresh]);

  const accept = useCallback(async () => {
    if (!pending || accepting) return;
    setAccepting(true);
    setError(null);
    try {
      await acceptInvitation(pending.id);
      showToast(t('quickAcceptSuccess', { name: requesterName(pending, t('quickUnknownSender')) }), 'success');
    } catch {
      setError(t('quickAcceptError'));
    } finally {
      setAccepting(false);
    }
  }, [acceptInvitation, accepting, pending, t]);

  const postpone = useCallback(() => {
    if (pending) setDismissedIds((current) => [...new Set([...current, pending.id])]);
    setError(null);
  }, [pending]);

  if (!pending) return null;
  const name = requesterName(pending, t('quickUnknownSender'));

  return (
    <Modal
      visible={enabled}
      transparent
      animationType="fade"
      onRequestClose={postpone}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.card} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Ionicons name="people" size={34} color={colors.primary} />
          </View>
          <Text style={styles.eyebrow}>{t('quickInviteEyebrow')}</Text>
          <Text style={styles.title}>{t('quickInviteTitle')}</Text>

          <View style={styles.personRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{name.trim().charAt(0).toUpperCase() || '?'}</Text>
            </View>
            <View style={styles.personCopy}>
              <Text style={styles.personName} numberOfLines={2}>{name}</Text>
              <Text style={styles.personMeta}>{t('quickInviteWantsToConnect')}</Text>
            </View>
          </View>

          <View style={styles.explanation}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.primaryDark} />
            <Text style={styles.explanationText}>{t('quickInviteExplanation')}</Text>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('quickAccept')}
            style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
            disabled={accepting}
            onPress={() => void accept()}
          >
            {accepting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={25} color="#fff" />
                <Text style={styles.acceptText}>{t('quickAccept')}</Text>
              </>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('quickLater')}
            style={({ pressed }) => [styles.laterButton, pressed && styles.pressed]}
            disabled={accepting}
            onPress={postpone}
          >
            <Text style={styles.laterText}>{t('quickLater')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
      backgroundColor: colors.overlay,
    },
    card: {
      width: '100%',
      maxWidth: 380,
      padding: spacing.xl,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    iconWrap: {
      width: 68,
      height: 68,
      alignSelf: 'center',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 24,
      marginBottom: spacing.md,
    },
    eyebrow: {
      textAlign: 'center',
      color: colors.primaryDark,
      fontSize: typography.size.xs,
      fontWeight: '800',
      letterSpacing: 0.5,
    },
    title: {
      marginTop: spacing.xs,
      textAlign: 'center',
      color: colors.textPrimary,
      fontSize: typography.size.xl,
      lineHeight: 32,
      fontWeight: '900',
    },
    personRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginTop: spacing.lg,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceMuted,
    },
    avatar: {
      width: 52,
      height: 52,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 18,
      backgroundColor: colors.primary,
    },
    avatarText: { color: '#fff', fontSize: typography.size.lg, fontWeight: '900' },
    personCopy: { flex: 1 },
    personName: { color: colors.textPrimary, fontSize: typography.size.md, fontWeight: '900' },
    personMeta: { marginTop: 3, color: colors.textSecondary, fontSize: typography.size.sm },
    explanation: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      marginTop: spacing.md,
      padding: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: colors.primaryLight,
    },
    explanationText: {
      flex: 1,
      color: colors.primaryDark,
      fontSize: typography.size.sm,
      lineHeight: 21,
      fontWeight: '600',
    },
    error: {
      marginTop: spacing.md,
      color: colors.danger,
      textAlign: 'center',
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
    acceptButton: {
      minHeight: 58,
      marginTop: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    acceptText: { color: '#fff', fontSize: typography.size.md, fontWeight: '900' },
    laterButton: {
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: spacing.xs,
    },
    laterText: { color: colors.textSecondary, fontSize: typography.size.sm, fontWeight: '700' },
    pressed: { opacity: 0.78 },
  });
}
