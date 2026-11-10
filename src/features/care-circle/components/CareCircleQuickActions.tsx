import React from 'react';
import { Image, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { QuickActionTile } from '../../../components/QuickActionTile';
import { useThemeColors } from '../../../hooks/useThemeColors';
import { useFontSizeStore } from '../../../stores/font-size.store';
import { GuideTarget } from '../../guidance/GuidanceProvider';

export function CareCircleQuickActions({ count, expanded, onInvite, onScan, onToggleMembers }: {
  count: number;
  expanded: boolean;
  onInvite: () => void;
  onScan: () => void;
  onToggleMembers: () => void;
}) {
  const { t } = useTranslation('careCircle');
  const { colors } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const multiplier = useFontSizeStore(state => state.multiplier);
  const columns = multiplier * fontScale >= 1.6 ? 2 : 3;
  const tileWidth = (Math.min(width - 32, 420) - 12 * (columns - 1)) / columns;

  return <View style={styles.grid} testID="care-circle-quick-actions">
    <GuideTarget step="circle.add" style={{ width: tileWidth }}>
      <QuickActionTile testID="care-circle-invite-action" label={t('addRelative')} onPress={onInvite}
        icon={<Ionicons name="person-add-outline" size={34} color={colors.primaryText} accessible={false} />} />
    </GuideTarget>
    <QuickActionTile testID="care-circle-scan-action" style={{ width: tileWidth }} label={t('scanQr')} onPress={onScan}
      icon={<Ionicons name="qr-code-outline" size={34} color={colors.primaryText} accessible={false} />} />
    <QuickActionTile testID="care-circle-members-action" style={{ width: tileWidth }} label={t('members')}
      accessibilityLabel={t('activeConnections', { count })} badgeCount={count} expanded={expanded} onPress={onToggleMembers}
      icon={<Image source={require('../../../../assets/images/notifications/family-v1.png')}
        style={styles.image} resizeMode="contain" resizeMethod="resize" accessible={false} />} />
  </View>;
}

const styles = StyleSheet.create({
  grid: { width: '100%', flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  image: { width: 60, height: 60 },
});
