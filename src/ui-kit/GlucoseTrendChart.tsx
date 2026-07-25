import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { ScaledText as Text } from '../components/ScaledText';
import { colors, radius, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

export type GlucosePoint = {
  label: string;
  value: number;
};

type Props = {
  data: GlucosePoint[];
  height?: number;
};

const RANGE = { low: 70, high: 140 };

function getPointColor(value: number): string {
  if (value < RANGE.low)    return '#f87171';
  if (value <= 100)          return '#34d399';
  if (value <= RANGE.high)   return '#fbbf24';
  return '#f87171';
}

function getStatusLabel(value: number, t: (k: string) => string): { text: string; color: string } {
  if (value < RANGE.low)   return { text: t('glucoseLow'),    color: '#f87171' };
  if (value <= 100)         return { text: t('glucoseNormal'), color: '#34d399' };
  if (value <= RANGE.high)  return { text: t('glucoseBorder'), color: '#fbbf24' };
  return                           { text: t('glucoseHigh'),   color: '#f87171' };
}

function buildBezierPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return pts.length === 1 ? `M ${pts[0].x} ${pts[0].y}` : '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

const PAD = { top: 32, bottom: 44, left: 52, right: 20 };

export const GlucoseTrendChart = ({ data, height = 280 }: Props) => {
  const { t } = useTranslation('home');
  const typography = useScaledTypography();
  const { isDark } = useThemeColors();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [cardWidth, setCardWidth] = useState(0);

  const cardBg   = isDark ? '#111f1e' : '#ffffff';
  const gridCol  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';
  const labelCol = isDark ? '#94a3b8' : '#6b7280';
  const textCol  = isDark ? '#f0faf9' : '#111827';

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: cardBg,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.22 : 0.04,
      shadowRadius: 8,
      elevation: 2,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      gap: spacing.sm,
    },
    statItem: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      paddingHorizontal: 4,
      gap: 4,
    },
    statVal:  { fontWeight: '700' },
    statLbl:  { color: labelCol, textAlign: 'center' },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    rangeLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rangeDot: { width: 9, height: 9, borderRadius: 5 },
    legendText: { color: labelCol },
    rangeValue: { color: labelCol, fontWeight: '600' },
  }), [isDark]);

  // Empty state
  const hasData = data?.some((point) => Number.isFinite(point.value) && point.value > 0) ?? false;
  if (!hasData) {
    return (
      <View style={[styles.card, { height: Math.min(height, 220), alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm }]}>
        <Ionicons name="water-outline" size={34} color={colors.primary} />
        <Text style={{ color: textCol, fontSize: typography.size.md, fontWeight: '700', textAlign: 'center' }}>
          {t('noGlucoseData')}
        </Text>
        <Text style={{ color: labelCol, fontSize: typography.size.sm, textAlign: 'center' }}>
          {t('logToSeeTrend')}
        </Text>
      </View>
    );
  }

  const screenW = Math.max(280, cardWidth || Dimensions.get('window').width - spacing.lg * 2);
  const svgH    = height - 52 - 44; // trừ stats + legend
  const chartW  = screenW - PAD.left - PAD.right;
  const chartH  = svgH - PAD.top - PAD.bottom;

  const validValues = data.map(d => d.value).filter(v => Number.isFinite(v) && v > 0);
  const minVal = validValues.length > 0 ? Math.min(...validValues) : 60;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 200;
  const avg    = validValues.length > 0 ? Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length) : 0;

  // Y range: dùng ngưỡng cố định đẹp hơn
  const yMin = Math.max(0, Math.floor((Math.min(minVal, RANGE.low) - 20) / 10) * 10);
  const yMax = Math.ceil((Math.max(maxVal, RANGE.high) + 20) / 10) * 10;
  const yRange = yMax - yMin;

  const getX = (i: number) => data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW;
  const getY = (v: number) => {
    const val = Number.isFinite(v) ? v : 0;
    return chartH - ((val - yMin) / yRange) * chartH;
  };

  const pts = data.map((d, i) => ({
    x: PAD.left + getX(i),
    y: PAD.top  + getY(Number.isFinite(d.value) ? d.value : 0),
    hasData: (d.value ?? 0) > 0,
  }));

  const segments: { x: number; y: number }[][] = [];
  let seg: { x: number; y: number }[] = [];
  pts.forEach(p => {
    if (p.hasData) { seg.push({ x: p.x, y: p.y }); }
    else { if (seg.length > 0) { segments.push(seg); seg = []; } }
  });
  if (seg.length > 0) segments.push(seg);

  const todayIdx      = data.length - 1;
  const normalTopY    = PAD.top + getY(RANGE.high);
  const normalBottomY = PAD.top + getY(RANGE.low);
  const normalH       = normalBottomY - normalTopY;

  // Y ticks — 5 mức cố định đẹp
  const step = Math.ceil(yRange / 4 / 10) * 10;
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yTicks.push(v);

  const { Svg, Path, Circle, Line, Text: ST, G, Rect } = require('react-native-svg');

  const lastStatus = validValues.length > 0 ? getStatusLabel(validValues[validValues.length - 1], t) : null;

  return (
    <View
      style={styles.card}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth !== cardWidth) setCardWidth(nextWidth);
      }}
    >
      {/* One reference range keeps the chart readable without competing legends. */}
      <View style={styles.rangeRow}>
        <View style={styles.rangeLabel}>
          <View style={[styles.rangeDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { fontSize: typography.size.xs }]}>{t('glucoseReference')}</Text>
        </View>
        <Text style={[styles.rangeValue, { fontSize: typography.size.xs }]}>{RANGE.low}–{RANGE.high} mg/dL</Text>
        {lastStatus && (
          <View style={{ marginLeft: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 5,
            backgroundColor: `${lastStatus.color}18`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: lastStatus.color }} />
            <Text style={{ fontSize: typography.size.xs, color: lastStatus.color, fontWeight: '700' }}>{lastStatus.text}</Text>
          </View>
        )}
      </View>

      <Svg width={screenW} height={svgH}>
        {/* Reference range is a quiet backdrop; the measured line remains primary. */}
        {normalH > 0 && (
          <Rect x={PAD.left} y={normalTopY} width={chartW} height={normalH}
            fill={colors.primary} opacity={0.06} />
        )}

        {/* Đường viền trên/dưới vùng bình thường */}
        {normalH > 0 && (
          <>
            <Line x1={PAD.left} y1={normalTopY} x2={PAD.left + chartW} y2={normalTopY}
              stroke={colors.primary} strokeWidth={1} strokeDasharray="4,4" opacity={0.28} />
            <Line x1={PAD.left} y1={normalBottomY} x2={PAD.left + chartW} y2={normalBottomY}
              stroke={colors.primary} strokeWidth={1} strokeDasharray="4,4" opacity={0.28} />
            <ST x={PAD.left - 4} y={normalTopY + 4} fontSize={9} fontFamily="Inter_400Regular" fill={labelCol} textAnchor="end">
              {RANGE.high}
            </ST>
            <ST x={PAD.left - 4} y={normalBottomY + 4} fontSize={9} fontFamily="Inter_400Regular" fill={labelCol} textAnchor="end">
              {RANGE.low}
            </ST>
          </>
        )}

        {/* Grid lines + Y labels */}
        {yTicks.map((tick, i) => (
          <G key={`g-${i}`}>
            <Line
              x1={PAD.left} y1={PAD.top + getY(tick)}
              x2={PAD.left + chartW} y2={PAD.top + getY(tick)}
              stroke={gridCol} strokeWidth={1}
            />
            <ST
              x={PAD.left - 8} y={PAD.top + getY(tick) + 4}
              fontSize={11} fontFamily="Inter_400Regular" fill={labelCol} textAnchor="end" fontWeight="500"
            >
              {tick}
            </ST>
          </G>
        ))}

        {/* Line */}
        {segments.map((s, si) => {
          if (s.length < 2) return null;
          return (
            <Path key={`line-${si}`}
              d={buildBezierPath(s)}
              stroke={colors.primary} strokeWidth={2.5}
              fill="none" strokeLinecap="round" strokeLinejoin="round"
            />
          );
        })}

        {/* X labels */}
        {data.map((point, i) => {
          const isToday = i === todayIdx;
          const hasD    = (point.value ?? 0) > 0;
          const x       = PAD.left + getX(i);
          const yLbl    = PAD.top + chartH + 22;
          return (
            <G key={`xl-${i}`}>
              <ST x={x} y={yLbl}
                fontSize={isToday ? 12 : 11}
                fontFamily={isToday ? 'Inter_700Bold' : 'Inter_400Regular'}
                fontWeight={isToday ? '700' : '500'}
                fill={isToday ? colors.primary : hasD ? textCol : labelCol}
                textAnchor="middle"
              >
                {point.label}
              </ST>
            </G>
          );
        })}

        {/* Data points */}
        {data.map((point, i) => {
          const val        = Number.isFinite(point.value) ? point.value : 0;
          const hasD       = val > 0;
          const cx         = pts[i].x;
          const cy         = pts[i].y;
          const isSelected = selectedIdx === i;
          const dotColor   = hasD ? getPointColor(val) : labelCol;

          return (
            <G key={`p-${i}`}>
              <Circle cx={cx} cy={cy} r={24} fill="transparent"
                onPress={() => setSelectedIdx(isSelected ? null : i)} />

              {isSelected && hasD && (
                <Circle cx={cx} cy={cy} r={13} fill={dotColor} opacity={0.15} />
              )}

              {hasD ? (
                <>
                  {/* Shadow dot */}
                  <Circle cx={cx} cy={cy + 2} r={isSelected ? 8 : 6}
                    fill={dotColor} opacity={0.2} />
                  <Circle
                    cx={cx} cy={cy}
                    r={isSelected ? 8 : 6}
                    fill={isDark ? '#1e2a29' : '#ffffff'}
                    stroke={dotColor} strokeWidth={isSelected ? 3 : 2.5}
                  />
                </>
              ) : (
                <Line
                  x1={cx - 7} y1={PAD.top + chartH - 6}
                  x2={cx + 7} y2={PAD.top + chartH - 6}
                  stroke={labelCol} strokeWidth={2} strokeLinecap="round" opacity={0.35}
                />
              )}

              {/* Tooltip khi chọn */}
              {isSelected && hasD && (() => {
                const label  = `${Math.round(val)} mg/dL`;
                const status = getStatusLabel(val, t);
                const tipW   = 108;
                const tipH   = 52;
                const tipX   = Math.min(Math.max(cx - tipW / 2, PAD.left), PAD.left + chartW - tipW);
                const tipY   = Math.max(PAD.top + 4, cy - tipH - 14);
                return (
                  <G>
                    {/* Shadow */}
                    <Rect x={tipX + 2} y={tipY + 3} width={tipW} height={tipH} rx={10} fill="rgba(0,0,0,0.08)" />
                    <Rect x={tipX} y={tipY} width={tipW} height={tipH} rx={12}
                      fill={isDark ? '#1e2a29' : '#ffffff'}
                      stroke={isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.08)'} strokeWidth={1}
                    />
                    <ST x={tipX + tipW / 2} y={tipY + 18} fontSize={14} fontWeight="800" fontFamily="Inter_800ExtraBold" fill={textCol} textAnchor="middle">
                      {label}
                    </ST>
                    <ST x={tipX + tipW / 2} y={tipY + 40} fontSize={11} fontWeight="600" fontFamily="Inter_600SemiBold" fill={status.color} textAnchor="middle">
                      {status.text}
                    </ST>
                  </G>
                );
              })()}
            </G>
          );
        })}
      </Svg>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { lbl: t('statMin'), val: validValues.length > 0 ? Math.min(...validValues) : '--', color: getPointColor(minVal) },
          { lbl: t('statAvg'), val: avg || '--',                                              color: avg > 0 ? getPointColor(avg) : labelCol },
          { lbl: t('statMax'), val: validValues.length > 0 ? Math.max(...validValues) : '--', color: getPointColor(maxVal) },
        ].map((item, i) => (
          <View key={i} style={styles.statItem}>
            <Text style={[styles.statVal, { fontSize: typography.size.sm, color: item.color }]}>
              {typeof item.val === 'number' ? `${item.val}` : item.val}
            </Text>
            <Text style={[styles.statLbl, { fontSize: typography.size.xs }]}>{item.lbl}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};
