import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
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

// Ngưỡng đường huyết (mg/dL)
const RANGE = { low: 70, high: 140 };

function getPointColor(value: number): string {
  if (value < RANGE.low) return '#f87171';       // thấp → đỏ
  if (value <= 100)       return '#34d399';       // bình thường → xanh lá
  if (value <= RANGE.high) return '#fbbf24';      // hơi cao → vàng
  return '#f87171';                               // cao → đỏ
}

function getStatusLabel(value: number, t: (k: string) => string): { text: string; color: string } {
  if (value < RANGE.low)   return { text: t('glucoseLow'),    color: '#f87171' };
  if (value <= 100)         return { text: t('glucoseNormal'), color: '#34d399' };
  if (value <= RANGE.high)  return { text: t('glucoseBorder'), color: '#fbbf24' };
  return                           { text: t('glucoseHigh'),   color: '#f87171' };
}

// Tạo smooth bezier path từ danh sách điểm
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

const PAD = { top: 24, bottom: 36, left: 44, right: 16 };

export const GlucoseTrendChart = ({ data, height = 240 }: Props) => {
  const { t } = useTranslation('home');
  const typography = useScaledTypography();
  const { isDark } = useThemeColors();
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  const cardBg   = isDark ? '#111f1e' : '#ffffff';
  const gridCol  = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const labelCol = isDark ? '#94a3b8' : '#64748b';
  const textCol  = isDark ? '#f0faf9' : '#1a2e2b';

  const styles = useMemo(() => StyleSheet.create({
    card: {
      backgroundColor: cardBg,
      borderRadius: radius.xl,
      borderWidth: 1.5,
      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.08,
      shadowRadius: 12,
      elevation: 4,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderTopWidth: 1,
      borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    },
    statItem: { alignItems: 'center', gap: 2 },
    statVal:  { fontWeight: '700', color: textCol },
    statLbl:  { color: labelCol },
  }), [isDark]);

  // Empty state
  if (!data || data.length === 0) {
    return (
      <View style={[styles.card, { height, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
        <Ionicons name="water-outline" size={44} color={colors.primary} />
        <Text style={{ color: textCol, fontSize: typography.size.md, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' }}>
          {t('noGlucoseData')}
        </Text>
        <Text style={{ color: labelCol, fontSize: typography.size.sm, marginTop: spacing.xs, textAlign: 'center' }}>
          {t('logToSeeTrend')}
        </Text>
      </View>
    );
  }

  const screenW  = Dimensions.get('window').width - 48;
  const chartW   = screenW - PAD.left - PAD.right;
  const chartH   = height - PAD.top - PAD.bottom - 52; // 52 = stats row

  const validValues = data.map(d => d.value).filter(v => Number.isFinite(v) && v > 0);
  const minVal = validValues.length > 0 ? Math.min(...validValues) : 0;
  const maxVal = validValues.length > 0 ? Math.max(...validValues) : 200;
  const avg    = validValues.length > 0 ? Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length) : 0;

  // Y range: thêm padding 15% mỗi đầu, ít nhất hiển thị từ 50-200
  const yPad = Math.max((maxVal - minVal) * 0.15, 15);
  const yMin = Math.max(0,   minVal - yPad);
  const yMax = Math.max(200, maxVal + yPad);
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

  // Tách thành các đoạn liên tiếp chỉ gồm điểm có dữ liệu
  const segments: { x: number; y: number }[][] = [];
  let seg: { x: number; y: number }[] = [];
  pts.forEach(p => {
    if (p.hasData) {
      seg.push({ x: p.x, y: p.y });
    } else {
      if (seg.length > 0) { segments.push(seg); seg = []; }
    }
  });
  if (seg.length > 0) segments.push(seg);

  const todayIdx = data.length - 1; // ngày cuối = hôm nay

  // Vùng bình thường
  const normalTopY    = PAD.top + getY(RANGE.high);
  const normalBottomY = PAD.top + getY(RANGE.low);
  const normalH       = normalBottomY - normalTopY;

  // Y ticks (4 mức đẹp)
  const yTicks = [yMin, yMin + yRange * 0.33, yMin + yRange * 0.66, yMax].map(v => Math.round(v));

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Svg, Path, Circle, Line, Text: ST, G, Rect, Defs, LinearGradient, Stop } = require('react-native-svg');

  const lastStatus = validValues.length > 0 ? getStatusLabel(validValues[validValues.length - 1], t) : null;

  return (
    <View style={styles.card}>
      <Svg width={screenW} height={height - 52}>
        <Defs>
          <LinearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0"   stopColor={colors.primary} stopOpacity="0.25" />
            <Stop offset="1"   stopColor={colors.primary} stopOpacity="0" />
          </LinearGradient>
        </Defs>

        {/* Vùng bình thường (70–140) */}
        {normalH > 0 && (
          <Rect
            x={PAD.left}
            y={normalTopY}
            width={chartW}
            height={normalH}
            fill="#34d399"
            opacity={0.08}
          />
        )}

        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <G key={`g-${i}`}>
            <Line
              x1={PAD.left} y1={PAD.top + getY(tick)}
              x2={PAD.left + chartW} y2={PAD.top + getY(tick)}
              stroke={gridCol} strokeWidth={1} strokeDasharray="4,4"
            />
            <ST
              x={PAD.left - 6} y={PAD.top + getY(tick) + 4}
              fontSize={10} fill={labelCol} textAnchor="end"
            >
              {tick}
            </ST>
          </G>
        ))}

        {/* Area fill — mỗi đoạn có dữ liệu */}
        {segments.map((s, si) => {
          if (s.length < 2) return null;
          const sp = buildBezierPath(s);
          const ap = `${sp} L ${s[s.length-1].x} ${PAD.top + chartH} L ${s[0].x} ${PAD.top + chartH} Z`;
          return <Path key={`area-${si}`} d={ap} fill="url(#areaGrad)" />;
        })}

        {/* Line — chỉ vẽ giữa các điểm có dữ liệu */}
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

        {/* X labels — highlight hôm nay */}
        {data.map((point, i) => {
          const isToday = i === todayIdx;
          const hasD    = (point.value ?? 0) > 0;
          const x       = PAD.left + getX(i);
          const yLbl    = PAD.top + chartH + 20;
          return (
            <G key={`xl-${i}`}>
              {/* Pill highlight cho hôm nay */}
              {isToday && (
                <Rect x={x - 14} y={yLbl - 13} width={28} height={18} rx={9}
                  fill={colors.primary} opacity={0.15} />
              )}
              <ST x={x} y={yLbl}
                fontSize={isToday ? 11 : 10}
                fontWeight={isToday ? '700' : '400'}
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
          const hasData    = val > 0;
          const cx         = pts[i].x;
          const cy         = pts[i].y;
          const isSelected = selectedIdx === i;
          const dotColor   = hasData ? getPointColor(val) : labelCol;

          return (
            <G key={`p-${i}`}>
              {/* Touch area */}
              <Circle cx={cx} cy={cy} r={22} fill="transparent"
                onPress={() => setSelectedIdx(isSelected ? null : i)} />

              {/* Outer ring khi selected */}
              {isSelected && (
                <Circle cx={cx} cy={cy} r={11} fill={dotColor} opacity={0.2} />
              )}

              {/* Dot hoặc dấu "-" cho ngày không đo */}
              {hasData ? (
                <Circle
                  cx={cx} cy={cy}
                  r={isSelected ? 7 : 5}
                  fill={isSelected ? dotColor : (isDark ? '#1e2a29' : '#ffffff')}
                  stroke={dotColor} strokeWidth={2.5}
                />
              ) : (
                <Line
                  x1={cx - 6} y1={PAD.top + chartH - 4}
                  x2={cx + 6} y2={PAD.top + chartH - 4}
                  stroke={labelCol} strokeWidth={1.5} strokeLinecap="round" opacity={0.4}
                />
              )}

              {/* Tooltip */}
              {isSelected && hasData && (() => {
                const label  = `${Math.round(val)} mg/dL`;
                const status = getStatusLabel(val, t);
                const tipW   = Math.max(label.length * 7.5 + 20, 90);
                const tipH   = 44;
                const tipX   = Math.min(
                  Math.max(cx - tipW / 2, PAD.left),
                  PAD.left + chartW - tipW
                );
                const tipY = cy - tipH - 12;
                return (
                  <G>
                    <Rect x={tipX + 2} y={tipY + 3} width={tipW} height={tipH} rx={10} fill="rgba(0,0,0,0.12)" />
                    <Rect x={tipX} y={tipY} width={tipW} height={tipH} rx={10}
                      fill={isDark ? '#1e2a29' : '#ffffff'}
                      stroke={dotColor} strokeWidth={1.5}
                    />
                    <ST x={tipX + tipW / 2} y={tipY + 17} fontSize={13} fontWeight="700" fill={textCol} textAnchor="middle">
                      {label}
                    </ST>
                    <ST x={tipX + tipW / 2} y={tipY + 33} fontSize={11} fill={status.color} textAnchor="middle">
                      {status.text}
                    </ST>
                  </G>
                );
              })()}
            </G>
          );
        })}

        {/* Normal range label bên phải */}
        {normalH > 20 && (
          <ST
            x={PAD.left + chartW + 4}
            y={normalTopY + normalH / 2 + 4}
            fontSize={9} fill="#34d399" textAnchor="start"
          >
            OK
          </ST>
        )}
      </Svg>

      {/* Stats row */}
      <View style={styles.statsRow}>
        {[
          { lbl: t('statMin'), val: validValues.length > 0 ? Math.min(...validValues) : '--', color: getPointColor(minVal) },
          { lbl: t('statAvg'), val: avg || '--', color: avg > 0 ? getPointColor(avg) : labelCol },
          { lbl: t('statMax'), val: validValues.length > 0 ? Math.max(...validValues) : '--', color: getPointColor(maxVal) },
          ...(lastStatus ? [{ lbl: t('statStatus'), val: lastStatus.text, color: lastStatus.color }] : []),
        ].map((item, i) => (
          <View key={i} style={styles.statItem}>
            <Text style={[styles.statVal, { fontSize: typography.size.sm, color: item.color }]}>
              {typeof item.val === 'number' ? item.val : item.val}
            </Text>
            <Text style={[styles.statLbl, { fontSize: typography.size.xs }]}>{item.lbl}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};
