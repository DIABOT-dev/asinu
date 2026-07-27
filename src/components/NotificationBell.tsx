import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { useThemeColors } from '../hooks/useThemeColors';
import { typography } from '../styles';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'critical';

export type Notification = {
  id: string;
  type?: string;
  title: string;
  body: string;
  data?: any;
  timestamp: Date;
  read: boolean;
  priority?: NotificationPriority;
};

interface NotificationBellProps {
  unreadCount: number;
  onOpen?: () => void;
}

/** Opens the full notifications screen. The list itself is intentionally not a modal. */
export function NotificationBell({ unreadCount, onOpen }: NotificationBellProps) {
  const scaledTypography = useScaledTypography();
  const { colors } = useThemeColors();
  const { t } = useTranslation('logs');
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('notifications')}
      style={({ pressed }) => [styles.bellButton, pressed && styles.pressed]}
      onPress={onOpen}
    >
      <Ionicons
        name={unreadCount > 0 ? 'notifications' : 'notifications-outline'}
        size={28}
        color={unreadCount > 0 ? colors.primary : colors.textPrimary}
      />
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={[styles.badgeText, { fontSize: scaledTypography.size.xs }]}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>['colors']) {
  return StyleSheet.create({
    bellButton: {
      position: 'relative',
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
    badge: {
      position: 'absolute',
      top: 6,
      right: 6,
      backgroundColor: colors.danger,
      borderRadius: 11,
      minWidth: 22,
      height: 22,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 5,
      borderWidth: 2,
      borderColor: colors.surface,
    },
    badgeText: {
      color: '#fff',
      fontSize: typography.size.xs,
      fontWeight: '800',
    },
    pressed: { opacity: 0.78 },
  });
}
