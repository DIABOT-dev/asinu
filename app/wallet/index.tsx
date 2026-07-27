import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Defs, G, Path, Rect, Stop, LinearGradient as SvgGradient } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { RippleRefreshScrollView } from '../../src/components/RippleRefresh';
import { ScaledText } from '../../src/components/ScaledText';
import { Screen } from '../../src/components/Screen';
import { ScreenBackButton } from '../../src/components/ScreenHeaderButton';
import { useScaledTypography } from '../../src/hooks/useScaledTypography';
import { useThemeColors } from '../../src/hooks/useThemeColors';
import { apiClient } from '../../src/lib/apiClient';
import { showToast } from '../../src/stores/toast.store';
import { colors, spacing } from '../../src/styles';

// ---- types ----
type QRData = { order_code: string; qr_url: string; amount: number; description: string; expires_at: string };
type Payment = { id: number; order_code: string; amount: string; status: 'pending' | 'completed' | 'failed'; created_at: string; completed_at: string | null };
type BalanceRes = { ok: boolean; balance: string };
type QRRes = { ok: boolean; order_code: string; qr_url: string; amount: number; description: string; expires_at: string };
type HistoryRes = { ok: boolean; payments: Payment[]; total: number };

function formatVND(val: number | string): string {
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return '0';
  return n.toLocaleString('vi-VN');
}
function formatStatus(status: Payment['status'], t: (k: string) => string): string {
  if (status === 'completed') return t('completed');
  if (status === 'failed') return t('failed');
  return t('pending');
}
function statusColor(status: Payment['status']): string {
  if (status === 'completed') return colors.success;
  if (status === 'failed') return colors.danger;
  return colors.warning;
}
function statusIcon(status: Payment['status']): string {
  if (status === 'completed') return 'checkmark-circle';
  if (status === 'failed') return 'close-circle';
  return 'time';
}

// ── Exact SVG Icons for 4 Quick Amount Cards ─────────────
function Icon50K() {
  return (
    <Svg width="36" height="26" viewBox="0 0 36 26" fill="none">
      <Rect x="2" y="5" width="2.5" height="4" rx="1" fill="#059669" />
      <Rect x="2" y="11" width="2.5" height="4" rx="1" fill="#059669" />
      <Rect x="2" y="17" width="2.5" height="4" rx="1" fill="#059669" />
      <Rect x="8" y="3" width="25" height="20" rx="4" stroke="#059669" strokeWidth="2" fill="none" />
      <Circle cx="20.5" cy="13" r="4.5" stroke="#059669" strokeWidth="2" fill="none" />
    </Svg>
  );
}

function Icon100K() {
  return (
    <Svg width="36" height="26" viewBox="0 0 36 26" fill="none">
      <Rect x="2" y="5" width="2.5" height="4" rx="1" fill="#0284C7" />
      <Rect x="2" y="11" width="2.5" height="4" rx="1" fill="#0284C7" />
      <Rect x="2" y="17" width="2.5" height="4" rx="1" fill="#0284C7" />
      <Rect x="8" y="3" width="25" height="20" rx="4" stroke="#0284C7" strokeWidth="2" fill="none" />
      <Circle cx="20.5" cy="13" r="4.5" stroke="#0284C7" strokeWidth="2" fill="none" />
    </Svg>
  );
}

function Icon200K() {
  return (
    <Svg width="36" height="26" viewBox="0 0 36 26" fill="none">
      <Rect x="2" y="8" width="2.5" height="4" rx="1" fill="#8B5CF6" />
      <Rect x="2" y="14" width="2.5" height="4" rx="1" fill="#8B5CF6" />
      <Rect x="8" y="3" width="25" height="20" rx="4" stroke="#8B5CF6" strokeWidth="2" fill="none" />
      <Rect x="13" y="8" width="8" height="10" rx="2" stroke="#8B5CF6" strokeWidth="1.5" fill="none" />
      <Circle cx="26" cy="13" r="2.5" fill="#8B5CF6" />
    </Svg>
  );
}

