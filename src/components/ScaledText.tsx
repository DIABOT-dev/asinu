import { Platform, StyleSheet, Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
import { useScaledFontSize } from '../hooks/useScaledTypography';

/**
 * Text component tự động scale fontSize theo settings
 * Sử dụng thay thế cho Text thông thường khi cần auto-scale
 * 
 * @example
 * // Thay vì: <Text style={{ fontSize: 16 }}>Hello</Text>
 * // Sử dụng: <ScaledText style={{ fontSize: 16 }}>Hello</ScaledText>
 */
/**
 * Map fontWeight (string/number) → Inter font weight family.
 * fontWeight numeric scale: 400/500/600/700/800. Inter ko có 100-300 và 900 trong app này.
 */
function pickInterFamily(fontWeight: TextStyle['fontWeight']): string {
  if (!fontWeight) return 'Inter_400Regular';
  const w = typeof fontWeight === 'number' ? fontWeight : parseInt(String(fontWeight), 10);
  if (!isNaN(w)) {
    if (w >= 800) return 'Inter_800ExtraBold';
    if (w >= 700) return 'Inter_700Bold';
    if (w >= 600) return 'Inter_600SemiBold';
    if (w >= 500) return 'Inter_500Medium';
    return 'Inter_400Regular';
  }
  if (fontWeight === 'bold') return 'Inter_700Bold';
  return 'Inter_400Regular';
}

export const ScaledText = ({ style, ...props }: RNTextProps) => {
  // StyleSheet.create() may return numeric style IDs on native platforms.
  // Flatten first so the component scales the actual font size instead of
  // silently falling back to 16 for every registered style.
  const resolvedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const baseFontSize = typeof resolvedStyle?.fontSize === 'number' && resolvedStyle.fontSize > 0
    ? resolvedStyle.fontSize
    : 16;
  const baseLineHeight = typeof resolvedStyle?.lineHeight === 'number'
    ? resolvedStyle.lineHeight
    : undefined;
  const scaledFontSize = useScaledFontSize(baseFontSize);
  const ratio = baseFontSize > 0 ? scaledFontSize / baseFontSize : 1;
  // Android needs extra lineHeight for Vietnamese diacritics (ơ, ư, ô, ê) to prevent clipping
  const lineHeightMultiplier = Platform.OS === 'android' ? 1.6 : 1.5;
  const scaledLineHeight = baseLineHeight
    ? Math.max(Math.round(baseLineHeight * ratio), Math.round(scaledFontSize * lineHeightMultiplier))
    : Math.round(scaledFontSize * lineHeightMultiplier);

  // Pick Inter family theo fontWeight aggregate. Override fontWeight=normal
  // vì Inter family đã encode weight rồi (tránh fake bold trên Android).
  const fontWeight = resolvedStyle?.fontWeight;
  const fontFamily = pickInterFamily(fontWeight);

  const overrides: TextStyle = {
    fontSize: scaledFontSize,
    lineHeight: scaledLineHeight,
    fontFamily,
    fontWeight: 'normal',  // Reset vì Inter_XXX_Bold đã đủ weight
  };

  const finalStyle: TextStyle[] = Array.isArray(style)
    ? [...(style as TextStyle[]), overrides]
    : [style as TextStyle, overrides];

  return <RNText {...props} style={finalStyle} allowFontScaling={false} />;
};
