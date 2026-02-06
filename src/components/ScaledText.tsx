import { Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { useScaledFontSize } from '../hooks/useScaledTypography';

/**
 * Text component tự động scale fontSize theo settings
 * Sử dụng thay thế cho Text thông thường khi cần auto-scale
 * 
 * @example
 * // Thay vì: <Text style={{ fontSize: 16 }}>Hello</Text>
 * // Sử dụng: <ScaledText style={{ fontSize: 16 }}>Hello</ScaledText>
 */
export const ScaledText = ({ style, ...props }: RNTextProps) => {
  // Lấy fontSize từ style prop
  const getBaseFontSize = (): number => {
    if (!style) return 16; // default
    
    // Single style object
    if (typeof style === 'object' && !Array.isArray(style)) {
      const s = style as TextStyle;
      return s.fontSize ?? 16;
    }
    
    // Array of styles - find last fontSize
    if (Array.isArray(style)) {
      for (let i = style.length - 1; i >= 0; i--) {
        const s = style[i];
        if (s && typeof s === 'object' && 'fontSize' in s) {
          return (s as TextStyle).fontSize ?? 16;
        }
      }
    }
    
    return 16;
  };

  const baseFontSize = getBaseFontSize();
  const scaledFontSize = useScaledFontSize(baseFontSize);

  // Merge scaled fontSize into style
  const finalStyle = Array.isArray(style)
    ? [...style, { fontSize: scaledFontSize }]
    : [style, { fontSize: scaledFontSize }];

  return <RNText {...props} style={finalStyle} />;
};
