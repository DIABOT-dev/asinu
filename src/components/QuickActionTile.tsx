import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useThemeColors } from '../hooks/useThemeColors';

export function QuickActionTile({ label, icon, onPress, style, testID, accessibilityLabel,
  expanded, badgeCount }: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
  expanded?: boolean;
  badgeCount?: number;
}) {
  const { colors, isDark } = useThemeColors();
  return <Pressable testID={testID} accessibilityRole="button"
    accessibilityLabel={accessibilityLabel || label} accessibilityState={{ expanded }}
    onPress={onPress} style={({ pressed }) => [styles.tile, style, { opacity: pressed ? 0.75 : 1 }]}>
    {({ pressed }) => <>
      <View style={[styles.iconFrame, {
        backgroundColor: pressed || expanded ? colors.primaryLight : colors.surface,
        borderColor: expanded ? colors.primaryText : isDark ? colors.border : '#E7F0EC',
        shadowOpacity: isDark ? 0 : 0.05,
      }]}>
        {icon}
        {badgeCount !== undefined && <View pointerEvents="none" accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.badge, { backgroundColor: colors.primaryText, borderColor: colors.surface }]}>
          <Text style={[styles.badgeText, { color: colors.surface }]}>{badgeCount}</Text>
        </View>}
      </View>
      <Text allowFontScaling style={[styles.label, { color: colors.textPrimary }]}>{label}</Text>
    </>}
  </Pressable>;
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', minHeight: 112, gap: 10 },
  iconFrame: { width: 64, height: 64, borderRadius: 21, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#234B42', shadowOffset: { width: 0, height: 4 }, shadowRadius: 10, elevation: 2 },
  label: { fontSize: 14, fontWeight: '600', textAlign: 'center', width: '100%' },
  badge: { position: 'absolute', top: -6, right: -6, minWidth: 24, minHeight: 24,
    paddingHorizontal: 5, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
