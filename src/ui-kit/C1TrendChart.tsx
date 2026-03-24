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

export const C1TrendChart = ({ data, accentColor = colors.primary, height = 200, title, unit }: C1TrendChartProps) => {
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

  // Nếu không có dữ liệu hoặc tất cả giá trị = 0
  const hasRealData = data && data.length > 0 && data.some(d => Number.isFinite(d.value) && d.value > 0);

  if (!data || data.length === 0 || !hasRealData) {
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
  const chartHeight = height - CHART_PADDING.top - CHART_PADDING.bottom;

  // Tính min/max - lọc bỏ giá trị NaN/undefined/null
  const values = data.map(d => d.value).filter(v => Number.isFinite(v) && v > 0);

  // Nếu không có giá trị hợp lệ, hiển thị thông báo thân thiện
  if (values.length === 0) {
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
  
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal;
  
  // Nếu tất cả giá trị giống nhau hoặc = 0, tạo một range giả để chart hiển thị đẹp
  let yMin: number;
  let yMax: number;
  if (range === 0 || maxVal === 0) {
    // Nếu giá trị = 0, tạo range từ 0-10
    if (maxVal === 0) {
      yMin = 0;
      yMax = 10;
    } else {
      // Tạo range ±20% xung quanh giá trị
      yMin = Math.max(0, minVal * 0.8);
      yMax = maxVal * 1.2;
    }
  } else {
    yMin = Math.max(0, minVal - range * 0.1);
    yMax = maxVal + range * 0.1;
  }
  // Đảm bảo yRange không bao giờ = 0
  const yRange = Math.max(yMax - yMin, 1);

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

  // Tạo path cho đường line
  const linePath = data.map((point, i) => {
    const x = CHART_PADDING.left + getX(i);
    const y = CHART_PADDING.top + getY(point.value);
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
      <Svg width={screenWidth} height={height - (title ? 24 : 0)}>
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
          const cx = CHART_PADDING.left + getX(i);
          const cy = CHART_PADDING.top + getY(point.value);
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
              {isSelected && (
                <G>
                  <Rect
                    x={cx - 30}
                    y={cy - 35}
                    width={60}
                    height={24}
                    rx={8}
                    fill={colors.textPrimary}
                  />
                  <SvgText
                    x={cx}
                    y={cy - 18}
                    fontSize={12}
                    fontWeight="bold"
                    fill={colors.surface}
                    textAnchor="middle"
                  >
                    {Math.round(point.value)}{unit ? ` ${unit}` : ''}
                  </SvgText>
                </G>
              )}
            </G>
          );
        })}
      </Svg>
    </View>
  );
};