function Icon500K() {
  return (
    <Svg width="32" height="26" viewBox="0 0 32 26" fill="none">
      <Path
        d="M16 2 L28 9 L16 24 L4 9 Z"
        stroke="#F97316"
        strokeWidth="2"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d="M4 9 L28 9 M11 9 L16 24 M21 9 L16 24 M16 2 L11 9 M16 2 L21 9"
        stroke="#F97316"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// ── Static Wallet SVG Graphic for Header Card ───────────
function WalletCardGraphic() {
  return (
    <View style={{ width: 120, height: 100, position: 'absolute', right: 8, top: 10 }}>
      <Svg width="120" height="100" viewBox="0 0 130 110" fill="none">
        {/* Wave lines background */}
        <Path d="M10 30 Q 60 8, 125 40 T 140 95" stroke="#A7F3D0" strokeWidth="2.5" opacity="0.65" fill="none" />
        <Path d="M30 12 Q 80 30, 130 20" stroke="#6EE7B7" strokeWidth="2" opacity="0.45" fill="none" />
        <Path d="M0 50 Q 50 40, 115 75" stroke="#34D399" strokeWidth="1.5" opacity="0.35" fill="none" />

        {/* 3D Wallet Body */}
        <G transform="translate(22, 20) rotate(-5)">
          {/* Soft Shadow */}
          <Rect x="6" y="26" width="80" height="54" rx="16" fill="#047857" opacity="0.12" />

          {/* Cards preview in back slot */}
          <Rect x="15" y="8" width="62" height="34" rx="8" fill="#6EE7B7" opacity="0.9" />
          <Rect x="20" y="4" width="52" height="28" rx="7" fill="#A7F3D0" />

          {/* Main Wallet Base */}
          <Rect x="4" y="18" width="82" height="56" rx="16" fill="url(#walletGrad)" />

          {/* Wallet Flap */}
          <Path d="M4 30 C 4 30, 26 40, 47 40 C 68 40, 82 30, 82 30 L 82 60 C 82 67.1766, 76.1766 73, 69 73 L 17 73 C 9.82335 73, 4 67.1766, 4 60 Z" fill="url(#flapGrad)" />

          {/* Snap Button */}
          <Circle cx="68" cy="51" r="6.5" fill="#E6F7F0" />
          <Circle cx="68" cy="51" r="3.8" fill="#059669" />
        </G>

        <Defs>
          <SvgGradient id="walletGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#B4F4D6" />
            <Stop offset="50%" stopColor="#6EE7B7" />
            <Stop offset="100%" stopColor="#34D399" />
          </SvgGradient>
          <SvgGradient id="flapGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#D1FAE5" />
            <Stop offset="100%" stopColor="#A7F3D0" />
          </SvgGradient>
        </Defs>
      </Svg>
    </View>
  );
}

// ── Static Wallet SVG Graphic for Empty History ──────────
function EmptyHistoryGraphic() {
  return (
    <View style={{ width: 150, height: 115, alignItems: 'center', justifyContent: 'center', marginVertical: 10 }}>
      <Svg width="150" height="115" viewBox="0 0 150 115" fill="none">
        {/* Glow circle background */}
        <Circle cx="75" cy="62" r="42" fill="#E6F7F0" />

        {/* Plant leaf sprouts left */}
        <Path d="M40 50 C 32 42, 26 44, 29 54 C 32 64, 42 62, 40 50 Z" fill="#6EE7B7" />
        <Path d="M46 58 C 36 58, 34 68, 42 72 C 50 76, 52 64, 46 58 Z" fill="#34D399" />

        {/* Flying money note right */}
        <G transform="translate(96, 38) rotate(18)">
          <Rect x="0" y="0" width="24" height="13" rx="3" fill="#A7F3D0" opacity="0.9" />
          <Circle cx="12" cy="6.5" r="3" fill="#34D399" />
          <Path d="M-4 3 Q -1 1, 0 5" stroke="#6EE7B7" strokeWidth="1.5" fill="none" />
        </G>
        <G transform="translate(104, 58) rotate(-10)">
          <Rect x="0" y="0" width="18" height="10" rx="2" fill="#6EE7B7" opacity="0.75" />
        </G>

        {/* Mint Wallet Center */}
        <G transform="translate(48, 44)">
          {/* Shadow */}
          <Rect x="4" y="20" width="60" height="40" rx="12" fill="#047857" opacity="0.1" />

          {/* Wallet Base */}
          <Rect x="0" y="8" width="60" height="40" rx="12" fill="url(#emptyGrad)" />

          {/* Wallet Flap */}
          <Path d="M0 17 C 0 17, 18 24, 32 24 C 46 24, 60 17, 60 17 L 60 40 C 60 44.4183, 56.4183 48, 52 48 L 8 48 C 3.58172 48, 0 44.4183, 0 40 Z" fill="#A7F3D0" />

          {/* Button */}
          <Circle cx="47" cy="33" r="5" fill="#E6F7F0" />
          <Circle cx="47" cy="33" r="2.8" fill="#059669" />
        </G>

        <Defs>
          <SvgGradient id="emptyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor="#A7F3D0" />
            <Stop offset="100%" stopColor="#34D399" />
          </SvgGradient>
        </Defs>
      </Svg>
    </View>
  );
}

export default function WalletScreen() {
  const { t } = useTranslation('wallet');
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => createStyles(scaledTypography, insets.top), [scaledTypography, insets.top, isDark]);

  const mountedRef = useRef(true);
  const [balance, setBalance] = useState<string>('500000');
  const [amount, setAmount] = useState('50000');
  const [qr, setQr] = useState<QRData | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [creatingQR, setCreatingQR] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [pollStatus, setPollStatus] = useState<'idle' | 'polling' | 'success'>('idle');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await apiClient<BalanceRes>('/api/payments/balance');
      if (res.ok) setBalance(res.balance);
    } catch {} finally { setLoadingBalance(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const res = await apiClient<HistoryRes>('/api/payments/history?limit=10');
      if (res.ok) setPayments(res.payments);
    } catch {} finally { setLoadingHistory(false); }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchBalance(), fetchHistory()]);
    setRefreshing(false);
  }, [fetchBalance, fetchHistory]);

  useEffect(() => {
    fetchBalance();
    fetchHistory();
    return () => { clearTimers(); mountedRef.current = false; };
  }, []);

  const startCountdown = useCallback((expiresAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const remaining = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0 && timerRef.current) clearInterval(timerRef.current);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
  }, []);

  const startPolling = useCallback((orderCode: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPollStatus('polling');
    pollRef.current = setInterval(async () => {
      if (!mountedRef.current) { if (pollRef.current) clearInterval(pollRef.current); return; }
      try {
        const res = await apiClient<HistoryRes>('/api/payments/history?limit=10');
        if (!mountedRef.current) return;
        if (res.ok) {
          setPayments(res.payments);
          const found = res.payments.find((p) => p.order_code === orderCode);
          if (found?.status === 'completed') {
            setPollStatus('success');
            if (pollRef.current) clearInterval(pollRef.current);
            fetchBalance();
            showToast(t('paymentSuccess'), 'success');
          }
        }
      } catch {}
    }, 5000);
  }, [fetchBalance, t]);

  const handleGenerateQR = useCallback(async () => {
    const num = parseInt(amount.replace(/[^0-9]/g, ''), 10);
    if (!num || num < 1000) { setError(t('amountMin')); return; }
    setError('');
    setCreatingQR(true);
    clearTimers();
    setQr(null);
    setPollStatus('idle');
    try {
      const res = await apiClient<QRRes>('/api/payments/qr', { method: 'POST', body: { amount: num } });
      if (res.ok) {
        setQr({ order_code: res.order_code, qr_url: res.qr_url, amount: res.amount, description: res.description, expires_at: res.expires_at });
        startCountdown(res.expires_at);
        startPolling(res.order_code);
        showToast(t('qrCreated'), 'success');
      } else {
        setError(t('createQRError'));
        showToast(t('createQRError'), 'error');
      }
    } catch {
      setError(t('createQRError'));
      showToast(t('createQRError'), 'error');
    } finally { setCreatingQR(false); }
  }, [amount, t, clearTimers, startCountdown, startPolling]);

  const isExpired = qr ? countdown <= 0 : false;
  const minuteStr = Math.floor(countdown / 60).toString().padStart(2, '0');
  const secondStr = (countdown % 60).toString().padStart(2, '0');

  return (
    <Screen style={styles.screenBg}>
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ══ Header ══ */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <ScreenBackButton
              onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')}
            />
            <ScaledText style={styles.headerTitle}>{t('title')}</ScaledText>
            <Pressable onPress={onRefresh} hitSlop={12} style={styles.headerAction}>
              <Ionicons name="refresh" size={18} color="#047857" />
            </Pressable>
          </View>
        </View>

        {/* Balance Card */}
        <View style={styles.balanceCardWrapper}>
          <LinearGradient
            colors={['#EFF9F5', '#E3F5ED', '#D7F1E7']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.balanceCard}
          >
            <WalletCardGraphic />

            <View style={styles.balanceCardContent}>
              <ScaledText style={styles.balanceLabel}>Số dư hiện tại</ScaledText>
              {loadingBalance ? (
                <View style={{ marginTop: 8 }}>
                  <ActivityIndicator size="small" color="#059669" />
                </View>
              ) : (
                <View style={styles.balanceRow}>
                  <ScaledText style={styles.balanceValue}>{formatVND(balance)}</ScaledText>
                  <ScaledText style={styles.balanceUnit}>đ</ScaledText>
                </View>
              )}

              <View style={styles.badgePill}>
                <Ionicons name="shield-checkmark" size={13} color="#059669" />
                <ScaledText style={styles.badgeText}>Ví an toàn</ScaledText>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* ══ Top-up Section ══ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="wallet-plus-outline" size={22} color="#059669" />
              <ScaledText style={styles.sectionTitle}>{t('topUp')}</ScaledText>
            </View>
            <View style={styles.securityRight}>
              <Ionicons name="shield-checkmark-outline" size={14} color="#059669" />
              <ScaledText style={styles.securityText}>Bảo mật tuyệt đối</ScaledText>
            </View>
          </View>

          {/* Quick Amounts Grid (2x2) */}
          <View style={styles.quickGridWrapper}>
            <View style={styles.quickGrid}>
              {/* Card 1: 50.000 đ */}
              <View style={styles.quickCardCol}>
                <Pressable
                  style={[styles.quickCard, amount === '50000' ? styles.quickCardActive : styles.quickCardInactive]}
                  onPress={() => setAmount('50000')}
                >
                  <View style={[styles.radioCircle, amount === '50000' && styles.radioCircleActive]}>
                    {amount === '50000' ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <View style={styles.radioInnerEmpty} />
                    )}
                  </View>
                  <View style={{ marginBottom: 6 }}><Icon50K /></View>
                  <ScaledText style={[styles.quickCardAmount, amount === '50000' && styles.quickCardAmountActive]}>
                    50.000 đ
                  </ScaledText>
                  <ScaledText style={styles.quickCardLabel}>50K</ScaledText>
                </Pressable>
              </View>

              {/* Card 2: 100.000 đ */}
              <View style={styles.quickCardCol}>
                <Pressable
                  style={[styles.quickCard, amount === '100000' ? styles.quickCardActive : styles.quickCardInactive]}
                  onPress={() => setAmount('100000')}
                >
                  <View style={[styles.radioCircle, amount === '100000' && styles.radioCircleActive]}>
                    {amount === '100000' ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <View style={styles.radioInnerEmpty} />
                    )}
                  </View>
                  <View style={{ marginBottom: 6 }}><Icon100K /></View>
                  <ScaledText style={[styles.quickCardAmount, amount === '100000' && styles.quickCardAmountActive]}>
                    100.000 đ
                  </ScaledText>
                  <ScaledText style={styles.quickCardLabel}>100K</ScaledText>
                </Pressable>
              </View>

              {/* Card 3: 200.000 đ */}
              <View style={styles.quickCardCol}>
                <Pressable
                  style={[styles.quickCard, amount === '200000' ? styles.quickCardActive : styles.quickCardInactive]}
                  onPress={() => setAmount('200000')}
                >
                  <View style={[styles.radioCircle, amount === '200000' && styles.radioCircleActive]}>
                    {amount === '200000' ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <View style={styles.radioInnerEmpty} />
                    )}
                  </View>
                  <View style={{ marginBottom: 6 }}><Icon200K /></View>
                  <ScaledText style={[styles.quickCardAmount, amount === '200000' && styles.quickCardAmountActive]}>
                    200.000 đ
                  </ScaledText>
                  <ScaledText style={styles.quickCardLabel}>200K</ScaledText>
                </Pressable>
              </View>

              {/* Card 4: 500.000 đ */}
              <View style={styles.quickCardCol}>
                <Pressable
                  style={[styles.quickCard, amount === '500000' ? styles.quickCardActive : styles.quickCardInactive]}
                  onPress={() => setAmount('500000')}
                >
                  <View style={[styles.radioCircle, amount === '500000' && styles.radioCircleActive]}>
                    {amount === '500000' ? (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    ) : (
                      <View style={styles.radioInnerEmpty} />
                    )}
                  </View>
                  <View style={{ marginBottom: 6 }}><Icon500K /></View>
                  <ScaledText style={[styles.quickCardAmount, amount === '500000' && styles.quickCardAmountActive]}>
                    500.000 đ
                  </ScaledText>
                  <ScaledText style={styles.quickCardLabel}>500K</ScaledText>
                </Pressable>
              </View>
            </View>

          </View>

          {/* Divider with text */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <ScaledText style={styles.dividerText}>{t('orEnterAmount')}</ScaledText>
            <View style={styles.dividerLine} />
          </View>

          {/* Custom amount input */}
          <View style={styles.inputWrap}>
            <View style={styles.inputCurrencyBadge}>
              <ScaledText style={styles.inputCurrencyText}>đ</ScaledText>
            </View>
            <TextInput
              style={styles.input}
              placeholder={t('enterAmount')}
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={amount ? formatVND(parseInt(amount)) : ''}
              onChangeText={(v) => setAmount(v.replace(/[^0-9]/g, ''))}
            />
            {amount.length > 0 && (
              <Pressable onPress={() => setAmount('')} style={{ paddingRight: 12 }}>
                <Ionicons name="close-circle" size={18} color="#D1D5DB" />
              </Pressable>
            )}
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
              <ScaledText style={styles.errorText}>{error}</ScaledText>
            </View>
          )}

          {/* Generate QR Action Banner */}
          <Pressable
            onPress={handleGenerateQR}
            disabled={creatingQR}
          >
            <LinearGradient
              colors={['#D1FAE5', '#E6F7F0']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.generateBanner}
            >
              <View style={styles.generateLeftIconWrap}>
                <MaterialCommunityIcons name="view-grid-plus-outline" size={26} color="#059669" />
              </View>
              <View style={styles.generateTextWrap}>
                <ScaledText style={styles.generateTitle}>Tạo mã QR</ScaledText>
                <ScaledText style={styles.generateSub}>Quét mã để nạp tiền nhanh chóng</ScaledText>
              </View>
              {creatingQR ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <Ionicons name="chevron-forward" size={20} color="#059669" />
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {/* ══ QR Display Section ══ */}
        {qr && (
          <View style={styles.sectionCard}>
            {pollStatus === 'success' ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={68} color="#10B981" />
                <ScaledText style={styles.successTitle}>{t('paymentSuccess')}</ScaledText>
                <ScaledText style={styles.successSub}>+{formatVND(qr.amount)} đ</ScaledText>
              </View>
            ) : (
              <>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderLeft}>
                    <Ionicons name="scan-outline" size={20} color="#059669" />
                    <ScaledText style={styles.sectionTitle}>{t('scanQR')}</ScaledText>
                  </View>
                </View>

                {isExpired ? (
                  <View style={styles.expiredBox}>
                    <Ionicons name="time-outline" size={38} color={colors.danger} />
                    <ScaledText style={styles.expiredText}>{t('expired')}</ScaledText>
                    <Pressable style={styles.refreshBtn} onPress={handleGenerateQR}>
                      <Ionicons name="refresh" size={16} color="#fff" />
                      <ScaledText style={styles.refreshBtnText}>{t('refreshQR')}</ScaledText>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {/* QR image */}
                    <View style={styles.qrWrapper}>
                      <View style={styles.qrContainer}>
                        <Image source={{ uri: qr.qr_url }} style={styles.qrImage} resizeMode="contain" />
                      </View>
                      <View style={styles.qrAmountBadge}>
                        <ScaledText style={styles.qrAmountText}>{formatVND(qr.amount)} đ</ScaledText>
                      </View>
                    </View>

                    {/* Countdown */}
                    <View style={styles.countdownRow}>
                      <Ionicons name="time-outline" size={14} color={countdown < 60 ? colors.danger : '#D97706'} />
                      <ScaledText style={[styles.countdownText, countdown < 60 && { color: colors.danger }]}>
                        {t('expiresIn', { minutes: minuteStr, seconds: secondStr })}
                      </ScaledText>
                    </View>

                    {/* Transfer note */}
                    <View style={styles.noteBox}>
                      <ScaledText style={styles.noteLabel}>{t('transferNote')}</ScaledText>
                      <View style={styles.noteValueRow}>
                        <ScaledText style={styles.noteValue}>{qr.description}</ScaledText>
                        <Pressable hitSlop={8}>
                          <Ionicons name="copy-outline" size={16} color="#059669" />
                        </Pressable>
                      </View>
                    </View>

                    {/* Polling */}
                    <View style={styles.pendingRow}>
                      <ActivityIndicator size="small" color="#059669" />
                      <ScaledText style={styles.pendingText}>{t('paymentPending')}</ScaledText>
                    </View>
                  </>
                )}
              </>
            )}
          </View>
        )}

        {/* ══ Transaction History ══ */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionHeaderLeft}>
              <MaterialCommunityIcons name="file-document-outline" size={22} color="#059669" />
              <ScaledText style={styles.sectionTitle}>{t('history')}</ScaledText>
            </View>
            <Pressable onPress={() => {}} hitSlop={8}>
              <ScaledText style={styles.seeAllText}>Xem tất cả &gt;</ScaledText>
            </Pressable>
          </View>

          {loadingHistory ? (
            <View style={styles.shimmerWrap}>
              {[1, 2, 3].map((i) => (
                <View key={i} style={styles.shimmerRow}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#E2E8F0' }} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={{ width: '60%', height: 14, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                    <View style={{ width: '40%', height: 10, backgroundColor: '#E2E8F0', borderRadius: 4 }} />
                  </View>
                </View>
              ))}
            </View>
          ) : payments.length === 0 ? (
            <View style={styles.emptyWrap}>
              <EmptyHistoryGraphic />
              <ScaledText style={styles.emptyTitle}>{t('noHistory')}</ScaledText>
              <ScaledText style={styles.emptySub}>Các giao dịch sẽ được hiển thị tại đây</ScaledText>
            </View>
          ) : (
            payments.map((p, idx) => (
              <View key={p.id} style={[styles.paymentRow, idx === payments.length - 1 && { borderBottomWidth: 0 }]}>
                <Ionicons name={statusIcon(p.status) as any} size={20} color={statusColor(p.status)} />
                <View style={styles.paymentInfo}>
                  <ScaledText style={styles.paymentAmount}>+{formatVND(p.amount)} đ</ScaledText>
                  <ScaledText style={styles.paymentDate}>
                    {new Date(p.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </ScaledText>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) + '15' }]}>
                  <View style={[styles.statusDot, { backgroundColor: statusColor(p.status) }]} />
                  <ScaledText style={[styles.statusText, { color: statusColor(p.status) }]}>{formatStatus(p.status, t)}</ScaledText>
                </View>
              </View>
            ))
          )}
        </View>
      </RippleRefreshScrollView>
    </Screen>
  );
}

