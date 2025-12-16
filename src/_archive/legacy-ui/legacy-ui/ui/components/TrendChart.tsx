import { View, StyleSheet } from 'react-native';
import { VictoryArea, VictoryAxis, VictoryChart, VictoryTheme } from 'victory-native';
import { colors } from '@/ui/theme';
import { TrendPoint } from '@/demo/demoData';

export type TrendChartProps = {
  data: TrendPoint[];
  accentColor?: string;
  height?: number;
};

export const TrendChart = ({ data, accentColor = colors.primary, height = 200 }: TrendChartProps) => {
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
