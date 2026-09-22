import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';
import { View, type StyleProp, type ViewStyle } from 'react-native';

type Props = {
  size?: number;
  color?: string;
  trunkColor?: string;
  style?: StyleProp<ViewStyle>;
};

export function PineTreeIllustration({
  size = 78,
  color = '#10b981',
  trunkColor = '#047857',
  style,
}: Props) {
  const height = size * 1.2;
  return (
    <View style={style}>
      <Svg width={size} height={height} viewBox="0 0 100 120" fill="none">
        <Rect x="43" y="96" width="14" height="18" rx="4" fill={trunkColor} />
        <Path
          d="M50 54 C42 65, 23 85, 10 94 C6 97, 9 101, 14 100 C26 97, 38 99, 50 97 C62 99, 74 97, 86 100 C91 101, 94 97, 90 94 C77 85, 58 65, 50 54 Z"
          fill={color}
        />
        <Path
          d="M50 30 C43 40, 27 58, 17 68 C13 72, 17 76, 21 75 C31 73, 40 75, 50 73 C60 75, 69 73, 79 75 C83 76, 87 72, 83 68 C73 58, 57 40, 50 30 Z"
          fill={color}
        />
        <Path
          d="M50 2 C47 2, 45 5, 43 8 C37 18, 28 32, 23 41 C19 46, 23 49, 28 48 C35 46, 43 48, 50 46 C57 48, 65 46, 72 48 C77 49, 81 46, 77 41 C72 32, 63 18, 57 8 C55 5, 53 2, 50 2 Z"
          fill={color}
        />
      </Svg>
    </View>
  );
}