function createStyles(scaledTypography: { size: { xs: number; sm: number; md: number; lg: number; xl: number } }, topInset: number) {
  return StyleSheet.create({
    screenBg: {
      backgroundColor: '#F5FAF7',
    },
    scroll: {
      paddingBottom: spacing.xxl + 24,
    },

    // ── Header ──────────────────────────────────────────
    header: {
      paddingTop: topInset + spacing.xs,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      color: '#064E3B',
      fontSize: scaledTypography.size.md + 2,
      fontWeight: '700',
    },
    headerAction: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E2F1EC',
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.03,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
    },

    // ── Balance Card ────────────────────────────────────
    balanceCardWrapper: {
      marginHorizontal: 16,
      marginTop: 8,
      marginBottom: 16,
      borderRadius: 24,
      shadowColor: '#059669',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    balanceCard: {
      borderRadius: 24,
      padding: 20,
      paddingVertical: 22,
      borderWidth: 1,
      borderColor: '#DCF0E9',
      position: 'relative',
      overflow: 'hidden',
    },
    balanceCardContent: {
      zIndex: 2,
    },
    balanceLabel: {
      color: '#4B5563',
      fontSize: scaledTypography.size.xs + 1,
      fontWeight: '500',
      marginBottom: 4,
    },
    balanceRow: {
      flexDirection: 'row',
      alignItems: 'baseline',
      gap: 4,
      marginBottom: 10,
    },
    balanceValue: {
      color: '#007A5E',
      fontSize: scaledTypography.size.xl + 12,
      fontWeight: '800',
      lineHeight: Math.round((scaledTypography.size.xl + 12) * 1.15),
    },
    balanceUnit: {
      color: '#007A5E',
      fontSize: scaledTypography.size.lg,
      fontWeight: '600',
    },
    badgePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: '#DDF4EC',
      paddingHorizontal: 12,
      paddingVertical: 5,
      borderRadius: 20,
      alignSelf: 'flex-start',
      borderWidth: 1,
      borderColor: '#C3ECE0',
    },
    badgeText: {
      color: '#059669',
      fontSize: scaledTypography.size.xs,
      fontWeight: '600',
    },

    // ── Main Section Cards ──────────────────────────────
    sectionCard: {
      backgroundColor: '#FFFFFF',
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: 24,
      padding: 18,
      borderWidth: 1,
      borderColor: '#F0F4F2',
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sectionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    sectionTitle: {
      fontSize: scaledTypography.size.md + 1,
      fontWeight: '700',
      color: '#111827',
    },
    securityRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    securityText: {
      fontSize: scaledTypography.size.xs,
      color: '#059669',
      fontWeight: '500',
    },
    seeAllText: {
      fontSize: scaledTypography.size.xs + 1,
      color: '#059669',
      fontWeight: '600',
    },

    // ── Quick Amounts Grid (2x2) ────────────────────────
    quickGridWrapper: {
      position: 'relative',
      marginBottom: 16,
    },
    quickGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    quickCardCol: {
      width: '48.2%',
    },
    quickCard: {
      borderRadius: 18,
      padding: 16,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    quickCardActive: {
      backgroundColor: '#EBF8F4',
      borderWidth: 1.5,
      borderColor: '#059669',
    },
    quickCardInactive: {
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    radioCircle: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: '#D1D5DB',
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioCircleActive: {
      backgroundColor: '#059669',
      borderColor: '#059669',
    },
    radioInnerEmpty: {
      width: 0,
      height: 0,
    },
    quickCardAmount: {
      fontSize: scaledTypography.size.sm + 1,
      fontWeight: '700',
      color: '#111827',
    },
    quickCardAmountActive: {
      color: '#059669',
    },
    quickCardLabel: {
      fontSize: scaledTypography.size.xs,
      color: '#6B7280',
      marginTop: 2,
    },

    // ── Divider ─────────────────────────────────────────
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 18,
      marginBottom: 14,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: '#E5E7EB',
    },
    dividerText: {
      fontSize: scaledTypography.size.xs,
      color: '#6B7280',
      marginHorizontal: 12,
    },

    // ── Input ────────────────────────────────────────────
    inputWrap: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#E5E7EB',
      borderRadius: 14,
      backgroundColor: '#F9FAFB',
      height: 50,
      overflow: 'hidden',
      marginBottom: 14,
    },
    inputCurrencyBadge: {
      width: 46,
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      borderRightWidth: 1,
      borderRightColor: '#E5E7EB',
    },
    inputCurrencyText: {
      fontSize: scaledTypography.size.sm,
      fontWeight: '600',
      color: '#374151',
    },
    input: {
      flex: 1,
      paddingHorizontal: 14,
      fontSize: scaledTypography.size.sm,
      color: '#111827',
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#FEF2F2',
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 10,
    },
    errorText: {
      color: colors.danger,
      fontSize: scaledTypography.size.xs,
      flex: 1,
    },

    // ── Generate QR Banner ──────────────────────────────
    generateBanner: {
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: '#A7F3D0',
    },
    generateLeftIconWrap: {
      marginRight: 12,
    },
    generateTextWrap: {
      flex: 1,
    },
    generateTitle: {
      color: '#064E3B',
      fontSize: scaledTypography.size.sm + 1,
      fontWeight: '700',
    },
    generateSub: {
      color: '#047857',
      fontSize: scaledTypography.size.xs,
      marginTop: 2,
    },

    // ── QR Section ───────────────────────────────────────
    qrWrapper: {
      alignItems: 'center',
      marginBottom: 14,
    },
    qrContainer: {
      backgroundColor: '#fff',
      borderRadius: 20,
      padding: 14,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    qrImage: {
      width: 200,
      height: 200,
    },
    qrAmountBadge: {
      marginTop: 12,
      backgroundColor: '#E6F7F0',
      paddingHorizontal: 20,
      paddingVertical: 6,
      borderRadius: 20,
    },
    qrAmountText: {
      fontSize: scaledTypography.size.md + 2,
      fontWeight: '800',
      color: '#059669',
    },
    countdownRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 12,
    },
    countdownText: {
      color: '#D97706',
      fontSize: scaledTypography.size.xs,
      fontWeight: '600',
    },
    noteBox: {
      backgroundColor: '#F9FAFB',
      borderRadius: 14,
      padding: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: '#E5E7EB',
    },
    noteLabel: {
      fontSize: scaledTypography.size.xs,
      color: '#6B7280',
      marginBottom: 4,
    },
    noteValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    noteValue: {
      fontSize: scaledTypography.size.sm,
      color: '#111827',
      fontWeight: '700',
      flex: 1,
    },
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: '#EFF9F5',
      borderRadius: 12,
      paddingVertical: 10,
    },
    pendingText: {
      color: '#4B5563',
      fontSize: scaledTypography.size.xs,
    },
    expiredBox: {
      alignItems: 'center',
      paddingVertical: 20,
      gap: 12,
    },
    expiredText: {
      color: colors.danger,
      fontSize: scaledTypography.size.sm,
      fontWeight: '600',
    },
    refreshBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#059669',
      paddingVertical: 8,
      paddingHorizontal: 20,
      borderRadius: 12,
    },
    refreshBtnText: {
      color: '#fff',
      fontSize: scaledTypography.size.xs,
      fontWeight: '600',
    },
    successBox: {
      alignItems: 'center',
      paddingVertical: 24,
      gap: 8,
    },
    successTitle: {
      color: colors.success,
      fontSize: scaledTypography.size.lg,
      fontWeight: '700',
    },
    successSub: {
      color: '#6B7280',
      fontSize: scaledTypography.size.sm,
    },

    // ── History Section ──────────────────────────────────
    emptyWrap: {
      alignItems: 'center',
      paddingVertical: 16,
    },
    emptyTitle: {
      color: '#374151',
      fontSize: scaledTypography.size.sm + 1,
      fontWeight: '600',
      marginTop: 8,
    },
    emptySub: {
      color: '#9CA3AF',
      fontSize: scaledTypography.size.xs,
      marginTop: 4,
    },
    shimmerWrap: {
      gap: 12,
      paddingVertical: 4,
    },
    shimmerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    paymentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F3F4F6',
    },
    paymentInfo: {
      flex: 1,
    },
    paymentAmount: {
      fontSize: scaledTypography.size.sm,
      fontWeight: '700',
      color: '#111827',
    },
    paymentDate: {
      fontSize: scaledTypography.size.xs,
      color: '#6B7280',
      marginTop: 2,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 20,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    statusText: {
      fontSize: scaledTypography.size.xs,
      fontWeight: '600',
    },
  });
}
