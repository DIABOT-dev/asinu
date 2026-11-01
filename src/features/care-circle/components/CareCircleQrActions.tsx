import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { ScaledText as Text } from '../../../components/ScaledText';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { spacing } from '../../../styles';
import { useAuthStore } from '../../auth/auth.store';
import { useCareCircleQr } from '../useCareCircleQr';

export function CareCircleQrActions() {
  const { t } = useTranslation('careCircle');
  const { t: tc } = useTranslation('common');
  const { colors } = useThemeColors();
  const { width } = useWindowDimensions();
  const profile = useAuthStore((state) => state.profile);
  const { qr, loading, error, loadCode } = useCareCircleQr();
  const codeSize = Math.min(304, Math.max(144, width - spacing.lg * 2 - 32));

  return (
    <View style={styles.section}>
      {!!profile?.name && <Text style={[styles.name, { color: colors.textPrimary }]}>{profile.name}</Text>}
      <View style={[styles.codeFrame, !loading && qr && styles.qrCodeFrame]} accessible accessibilityLabel={t('qrIdentityHint')}>
        {loading ? (
          <View style={[styles.placeholder, { width: codeSize + 32, minHeight: codeSize + 32 }]}>
            <ActivityIndicator size="large" color={colors.primaryDark} />
            <Text style={[styles.message, { color: colors.textSecondary }]}>{t('qrCreating')}</Text>
          </View>
        ) : qr ? (
          <QRCode value={qr.value} size={codeSize} quietZone={16} color="#0f172a" backgroundColor="#ffffff" />
        ) : (
          <View style={[styles.placeholder, { width: codeSize + 32, minHeight: codeSize + 32 }]}>
            <Ionicons name="qr-code-outline" size={36} color={colors.textSecondary} />
            <Text style={[styles.message, { color: colors.textSecondary }]}>{error || t('qrUnavailableTitle')}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadCode()} style={styles.retry}>
              <Text style={[styles.retryText, { color: colors.primaryText }]}>{tc('retry')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: spacing.lg, marginBottom: spacing.lg, alignItems: 'center', gap: 12 },
  name: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  // The light quiet zone is part of the code, preserving scanner contrast in both themes.
  codeFrame: { alignItems: 'center', justifyContent: 'center', borderRadius: 16, overflow: 'hidden' },
  qrCodeFrame: { backgroundColor: '#ffffff' },
  placeholder: { alignItems: 'center', justifyContent: 'center', gap: 12, padding: 16 },
  message: { fontSize: 16, textAlign: 'center' },
  retry: { minHeight: 48, minWidth: 100, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 18, fontWeight: '600' },
});
