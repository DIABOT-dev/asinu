/**
 * CaregiverAlertModal
 * Hiện khi người thân có alert chưa xác nhận.
 * Cho phép chọn: "Đã biết" | "Đang đến" | "Đã gọi điện"
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { apiClient } from '../lib/apiClient';
import { colors, radius, spacing } from '../styles';

interface PendingAlert {
  alertId: number;
  alertType: 'caregiver_alert' | 'emergency';
  patientName: string;
  currentStatus: string;
  flowState: string;
  sentAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  fine: 'ổn',
  tired: 'hơi mệt',
  very_tired: 'rất mệt',
};

const ACTIONS = [
  { key: 'seen',       label: 'Đã biết rồi',      icon: 'checkmark-circle-outline' as const, color: '#16a34a' },
  { key: 'on_my_way',  label: 'Đang đến gặp',      icon: 'walk-outline'             as const, color: '#2563eb' },
  { key: 'called',     label: 'Đã gọi điện',       icon: 'call-outline'             as const, color: '#7c3aed' },
];

export function CaregiverAlertModal() {
  const [alerts, setAlerts] = useState<PendingAlert[]>([]);
  const [current, setCurrent] = useState(0);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    apiClient<{ ok: boolean; alerts: PendingAlert[] }>('/api/mobile/checkin/pending-alerts')
      .then(res => { if (res.alerts?.length) setAlerts(res.alerts); })
      .catch(() => {});
  }, []);

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
            <View style={[styles.iconWrap, { backgroundColor: isEmergency ? '#fee2e2' : '#fef3c7' }]}>
              <Ionicons
                name={isEmergency ? 'warning' : 'heart-half'}
                size={28}
                color={isEmergency ? '#dc2626' : '#d97706'}
              />
            </View>
            {alerts.length > 1 && (
              <Text style={styles.counter}>{current + 1}/{alerts.length}</Text>
            )}
          </View>

          {/* Content */}
          <Text style={styles.title}>
            {isEmergency ? 'Khẩn cấp!' : 'Cần chú ý'}
          </Text>
          <Text style={styles.body}>
            <Text style={{ fontWeight: '700' }}>{alert.patientName}</Text>
            {isEmergency
              ? ' đang cần giúp đỡ khẩn cấp. Vui lòng phản hồi ngay.'
              : ` đang cảm thấy ${STATUS_LABEL[alert.currentStatus] || 'không khoẻ'} và chưa phản hồi Asinu.`
            }
          </Text>
          <Text style={styles.time}>
            Gửi lúc {new Date(alert.sentAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
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

const styles = StyleSheet.create({
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
    borderWidth: 2,
    borderColor: '#dc2626',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counter: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  body: {
    fontSize: 15,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  time: {
    fontSize: 12,
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
    fontSize: 15,
    fontWeight: '700',
  },
});
