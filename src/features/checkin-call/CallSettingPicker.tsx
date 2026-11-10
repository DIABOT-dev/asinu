import { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QueuedModal } from '../../components/QueuedModal';
import { ScaledText as Text } from '../../components/ScaledText';
import { useThemeColors } from '../../hooks/useThemeColors';
import { useScaledTypography } from '../../hooks/useScaledTypography';

type Props = {
  title: string;
  value: string | number;
  values?: number[];
  unit?: string;
  inline?: boolean;
  onConfirm: (value: string | number) => void;
  onClose: () => void;
};
const hours = Array.from({ length: 24 }, (_, value) => ({ value, label: String(value).padStart(2, '0') }));
const minutes = Array.from({ length: 60 }, (_, value) => ({ value, label: String(value).padStart(2, '0') }));

export function CallSettingPicker({ title, value, values, unit, inline = false, onConfirm, onClose }: Props) {
  const { t } = useTranslation('checkinCall');
  const { t: tc } = useTranslation('common');
  const { colors } = useThemeColors();
  const { height, fontScale } = useWindowDimensions();
  const { scaledSize } = useScaledTypography();
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState(value);
  const [spinning, setSpinning] = useState(false);
  const activeWheels = useRef(new Set<string>());
  const data = useMemo(() => (values || [Number(value)]).map(number => ({ value: number, label: String(number) })), [values, value]);
  const time = typeof selected === 'string';
  const hour = time ? Number(selected.slice(0, 2)) : 0;
  const minute = time ? Number(selected.slice(3, 5)) : 0;
  const rowHeight = Math.max(48, Math.ceil(scaledSize.xl * fontScale * 1.5));
  const visibleRows = rowHeight * 3 > height * 0.45 ? 1 : height < 740 || fontScale > 1.3 ? 3 : 5;
  const start = (key: string) => { activeWheels.current.add(key); setSpinning(true); };
  const stop = (key: string) => { activeWheels.current.delete(key); setSpinning(activeWheels.current.size > 0); };
  const changeTime = (part: 'hour' | 'minute', next: number) => setSelected(previous => {
    const parts = String(previous).split(':');
    parts[part === 'hour' ? 0 : 1] = String(next).padStart(2, '0');
    return parts.join(':');
  });
  const column = (key: string, label: string, items: typeof hours, current: number, change: (next: number) => void) => (
    <View key={key} style={styles.column}>
      <Text style={[styles.unit, { color: colors.textSecondary }]}>{label}</Text>
      <View accessible accessibilityRole="adjustable" accessibilityLabel={label}
        accessibilityValue={{ text: `${current} ${label}` }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={event => {
          const position = items.findIndex(item => item.value === current);
          const next = Math.max(0, Math.min(items.length - 1, position + (event.nativeEvent.actionName === 'increment' ? 1 : -1)));
          change(items[next].value);
        }}>
        <WheelPicker testID={`call-setting-wheel-${key}`} data={items} value={current}
          width="100%" itemHeight={rowHeight} visibleItemCount={visibleRows}
          enableScrollByTapOnItem disableIntervalMomentum
          itemTextStyle={{ color: colors.textPrimary, fontSize: scaledSize.xl, fontWeight: '600' }}
          overlayItemStyle={{ backgroundColor: colors.primary, opacity: 0.12, borderRadius: 12 }}
          _onScrollStart={() => start(key)} _onScrollEnd={() => stop(key)}
          onValueChanged={({ item }) => change(item.value)} />
      </View>
    </View>
  );

  const content = <View accessibilityViewIsModal={!inline} style={[styles.dialog, inline && styles.inlineDialog, { backgroundColor: colors.surface }]}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={tc('close')} style={styles.close} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.textSecondary} />
          </Pressable>
        </View>
        <View style={styles.wheels}>
          {time ? <>
            {column('hour', t('unitHours'), hours, hour, next => changeTime('hour', next))}
            {column('minute', t('unitMinutes'), minutes, minute, next => changeTime('minute', next))}
          </> : column('value', unit || title, data, Number(selected), setSelected)}
        </View>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={onClose} style={[styles.button, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.buttonText, { color: colors.textPrimary }]}>{tc('cancel')}</Text>
          </Pressable>
          <Pressable testID="call-setting-picker-confirm" accessibilityRole="button" disabled={spinning}
            accessibilityState={{ disabled: spinning }} onPress={() => { if (!spinning) onConfirm(selected); }}
            style={[styles.button, { backgroundColor: colors.primary, opacity: spinning ? 0.5 : 1 }]}>
            <Text style={[styles.buttonText, { color: colors.surface }]}>{tc('confirm')}</Text>
          </Pressable>
        </View>
      </View>;
  // Schedule editing already has a modal presenter. Keep its wheels inline so
  // they cannot queue behind the very sheet containing the time field.
  if (inline) return content;
  return <QueuedModal visible transparent animationType="fade" priority={10} interruptible onRequestClose={onClose}>
    <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        accessibilityRole="button" accessibilityLabel={tc('cancel')} onPress={onClose} />
      {content}
    </View>
  </QueuedModal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  dialog: { width: '100%', maxWidth: 560, alignSelf: 'center', borderRadius: 24, padding: 20, gap: 16 },
  inlineDialog: { borderRadius: 16, padding: 12 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { flex: 1, fontSize: 19, fontWeight: '700' },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  wheels: { flexDirection: 'row', gap: 16 },
  column: { flex: 1, minWidth: 0 },
  unit: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  footer: { flexDirection: 'row', gap: 12 },
  button: { flex: 1, minHeight: 48, borderRadius: 14, padding: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '700' },
});
