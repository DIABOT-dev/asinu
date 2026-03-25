import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import { useScaledTypography } from '../hooks/useScaledTypography';
import { featureFlags } from '../lib/featureFlags';
import { colors, spacing } from '../styles';
import { useThemeColors } from '../hooks/useThemeColors';

export type TrendPoint = {
  label: string;
  value: number;
};

export type C1TrendChartProps = {
  data: TrendPoint[];
  accentColor?: string;
  height?: number;
  title?: string;
  unit?: string;
};

const CHART_PADDING = { top: 40, bottom: 35, left: 45, right: 20 };

export const C1TrendChart = ({ data, accentColor = colors.primary, height = 220, title, unit }: C1TrendChartProps) => {
  const { t } = useTranslation('tree');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const scaledTypography = useScaledTypography();
  const { isDark } = useThemeColors();
  const styles = useMemo(() => StyleSheet.create({
    container: {
      width: '100%',
      borderRadius: 16,
      backgroundColor: colors.surface,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: colors.border
    },
    chartTitle: {
      fontWeight: '600',
      color: colors.textSecondary,
      paddingHorizontal: spacing.md,
      paddingTop: spacing.sm
    }
  }), [isDark]);
  const disableCharts = featureFlags.disableCharts;

  if (disableCharts) {
    return (
      <View style={[styles.container, { height, alignItems: 'center', justifyContent: 'center', padding: 16 }]}>
        <Text style={{ color: colors.textSecondary, fontSize: scaledTypography.size.md }}>{t('chartHiddenDemo')}</Text>
      </View>
    );
  }

  // Nếu không có dữ liệu
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }]}>
        <Ionicons name="happy-outline" size={48} color={colors.primary} />
        <Text style={{ color: colors.textPrimary, fontSize: scaledTypography.size.md, fontWeight: '700', marginTop: spacing.md, textAlign: 'center' }}>
          {t('noDataYet')}
        </Text>
        <Text style={{ color: colors.textSecondary, fontSize: scaledTypography.size.sm, marginTop: spacing.xs, textAlign: 'center' }}>
          {t('logToSeeTrend')}
        </Text>
      </View>
    );
  }

  // Tính toán dimensions
  const screenWidth = Dimensions.get('window').width - 48; // padding container
  const chartWidth = screenWidth - CHART_PADDING.left - CHART_PADDING.right;
  // titleRowHeight tính theo font size thực tế để tránh X-axis bị cắt
  const titleRowHeight = title ? Math.ceil(scaledTypography.size.sm * 1.6 + 10) : 0;
  const svgHeight = height - titleRowHeight;
  const chartHeight = svgHeight - CHART_PADDING.top - CHART_PADDING.bottom;

  // Lấy tất cả giá trị hợp lệ (kể cả 0)
  const values = data.map(d => d.value).filter(v => Number.isFinite(v) && v >= 0);

  const maxVal = values.length > 0 ? Math.max(...values) : 0;

  // Y luôn bắt đầu từ 0, max ít nhất là 10 để chart không bị flat
  const yMin = 0;
  const yMax = Math.max(maxVal * 1.1, 10);
  const yRange = yMax - yMin;

  // Tạo Y ticks (5 mức)
  const yTickCount = 5;
  const yTicks = Array.from({ length: yTickCount }, (_, i) => {
    return yMin + (yRange * i) / (yTickCount - 1);
  });

  // Chuyển đổi dữ liệu sang tọa độ
  const getX = (index: number) => {
    if (data.length === 1) return chartWidth / 2;
    return (index / (data.length - 1)) * chartWidth;
  };

  const getY = (value: number) => {
    // Đảm bảo giá trị hợp lệ, không trả về NaN
    if (!Number.isFinite(value)) return chartHeight / 2;
    const y = chartHeight - ((value - yMin) / yRange) * chartHeight;
    return Number.isFinite(y) ? y : chartHeight / 2;
  };

  // Tạo path cho đường line (dùng giá trị gốc, 0 vẫn được vẽ)
  const linePath = data.map((point, i) => {
    const val = Number.isFinite(point.value) ? point.value : 0;
    const x = CHART_PADDING.left + getX(i);
    const y = CHART_PADDING.top + getY(val);
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  // Tạo path cho vùng fill
  const areaPath = data.length > 0 ? `
    ${linePath}
    L ${CHART_PADDING.left + getX(data.length - 1)} ${CHART_PADDING.top + chartHeight}
    L ${CHART_PADDING.left + getX(0)} ${CHART_PADDING.top + chartHeight}
    Z
  ` : '';

  // Lazy import SVG
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { Svg, Path, Circle, Line, Text: SvgText, G, Rect } = require('react-native-svg');

  return (
    <View style={[styles.container, { height }]}>
      {title && (
        <Text style={[styles.chartTitle, { fontSize: scaledTypography.size.sm }]}>{title}{unit ? ` (${unit})` : ''}</Text>
      )}
      <Svg width={screenWidth} height={svgHeight}>
        {/* Grid lines ngang */}
        {yTicks.map((tick, i) => (
          <Line
            key={`grid-${i}`}
            x1={CHART_PADDING.left}
            y1={CHART_PADDING.top + getY(tick)}
            x2={CHART_PADDING.left + chartWidth}
            y2={CHART_PADDING.top + getY(tick)}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="4,4"
            opacity={0.5}
          />
        ))}

        {/* Y axis labels */}
        {yTicks.map((tick, i) => (
          <SvgText
            key={`y-label-${i}`}
            x={CHART_PADDING.left - 8}
            y={CHART_PADDING.top + getY(tick) + 4}
            fontSize={11}
            fill={colors.textSecondary}
            textAnchor="end"
          >
            {Math.round(tick)}
          </SvgText>
        ))}

        {/* X axis labels */}
        {data.map((point, i) => (
          <SvgText
            key={`x-label-${i}`}
            x={CHART_PADDING.left + getX(i)}
            y={CHART_PADDING.top + chartHeight + 20}
            fontSize={11}
            fill={colors.textSecondary}
            textAnchor="middle"
          >
            {point.label}
          </SvgText>
        ))}

        {/* Vùng fill gradient */}
        {data.length > 1 && (
          <Path
            d={areaPath}
            fill={accentColor}
            opacity={0.15}
          />
        )}

        {/* Đường line */}
        {data.length > 1 && (
          <Path
            d={linePath}
            stroke={accentColor}
            strokeWidth={2.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Các điểm dữ liệu */}
        {data.map((point, i) => {
          const val = Number.isFinite(point.value) ? point.value : 0;
          const cx = CHART_PADDING.left + getX(i);
          const cy = CHART_PADDING.top + getY(val);
          const isSelected = selectedIndex === i;

          return (
            <G key={`point-${i}`}>
              {/* Vùng touch lớn hơn để dễ tap */}
              <Circle
                cx={cx}
                cy={cy}
                r={20}
                fill="transparent"
                onPress={() => setSelectedIndex(isSelected ? null : i)}
              />
              {/* Điểm hiển thị */}
              <Circle
                cx={cx}
                cy={cy}
                r={isSelected ? 8 : 6}
                fill={isSelected ? accentColor : colors.surface}
                stroke={accentColor}
                strokeWidth={2}
              />
              {/* Tooltip khi selected */}
              {isSelected && (() => {
                const label = `${Math.round(val)}${unit ? ` ${unit}` : ''}`;
                const tipW = Math.max(label.length * 8 + 20, 60);
                const tipH = 28;
                const tipX = Math.min(
                  Math.max(cx - tipW / 2, CHART_PADDING.left),
                  CHART_PADDING.left + chartWidth - tipW
                );
                const tipY = cy - tipH - 10;
                return (
                  <G>
                    {/* Shadow */}
                    <Rect x={tipX + 2} y={tipY + 3} width={tipW} height={tipH} rx={8} fill="rgba(0,0,0,0.15)" />
                    {/* Background */}
                    <Rect x={tipX} y={tipY} width={tipW} height={tipH} rx={8} fill="#ffffff" stroke={accentColor} strokeWidth={1.5} />
                    {/* Text */}
                    <SvgText x={tipX + tipW / 2} y={tipY + tipH / 2 + 5} fontSize={13} fontWeight="700" fill="#1a2e2b" textAnchor="middle">
                      {label}
                    </SvgText>
                  </G>
                );
              })()}
            </G>
          );
        })}
      </Svg>
    </View>
  );
};
