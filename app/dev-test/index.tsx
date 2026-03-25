/**
 * Dev Test Hub — Unified testing screen
 * 3 tabs: Check-in flows | Notification types | Caregiver alert (⚠️)
 */
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppAlertModal, useAppAlert } from '../../src/components/AppAlertModal';
import { ScaledText as Text } from '../../src/components/ScaledText';
import { checkinApi, type CheckinSession } from '../../src/features/checkin/checkin.api';
import { apiClient } from '../../src/lib/apiClient';
import { scheduleLocalNotification } from '../../src/lib/notifications';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { colors, radius, spacing, brandColors } from '../../src/styles';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'checkin' | 'notif' | 'alert';
type LogEntry = { time: string; text: string; kind: 'info' | 'success' | 'error' | 'action' };

// ─── Notification catalog ────────────────────────────────────────────────────

const NOTIF_CATS = [
  {
    label: 'Nhắc nhở',
    icon: 'alarm-outline' as const,
    color: '#3b82f6',
    bg: '#eff6ff',
    items: [
      { type: 'reminder_log_morning',      label: 'Nhắc ghi log sáng' },
      { type: 'reminder_afternoon',        label: 'Nhắc buổi chiều' },
      { type: 'reminder_log_evening',      label: 'Nhắc ghi log tối' },
      { type: 'reminder_glucose',          label: 'Nhắc đo đường huyết' },
      { type: 'reminder_bp',               label: 'Nhắc đo huyết áp' },
      { type: 'reminder_medication_morning', label: 'Nhắc thuốc sáng' },
      { type: 'reminder_medication_evening', label: 'Nhắc thuốc tối' },
    ],
  },
  {
    label: 'Check-in',
    icon: 'heart-outline' as const,
    color: '#08b8a2',
    bg: '#e6faf8',
    items: [
      { type: 'morning_checkin',          label: 'Check-in sáng' },
      { type: 'checkin_followup',         label: 'Follow-up thông thường' },
      { type: 'checkin_followup_urgent',  label: 'Follow-up khẩn (HIGH)' },
    ],
  },
  {
    label: 'Cảnh báo',
    icon: 'warning-outline' as const,
    color: '#dc2626',
    bg: '#fef2f2',
    items: [
      { type: 'emergency',        label: 'Khẩn cấp SOS' },
      { type: 'caregiver_alert',  label: 'Cảnh báo người thân ⚠️' },
      { type: 'health_alert',     label: 'Cảnh báo sức khoẻ' },
    ],
  },
  {
    label: 'Vòng kết nối',
    icon: 'people-outline' as const,
    color: '#10b981',
    bg: '#d1fae5',
    items: [
      { type: 'care_circle_invitation', label: 'Lời mời kết nối' },
      { type: 'care_circle_accepted',   label: 'Chấp nhận kết nối' },
    ],
  },
  {
    label: 'Thành tích',
    icon: 'trophy-outline' as const,
    color: '#f59e0b',
    bg: '#fffbeb',
    items: [
      { type: 'streak_7',     label: 'Streak 7 ngày 🔥' },
      { type: 'streak_14',    label: 'Streak 14 ngày 🔥🔥' },
      { type: 'streak_30',    label: 'Streak 30 ngày 🏆' },
      { type: 'weekly_recap', label: 'Tổng kết tuần' },
    ],
  },
  {
    label: 'AI Engagement',
    icon: 'chatbubble-outline' as const,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    items: [
      { type: 'engagement', label: 'AI cá nhân hoá' },
    ],
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

export default function DevTestHub() {
  // Guard BEFORE any hooks — __DEV__ is a compile-time constant so hook count is consistent
  if (!__DEV__) return null;

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const styles = useMemo(() => createStyles(scaledTypography), [scaledTypography]);
  const { alertState, showAlert, dismissAlert } = useAppAlert();

  const [tab, setTab] = useState<Tab>('checkin');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Check-in state
  const [session, setSession] = useState<CheckinSession | null | undefined>(undefined);

  // Notification state
  const [notifSending, setNotifSending] = useState<string | null>(null);
  const [notifResults, setNotifResults] = useState<Record<string, 'ok' | 'error'>>({});
  const [notifLastResult, setNotifLastResult] = useState<string | null>(null);

  // Alert state
  const [pendingAlerts, setPendingAlerts] = useState<any[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [healthScore, setHealthScore] = useState<any>(null);

  const addLog = useCallback((text: string, kind: LogEntry['kind'] = 'info') => {
    const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [{ time, text, kind }, ...prev.slice(0, 49)]);
  }, []);

  // ── Checkin helpers ────────────────────────────────────────────────────────

  const refreshSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await checkinApi.getToday();
      setSession(res.session);
      if (res.session) {
        const s = res.session;
        addLog(`Session #${s.id} | ${s.initial_status} | ${s.flow_state}${s.triage_severity ? ` | ${s.triage_severity}` : ''}`, 'info');
        if (s.next_checkin_at) {
          const diff = Math.round((new Date(s.next_checkin_at).getTime() - Date.now()) / 60000);
          addLog(`Hẹn check-in: ${new Date(s.next_checkin_at).toLocaleTimeString('vi-VN')} (${diff > 0 ? `còn ${diff} phút` : '⏰ quá giờ'})`, 'info');
        }
      } else {
        addLog('Không có session hôm nay — sẵn sàng test', 'info');
      }
    } catch (err: any) {
      addLog(`Lỗi tải session: ${err.message}`, 'error');
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [addLog]);

  useFocusEffect(useCallback(() => { refreshSession(); }, [refreshSession]));

  const handleReset = useCallback(() => {
    showAlert('Reset Session', 'Xoá session hôm nay để test từ đầu?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            await checkinApi.resetToday();
            setSession(null);
            addLog('✓ Reset session xong — sẵn sàng test', 'success');
          } catch (err: any) {
            addLog(`Reset thất bại: ${err.message}`, 'error');
          } finally { setLoading(false); }
        },
      },
    ]);
  }, [addLog, showAlert]);

  const simulateAndOpenFollowUp = useCallback(async () => {
    if (!session) { addLog('Chưa có session — bắt đầu check-in sáng trước', 'error'); return; }
    setLoading(true);
    try {
      const res = await checkinApi.simulateTime();
      addLog(`⏩ Giả lập thời gian → ${res.message}`, 'success');
      await refreshSession();
      setTimeout(() => router.push(`/checkin?mode=followup&checkin_id=${session.id}`), 300);
    } catch (err: any) {
      addLog(`Lỗi simulate: ${err.message}`, 'error');
    } finally { setLoading(false); }
  }, [session, addLog, refreshSession, router]);

  // ── Notification helpers ───────────────────────────────────────────────────

  const sendTestNotif = useCallback(async (type: string, label: string) => {
    setNotifSending(type);
    setNotifLastResult(null);
    try {
      const res = await apiClient<{ ok: boolean; title?: string; body?: string; error?: string }>(
        '/api/mobile/test-notification',
        { method: 'POST', body: { type } }
      );
      if (res.ok) {
        setNotifResults(prev => ({ ...prev, [type]: 'ok' }));
        setNotifLastResult(`✓ Push gửi: ${res.title}`);
        addLog(`[Notif] ${label} → OK`, 'success');
      } else if (res.error?.toLowerCase().includes('push_token')) {
        await scheduleLocalNotification(label, `Test: ${type}`, { type } as any);
        setNotifResults(prev => ({ ...prev, [type]: 'ok' }));
        setNotifLastResult(`✓ Local: ${label} (no push token)`);
        addLog(`[Notif] ${label} → Local OK`, 'success');
      } else {
        setNotifResults(prev => ({ ...prev, [type]: 'error' }));
        setNotifLastResult(`✗ ${res.error || 'Unknown'}`);
        addLog(`[Notif] ${label} → Error: ${res.error}`, 'error');
      }
    } catch (err: any) {
      setNotifResults(prev => ({ ...prev, [type]: 'error' }));
      setNotifLastResult(`✗ ${err.message}`);
      addLog(`[Notif] ${label} → ${err.message}`, 'error');
    } finally {
      setNotifSending(null);
    }
  }, [addLog]);

  // ── Alert helpers ──────────────────────────────────────────────────────────

  const fetchPendingAlerts = useCallback(async () => {
    setAlertLoading(true);
    try {
      const res = await apiClient<{ ok: boolean; alerts: any[] }>('/api/mobile/checkin/pending-alerts');
      setPendingAlerts(res.alerts || []);
      addLog(`[Cảnh báo] ${res.alerts?.length || 0} cảnh báo đang chờ xác nhận`, 'info');
    } catch (err: any) {
      addLog(`[Cảnh báo] Lỗi tải: ${err.message}`, 'error');
    } finally { setAlertLoading(false); }
  }, [addLog]);

  const confirmAlert = useCallback(async (alertId: number, action: 'seen' | 'on_my_way' | 'called') => {
    const labels = { seen: 'Đã thấy', on_my_way: 'Đang đến', called: 'Đã gọi' };
    setConfirmingId(alertId);
    try {
      await checkinApi.confirmAlert(alertId, action);
      addLog(`[Cảnh báo] #${alertId} → "${labels[action]}" ✓`, 'success');
      setPendingAlerts(prev => prev.filter(a => a.id !== alertId));
    } catch (err: any) {
      addLog(`[Cảnh báo] Xác nhận thất bại: ${err.message}`, 'error');
    } finally { setConfirmingId(null); }
  }, [addLog]);

  const triggerTestEmergency = useCallback(async () => {
    showAlert('Test Emergency', 'Gửi SOS test → báo tất cả caregiver?', [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Gửi SOS',
        style: 'destructive',
        onPress: async () => {
          setLoading(true);
          try {
            const res = await checkinApi.emergency();
            addLog(`[SOS] Gửi thành công | ${res.caregiversAlerted} người thân nhận thông báo`, 'success');
            await refreshSession();
            await fetchPendingAlerts();
          } catch (err: any) {
            addLog(`[SOS] Thất bại: ${err.message}`, 'error');
          } finally { setLoading(false); }
        },
      },
    ]);
  }, [addLog, refreshSession, fetchPendingAlerts, showAlert]);

  const fetchHealthScore = useCallback(async () => {
    try {
      const res = await checkinApi.getHealthScore();
      setHealthScore(res);
      addLog(`[Score] Level: ${res.level} | Factors: ${res.factors?.join(', ') || 'none'}`, 'info');
    } catch (err: any) {
      addLog(`[Score] Lỗi: ${err.message}`, 'error');
    }
  }, [addLog]);

  // ── Render ─────────────────────────────────────────────────────────────────

  const sessionColor = !session ? colors.textSecondary
    : session.flow_state === 'resolved' ? '#16a34a'
    : session.flow_state === 'high_alert' ? '#dc2626'
    : session.flow_state === 'follow_up' ? '#d97706'
    : colors.primary;

  const notifSuccessCount = Object.values(notifResults).filter(r => r === 'ok').length;

  return (
    <>
      <AppAlertModal {...alertState} onDismiss={dismissAlert} />
      <Stack.Screen options={{
        headerShown: true,
        title: '🧪 Dev Test Hub',
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
        headerShadowVisible: false,
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
            <Ionicons name="chevron-back" size={24} color={colors.primary} />
          </TouchableOpacity>
        ),
      }} />

      {/* Tab switcher */}
      <View style={[styles.tabBar, { paddingTop: 6 }]}>
        <TabBtn label="🔄 Check-in" active={tab === 'checkin'} onPress={() => setTab('checkin')} styles={styles} />
        <TabBtn label="🔔 Thông báo" active={tab === 'notif'} onPress={() => setTab('notif')} styles={styles} />
        <TabBtn label="⚠️ Cảnh báo" active={tab === 'alert'} onPress={() => { setTab('alert'); fetchPendingAlerts(); fetchHealthScore(); }} styles={styles} />
      </View>

      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ══════════════════════════════════════════════════
            TAB 1 — CHECK-IN FLOWS
        ══════════════════════════════════════════════════ */}
        {tab === 'checkin' && (
          <>
            {/* Session status */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.dot, { backgroundColor: sessionColor }]} />
                <Text style={styles.cardTitle}>Session hôm nay</Text>
                {loading && <ActivityIndicator size="small" color={colors.primary} />}
                <Pressable onPress={refreshSession} hitSlop={12} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="refresh" size={20} color={colors.primary} />
                </Pressable>
              </View>
              {session === undefined ? (
                <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
              ) : !session ? (
                <Text style={styles.emptyText}>Chưa có session — sẵn sàng check-in sáng</Text>
              ) : (
                <View style={styles.sessionGrid}>
                  <SessionRow label="ID" value={`#${session.id}`} />
                  <SessionRow label="Status" value={session.current_status} color={sessionColor} />
                  <SessionRow
                    label="Flow"
                    value={{
                      resolved:   '✅ resolved',
                      monitoring: '👁 monitoring',
                      follow_up:  '🔄 follow_up',
                      high_alert: '🚨 high_alert',
                    }[session.flow_state] ?? session.flow_state}
                    color={sessionColor}
                  />
                  <SessionRow label="Severity" value={session.triage_severity || '—'} />
                  <SessionRow label="Family alerted" value={session.family_alerted ? '🚨 Có' : 'Chưa'} />
                  <SessionRow label="No-response" value={`${session.no_response_count} lần`} />
                  {session.next_checkin_at ? (
                    <SessionRow
                      label="Hẹn check-in"
                      value={(() => {
                        const t = new Date(session.next_checkin_at!);
                        const diff = Math.round((t.getTime() - Date.now()) / 60000);
                        const timeStr = t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
                        const flowHint = session.flow_state === 'monitoring' ? ' (hỏi tối)'
                          : session.flow_state === 'high_alert' ? ' (theo dõi khẩn)'
                          : session.flow_state === 'follow_up' ? ' (follow-up)'
                          : '';
                        return diff > 0
                          ? `${timeStr}${flowHint} — còn ${diff < 60 ? `${diff}p` : `${Math.round(diff / 60)}h`}`
                          : `⏰ ${timeStr}${flowHint} — quá giờ`;
                      })()}
                      color={new Date(session.next_checkin_at!).getTime() < Date.now() ? '#dc2626' : undefined}
                    />
                  ) : session.flow_state === 'resolved' ? (
                    <SessionRow label="Hẹn check-in" value="— đã kết thúc hôm nay" color="#16a34a" />
                  ) : null}
                </View>
              )}
            </View>

            {/* Quick actions */}
            <View style={styles.row}>
              <QuickBtn icon="trash-outline" label="Reset Session" sub="Xoá để test lại" color="#dc2626" bg={colors.danger + '15'} onPress={handleReset} />
              <QuickBtn icon="refresh" label="Tải lại" sub="Cập nhật trạng thái" color="#3b82f6" bg={brandColors.indigo + '15'} onPress={refreshSession} />
              <QuickBtn icon="time-outline" label="Giả lập thời gian ⏩" sub="Đặt next_checkin_at = quá khứ" color="#d97706" bg={colors.premiumLight} onPress={simulateAndOpenFollowUp} disabled={!session} />
            </View>

            {/* ── Luồng 1: Tôi ổn ── */}
            <FlowCard
              color="#16a34a"
              title="Luồng 1 — Tôi ổn"
              desc="Sáng: fine → monitoring → 21h tối AI hỏi"
              steps={[
                {
                  icon: 'weather-sunny',
                  label: '1a. Sáng → Chọn "Tôi ổn"',
                  bg: colors.emeraldLight,
                  color: '#16a34a',
                  onPress: async () => {
                    setLoading(true);
                    try {
                      await checkinApi.resetToday(); setSession(null);
                      addLog('[L1] Reset → mở check-in sáng', 'action');
                      setTimeout(() => router.push('/checkin'), 300);
                    } catch (err: any) { addLog(`Lỗi: ${err.message}`, 'error'); }
                    finally { setLoading(false); }
                  },
                },
                {
                  icon: 'weather-night',
                  label: '1b. ⏩ 21h → AI hỏi hôm nay thế nào',
                  bg: colors.emeraldLight,
                  color: '#16a34a',
                  disabled: !session,
                  onPress: simulateAndOpenFollowUp,
                },
              ]}
            />

            {/* ── Luồng 2: Hơi mệt ── */}
            <FlowCard
              color="#d97706"
              title="Luồng 2 — Hơi mệt"
              desc="tired → follow_up → AI hỏi 3-5 câu → 3h sau hỏi lại"
              steps={[
                {
                  icon: 'weather-sunny',
                  label: '2a. Sáng → Chọn "Hơi mệt" → Trả lời AI',
                  bg: colors.premiumLight,
                  color: '#d97706',
                  onPress: async () => {
                    setLoading(true);
                    try {
                      await checkinApi.resetToday(); setSession(null);
                      addLog('[L2] Reset → mở check-in sáng', 'action');
                      setTimeout(() => router.push('/checkin'), 300);
                    } catch (err: any) { addLog(`Lỗi: ${err.message}`, 'error'); }
                    finally { setLoading(false); }
                  },
                },
                {
                  icon: 'clock-fast',
                  label: '2b. ⏩ 3h sau → AI hỏi đã đỡ chưa (bấm nhiều lần)',
                  bg: colors.premiumLight,
                  color: '#d97706',
                  disabled: !session,
                  onPress: simulateAndOpenFollowUp,
                },
              ]}
            />

            {/* ── Luồng 3: Rất mệt ── */}
            <FlowCard
              color="#dc2626"
              title="Luồng 3 — Rất mệt"
              desc="very_tired → high_alert → AI red flag → cảnh báo gia đình"
              steps={[
                {
                  icon: 'weather-sunny',
                  label: '3a. Sáng → Chọn "Rất mệt" → Trả lời AI',
                  bg: colors.danger + '18',
                  color: '#dc2626',
                  onPress: async () => {
                    setLoading(true);
                    try {
                      await checkinApi.resetToday(); setSession(null);
                      addLog('[L3] Reset → mở check-in sáng', 'action');
                      setTimeout(() => router.push('/checkin'), 300);
                    } catch (err: any) { addLog(`Lỗi: ${err.message}`, 'error'); }
                    finally { setLoading(false); }
                  },
                },
                {
                  icon: 'clock-fast',
                  label: '3b. ⏩ 1h sau → AI hỏi diễn tiến + red flag',
                  bg: colors.danger + '18',
                  color: '#dc2626',
                  disabled: !session,
                  onPress: simulateAndOpenFollowUp,
                },
              ]}
            />

            {/* ── Luồng 4: Ghi nhận chủ động ── */}
            <FlowCard
              color={colors.primary}
              title="Luồng 4 — Ghi nhận chủ động"
              desc="User bấm chủ động bất kỳ lúc nào (không reset session)"
              steps={[
                {
                  icon: 'plus-circle',
                  label: '4. Mở check-in trực tiếp',
                  bg: colors.primaryLight,
                  color: colors.primary,
                  onPress: () => { addLog('[L4] Mở check-in chủ động', 'action'); router.push('/checkin'); },
                },
              ]}
            />

            {/* ── Luồng 5: SOS ── */}
            <FlowCard
              color="#dc2626"
              title="Luồng 5 — SOS Khẩn cấp"
              desc="Bấm SOS → báo ngay TẤT CẢ caregiver có can_receive_alerts"
              steps={[
                {
                  icon: 'alert-octagon',
                  label: '5. Gửi SOS → Alert gia đình ngay lập tức',
                  bg: colors.danger + '22',
                  color: '#dc2626',
                  onPress: triggerTestEmergency,
                },
              ]}
            />
          </>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 2 — NOTIFICATION TYPES
        ══════════════════════════════════════════════════ */}
        {tab === 'notif' && (
          <>
            {/* Header */}
            <View style={styles.darkCard}>
              <View style={styles.row}>
                <Ionicons name="notifications" size={22} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: '#fff' }]}>Push Notification Tester</Text>
                  <Text style={[styles.metaText, { color: '#888' }]}>
                    {NOTIF_CATS.reduce((s, c) => s + c.items.length, 0)} loại  |  {notifSuccessCount} đã gửi
                  </Text>
                </View>
              </View>
              {notifLastResult && (
                <Text style={[styles.metaText, { color: notifLastResult.startsWith('✗') ? '#f87171' : '#4ade80', marginTop: 4 }]}>
                  {notifLastResult}
                </Text>
              )}
              <Pressable
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                onPress={async () => {
                  showAlert('Gửi tất cả', `Gửi ${NOTIF_CATS.reduce((s, c) => s + c.items.length, 0)} thông báo liên tiếp?`, [
                    { text: 'Huỷ', style: 'cancel' },
                    {
                      text: 'Gửi hết',
                      onPress: async () => {
                        for (const cat of NOTIF_CATS) {
                          for (const item of cat.items) {
                            await sendTestNotif(item.type, item.label);
                            await new Promise(r => setTimeout(r, 1200));
                          }
                        }
                      },
                    },
                  ]);
                }}
              >
                <Ionicons name="paper-plane" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Gửi tất cả</Text>
              </Pressable>
            </View>

            {NOTIF_CATS.map(cat => (
              <View key={cat.label}>
                <View style={styles.catHeader}>
                  <View style={[styles.catIcon, { backgroundColor: cat.bg }]}>
                    <Ionicons name={cat.icon} size={15} color={cat.color} />
                  </View>
                  <Text style={styles.catLabel}>{cat.label}</Text>
                  <Text style={styles.catCount}>{cat.items.length}</Text>
                </View>
                <View style={styles.listCard}>
                  {cat.items.map((item, i) => {
                    const isSending = notifSending === item.type;
                    const result = notifResults[item.type];
                    return (
                      <View key={item.type}>
                        {i > 0 && <View style={styles.hairline} />}
                        <Pressable
                          style={({ pressed }) => [styles.notifRow, pressed && { backgroundColor: colors.surfaceMuted }]}
                          onPress={() => sendTestNotif(item.type, item.label)}
                          disabled={!!notifSending}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={styles.notifLabel}>{item.label}</Text>
                            <Text style={styles.typeTag}>{item.type}</Text>
                          </View>
                          <View style={styles.notifActionWrap}>
                            {isSending ? (
                              <ActivityIndicator size="small" color={cat.color} />
                            ) : result === 'ok' ? (
                              <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                            ) : result === 'error' ? (
                              <Ionicons name="close-circle" size={22} color="#dc2626" />
                            ) : (
                              <View style={[styles.sendDot, { backgroundColor: cat.bg }]}>
                                <Ionicons name="paper-plane-outline" size={14} color={cat.color} />
                              </View>
                            )}
                          </View>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}

            {notifSuccessCount > 0 && (
              <Pressable style={styles.clearBtn} onPress={() => { setNotifResults({}); setNotifLastResult(null); }}>
                <Text style={styles.clearBtnText}>Xoá kết quả</Text>
              </Pressable>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════
            TAB 3 — CAREGIVER ALERT (⚠️)
        ══════════════════════════════════════════════════ */}
        {tab === 'alert' && (
          <>
            {/* Health score */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name="fitness-outline" size={18} color={colors.primary} />
                <Text style={styles.cardTitle}>Health Score</Text>
                <Pressable onPress={fetchHealthScore} hitSlop={12} style={{ marginLeft: 'auto' }}>
                  <Ionicons name="refresh" size={18} color={colors.primary} />
                </Pressable>
              </View>
              {healthScore ? (
                <View style={styles.sessionGrid}>
                  <SessionRow
                    label="Level"
                    value={healthScore.level}
                    color={healthScore.level === 'ok' ? '#16a34a' : healthScore.level === 'monitor' ? '#d97706' : '#dc2626'}
                  />
                  <SessionRow label="Check-in done" value={healthScore.checkinDone ? 'Có' : 'Chưa'} />
                  {healthScore.factors?.length > 0 && (
                    <SessionRow label="Factors" value={healthScore.factors.join(', ')} />
                  )}
                </View>
              ) : (
                <Text style={styles.emptyText}>Bấm refresh để tải health score</Text>
              )}
            </View>

            {/* Test actions */}
            <Text style={styles.sectionLabel}>Kích hoạt cảnh báo</Text>
            <View style={styles.row}>
              <QuickBtn
                icon="alert-circle-outline"
                label="Gửi SOS"
                sub="Báo NGAY tất cả caregiver"
                color="#dc2626"
                bg={colors.danger + '15'}
                onPress={triggerTestEmergency}
              />
              <QuickBtn
                icon="notifications-outline"
                label="Test caregiver_alert"
                sub="Gửi push ⚠️ về máy này"
                color="#d97706"
                bg={colors.premiumLight}
                onPress={() => sendTestNotif('caregiver_alert', 'Cảnh báo người thân ⚠️')}
              />
            </View>

            <View style={styles.row}>
              <QuickBtn
                icon="heart-dislike-outline"
                label="Test health_alert"
                sub="Cảnh báo sức khoẻ cao"
                color="#ef4444"
                bg="#fef2f2"
                onPress={() => sendTestNotif('health_alert', 'Cảnh báo sức khoẻ')}
              />
              <QuickBtn
                icon="medical-outline"
                label="Test emergency notif"
                sub="Loại thông báo khẩn"
                color="#dc2626"
                bg={colors.danger + '15'}
                onPress={() => sendTestNotif('emergency', 'Khẩn cấp SOS')}
              />
            </View>

            {/* Pending alerts */}
            <View style={styles.cardHeader}>
              <Text style={styles.sectionLabel}>Cảnh báo đang chờ xác nhận</Text>
              <Pressable onPress={fetchPendingAlerts} hitSlop={12} style={{ marginLeft: 8 }}>
                {alertLoading
                  ? <ActivityIndicator size="small" color={colors.primary} />
                  : <Ionicons name="refresh" size={16} color={colors.primary} />
                }
              </Pressable>
            </View>

            {pendingAlerts.length === 0 ? (
              <View style={[styles.card, { alignItems: 'center', paddingVertical: spacing.xl }]}>
                <Ionicons name="checkmark-circle-outline" size={32} color="#16a34a" />
                <Text style={[styles.emptyText, { marginTop: 8 }]}>Không có cảnh báo nào đang chờ</Text>
              </View>
            ) : (
              pendingAlerts.map(alert => (
                <View key={alert.id} style={[styles.alertCard, { borderColor: '#d97706' + '44' }]}>
                  <View style={styles.alertHeader}>
                    <Ionicons name="warning" size={18} color="#d97706" />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.alertTitle}>{alert.title || `Cảnh báo #${alert.id}`}</Text>
                      <Text style={styles.metaText}>{alert.message || alert.body}</Text>
                      {alert.created_at && (
                        <Text style={styles.typeTag}>{new Date(alert.created_at).toLocaleString('vi-VN')}</Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.alertActions}>
                    {(['seen', 'on_my_way', 'called'] as const).map(action => {
                      const cfg = {
                        seen:       { label: '👁 Đã thấy',  color: '#3b82f6', bg: '#eff6ff' },
                        on_my_way:  { label: '🚗 Đang đến', color: '#d97706', bg: '#fffbeb' },
                        called:     { label: '📞 Đã gọi',   color: '#16a34a', bg: '#f0fdf4' },
                      }[action];
                      return (
                        <Pressable
                          key={action}
                          style={({ pressed }) => [
                            styles.alertActionBtn,
                            { backgroundColor: cfg.bg },
                            pressed && { opacity: 0.8 },
                          ]}
                          onPress={() => confirmAlert(alert.id, action)}
                          disabled={confirmingId === alert.id}
                        >
                          {confirmingId === alert.id
                            ? <ActivityIndicator size="small" color={cfg.color} />
                            : <Text style={[styles.alertActionText, { color: cfg.color }]}>{cfg.label}</Text>
                          }
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))
            )}

            {/* Flow diagram */}
            <View style={styles.card}>
              <Text style={[styles.cardTitle, { marginBottom: spacing.sm }]}>⚠️ Luồng cảnh báo gia đình</Text>
              {[
                { icon: 'alert-circle-outline', color: '#dc2626', text: 'User check-in "Rất mệt" / Không phản hồi 2 lần / Bấm SOS' },
                { icon: 'arrow-down', color: colors.textSecondary, text: '' },
                { icon: 'people-outline', color: '#d97706', text: 'Hệ thống gửi push ⚠️ đến caregivers (can_receive_alerts=true)' },
                { icon: 'arrow-down', color: colors.textSecondary, text: '' },
                { icon: 'phone-portrait-outline', color: '#3b82f6', text: 'Caregiver nhận push → mở app → thấy dấu ⚠️ màu vàng' },
                { icon: 'arrow-down', color: colors.textSecondary, text: '' },
                { icon: 'checkmark-circle-outline', color: '#16a34a', text: 'Caregiver bấm: "Đã thấy" / "Đang đến" / "Đã gọi"' },
              ].map((step, i) => step.text ? (
                <View key={i} style={styles.flowStep}>
                  <Ionicons name={step.icon as any} size={16} color={step.color} />
                  <Text style={styles.flowText}>{step.text}</Text>
                </View>
              ) : (
                <Ionicons key={i} name="arrow-down" size={14} color={colors.border} style={{ marginLeft: 2, marginVertical: 2 }} />
              ))}
              <View style={[styles.flowStep, { marginTop: spacing.sm, backgroundColor: '#fffbeb', borderRadius: 8, padding: spacing.sm }]}>
                <Ionicons name="information-circle-outline" size={16} color="#d97706" />
                <Text style={[styles.metaText, { flex: 1 }]}>
                  Cảnh báo tự leo thang: người ≥65 tuổi hoặc ban đêm (22h-6h) → báo ngay sau 1 lần miss
                </Text>
              </View>
            </View>
          </>
        )}

        {/* ── Log console (tất cả tab) ── */}
        <Text style={styles.sectionLabel}>Console</Text>
        <View style={styles.console}>
          {logs.length === 0
            ? <Text style={styles.consoleEmpty}>Chưa có log...</Text>
            : logs.map((l, i) => (
              <View key={i} style={styles.consoleRow}>
                <Text style={styles.consoleTime}>{l.time}</Text>
                <View style={[styles.consoleDot, {
                  backgroundColor: l.kind === 'error' ? '#dc2626' : l.kind === 'success' ? '#16a34a' : l.kind === 'action' ? '#3b82f6' : '#555',
                }]} />
                <Text style={[styles.consoleText, l.kind === 'error' && { color: '#f87171' }, l.kind === 'success' && { color: '#4ade80' }]}>
                  {l.text}
                </Text>
              </View>
            ))
          }
        </View>
        {logs.length > 0 && (
          <Pressable style={styles.clearBtn} onPress={() => setLogs([])}>
            <Text style={styles.clearBtnText}>Xoá console</Text>
          </Pressable>
        )}
      </ScrollView>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBtn({ label, active, onPress, styles }: { label: string; active: boolean; onPress: () => void; styles: any }) {
  return (
    <Pressable
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
    >
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </Pressable>
  );
}

function SessionRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
      <Text style={{ fontSize: 12, color: colors.textSecondary }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: color || colors.textPrimary, maxWidth: '62%' }} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function QuickBtn({ icon, label, sub, color, bg, onPress, disabled }: {
  icon: string; label: string; sub: string; color: string; bg: string;
  onPress: () => void; disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [{
        flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
        padding: spacing.md, borderWidth: 1.5, borderColor: color + '33', gap: 4,
        opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
      }]}
      onPress={onPress}
      disabled={disabled}
    >
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textPrimary }}>{label}</Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary }}>{sub}</Text>
    </Pressable>
  );
}

function FlowCard({ color, title, desc, steps }: {
  color: string; title: string; desc: string;
  steps: Array<{ icon: string; label: string; bg: string; color: string; onPress: () => void; disabled?: boolean }>;
}) {
  return (
    <View style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1.5, borderColor: color + '33' }}>
      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }}>{title}</Text>
      <Text style={{ fontSize: 11, color: colors.textSecondary, marginBottom: spacing.sm }}>{desc}</Text>
      {steps.map((step, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [{
            flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
            paddingVertical: spacing.sm, paddingHorizontal: spacing.md,
            borderRadius: radius.md, backgroundColor: step.bg, marginTop: i > 0 ? 6 : 0,
            opacity: step.disabled ? 0.4 : pressed ? 0.8 : 1,
          }]}
          onPress={step.onPress}
          disabled={step.disabled}
        >
          <MaterialCommunityIcons name={step.icon as any} size={15} color={step.color} />
          <Text style={{ fontSize: 12, fontWeight: '600', color: step.color, flex: 1 }}>{step.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function createStyles(typography: ReturnType<typeof useScaledTypography>) {
  return StyleSheet.create({
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      paddingHorizontal: spacing.lg,
      paddingBottom: 6,
      gap: spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    tabBtn: {
      flex: 1, paddingVertical: 8, borderRadius: radius.md,
      alignItems: 'center', backgroundColor: 'transparent',
    },
    tabBtnActive: {
      backgroundColor: colors.primaryLight,
    },
    tabBtnText: {
      fontSize: typography.size.xs, fontWeight: '600', color: colors.textSecondary,
    },
    tabBtnTextActive: {
      color: colors.primary,
    },
    container: {
      padding: spacing.lg, gap: spacing.md,
    },
    card: {
      backgroundColor: colors.surface, borderRadius: radius.xl,
      padding: spacing.lg, borderWidth: 1.5, borderColor: colors.border,
    },
    darkCard: {
      backgroundColor: '#1a1a2e', borderRadius: radius.xl,
      padding: spacing.lg, gap: spacing.sm,
    },
    cardHeader: {
      flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm,
    },
    cardTitle: {
      fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary, flex: 1,
    },
    dot: { width: 10, height: 10, borderRadius: 5 },
    emptyText: { fontSize: typography.size.xs, color: colors.textSecondary, textAlign: 'center', paddingVertical: spacing.md },
    sessionGrid: { gap: 2 },
    row: { flexDirection: 'row', gap: spacing.sm },
    sectionLabel: {
      fontSize: typography.size.xxs, fontWeight: '700', color: colors.textSecondary,
      textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.xs,
    },
    metaText: { fontSize: typography.size.xxs, color: colors.textSecondary },
    typeTag: { fontSize: 10, color: colors.textSecondary + '77', fontFamily: 'Courier', marginTop: 1 },
    primaryBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.sm, backgroundColor: colors.primary,
      borderRadius: radius.lg, paddingVertical: spacing.sm + 2,
    },
    primaryBtnText: { fontSize: typography.size.xs, fontWeight: '700', color: '#fff' },
    catHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xs },
    catIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
    catLabel: { fontSize: typography.size.xs, fontWeight: '700', color: colors.textPrimary, flex: 1 },
    catCount: {
      fontSize: typography.size.xxs, color: colors.textSecondary,
      backgroundColor: colors.surfaceMuted, paddingHorizontal: 7, paddingVertical: 1,
      borderRadius: 10, overflow: 'hidden',
    },
    listCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      borderWidth: 1.5, borderColor: colors.border, overflow: 'hidden',
    },
    hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
    notifRow: {
      flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md,
    },
    notifLabel: { fontSize: typography.size.sm, fontWeight: '600', color: colors.textPrimary },
    notifActionWrap: { width: 32, alignItems: 'center' },
    sendDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    alertCard: {
      backgroundColor: colors.surface, borderRadius: radius.lg,
      padding: spacing.md, borderWidth: 1.5, gap: spacing.md,
    },
    alertHeader: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
    alertTitle: { fontSize: typography.size.sm, fontWeight: '700', color: colors.textPrimary },
    alertActions: { flexDirection: 'row', gap: spacing.sm },
    alertActionBtn: {
      flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
      alignItems: 'center', justifyContent: 'center',
    },
    alertActionText: { fontSize: typography.size.xs, fontWeight: '700' },
    flowStep: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: 2 },
    flowText: { fontSize: typography.size.xxs, color: colors.textSecondary, flex: 1, lineHeight: 18 },
    console: {
      backgroundColor: '#1a1a2e', borderRadius: radius.lg, padding: spacing.md, minHeight: 80,
    },
    consoleEmpty: { fontSize: 12, color: '#444', fontStyle: 'italic' },
    consoleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, paddingVertical: 2 },
    consoleTime: { fontSize: 10, color: '#555', fontFamily: 'Courier', width: 68 },
    consoleDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
    consoleText: { fontSize: 11, color: '#aaa', flex: 1, fontFamily: 'Courier' },
    clearBtn: { alignSelf: 'center', paddingVertical: spacing.xs, paddingHorizontal: spacing.xl },
    clearBtnText: { fontSize: typography.size.xs, color: colors.textSecondary },
  });
}
