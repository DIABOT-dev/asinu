import { View, StyleSheet, Text } from 'react-native';
import { colors } from '../styles';
import { featureFlags } from '../lib/featureFlags';

export type TrendPoint = {
  label: string;
  value: number;
};

export type C1TrendChartProps = {
  data: TrendPoint[];
  accentColor?: string;
  height?: number;
};

export const C1TrendChart = ({ data, accentColor = colors.primary, height = 200 }: C1TrendChartProps) => {
  const disableCharts = featureFlags.disableCharts;

  if (disableCharts) {
    return (
      <View style={[styles.container, { height, alignItems: 'center', justifyContent: 'center', padding: 16 }]}>
        <Text style={{ color: colors.textSecondary }}>Biểu đồ tạm ẩn trong chế độ demo</Text>
      </View>
    );
  }

  // Lazy import to tránh load react-native-svg khi tắt chart
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { VictoryArea, VictoryAxis, VictoryChart, VictoryTheme } = require('victory-native');

  return (
    <View style={[styles.container, { height }]}>
      <VictoryChart
        padding={{ top: 24, bottom: 32, left: 40, right: 12 }}
        height={height}
        theme={VictoryTheme.material}
        domainPadding={{ x: 20 }}
      >
        <VictoryAxis style={{ axis: { stroke: 'transparent' } }} tickFormat={() => ''} />
        <VictoryAxis dependentAxis style={{ axis: { stroke: 'transparent' } }} tickFormat={() => ''} />
        <VictoryArea
          interpolation="catmullRom"
          data={data}
          x="label"
          y="value"
          style={{
            data: {
              stroke: accentColor,
              strokeWidth: 3,
              fill: accentColor + '33'
            }
          }}
        />
      </VictoryChart>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: 24,
    backgroundColor: colors.surface,
    overflow: 'hidden'
  }
});
