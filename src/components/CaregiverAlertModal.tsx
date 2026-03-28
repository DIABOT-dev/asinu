/**
 * CaregiverAlertModal
 * Hien khi nguoi than co alert chua xac nhan.
 * Cho phep chon: "Da biet" | "Dang den" | "Da goi dien"
 */
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { apiClient } from '../lib/apiClient';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';
import { showToast } from '../stores/toast.store';

interface PendingAlert {
  alertId: number;
  alertType: 'caregiver_alert' | 'emergency';
  patientName: string;
  currentStatus: string;
  flowState: string;
  sentAt: string;
}

export function CaregiverAlertModal() {
  const { t } = useTranslation('common');
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography, isDark]);

  const STATUS_LABEL: Record<string, string> = {
    fine: t('careAlertStatusFine'),
    tired: t('careAlertStatusTired'),
    very_tired: t('careAlertStatusVeryTired'),
  };

  const ACTIONS = [
    { key: 'seen',       label: t('careAlertActionSeen'),    icon: 'checkmark-circle-outline' as const, color: '#16a34a' },
    { key: 'on_my_way',  label: t('careAlertActionOnWay'),   icon: 'walk-outline'             as const, color: '#2563eb' },
    { key: 'called',     label: t('careAlertActionCalled'),  icon: 'call-outline'             as const, color: '#7c3aed' },
  ];

  const [alerts, setAlerts] = useState<PendingAlert[]>([]);
  const [current, setCurrent] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  const fetchPendingAlerts = useCallback(() => {
    apiClient<{ ok: boolean; alerts: PendingAlert[] }>('/api/mobile/checkin/pending-alerts')
      .then(res => {
        if (res.alerts?.length) {
          setAlerts(res.alerts);
          setCurrent(0);
        }
      })
      .catch(() => {});
  }, []);

  // Fetch on mount
  useEffect(() => { fetchPendingAlerts(); }, [fetchPendingAlerts]);

  // Re-fetch every time app comes back to foreground (e.g. user tapped notification)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        fetchPendingAlerts();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [fetchPendingAlerts]);

  const alert = alerts[current];
  if (!alert) return null;

  const isEmergency = alert.alertType === 'emergency';

  const handleConfirm = async (action: string) => {
    setConfirming(true);
    try {
      await apiClient('/api/mobile/checkin/confirm-alert', {
        method: 'POST',
        body: { alert_id: alert.alertId, action },
      });
      // Move to next alert or close
      if (current + 1 < alerts.length) {
        setCurrent(c => c + 1);
      } else {
        setAlerts([]);
      }
    } catch {
      showToast(t('error'), 'error');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={[styles.card, isEmergency && styles.cardEmergency]}>
          {/* Header */}
          <View style={styles.iconRow}>
            <Ionicons
              name={isEmergency ? 'warning' : 'heart-half'}
              size={28}
              color={isEmergency ? '#dc2626' : '#d97706'}
            />
            {alerts.length > 1 && (
              <Text style={styles.counter}>{current + 1}/{alerts.length}</Text>
            )}
          </View>

          {/* Content */}
          <Text style={styles.title}>
            {isEmergency ? t('careAlertEmergency') : t('careAlertAttention')}
          </Text>
          <Text style={styles.body}>
            <Text style={{ fontWeight: '700' }}>{alert.patientName}</Text>
            {isEmergency
              ? ` ${t('careAlertNeedHelp')}`
              : ` ${t('careAlertFeeling')} ${STATUS_LABEL[alert.currentStatus] || t('careAlertUnwell')} ${t('careAlertNoResponse')}`
            }
          </Text>
          <Text style={styles.time}>
            {t('careAlertSentAt')} {new Date(alert.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </Text>

          {/* Actions */}
          {confirming ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.lg }} />
          ) : (
            <View style={styles.actions}>
              {ACTIONS.map(a => (
                <Pressable
                  key={a.key}
                  style={({ pressed }) => [styles.actionBtn, { borderColor: a.color }, pressed && { opacity: 0.8 }]}
                  onPress={() => handleConfirm(a.key)}
                >
                  <Ionicons name={a.icon} size={18} color={a.color} />
                  <Text style={[styles.actionText, { color: a.color }]}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.55)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.xl,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.xl,
      padding: spacing.xl,
      width: '100%',
      gap: spacing.md,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 16,
    },
    cardEmergency: {
      borderWidth: 1.5,
      borderColor: '#dc2626',
    },
    iconRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    counter: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
      fontWeight: '600',
    },
    title: {
      fontSize: typography.size.lg,
      fontWeight: '800',
      color: colors.textPrimary,
    },
    body: {
      fontSize: typography.size.sm,
      color: colors.textPrimary,
      lineHeight: 22,
    },
    time: {
      fontSize: typography.size.xs,
      color: colors.textSecondary,
    },
    actions: {
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderWidth: 1.5,
      borderRadius: radius.full,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    actionText: {
      fontSize: typography.size.sm,
      fontWeight: '700',
    },
  });
}
