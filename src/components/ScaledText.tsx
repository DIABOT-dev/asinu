import { Platform, Text as RNText, TextProps as RNTextProps, TextStyle } from 'react-native';
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

/**
 * Extract aggregate fontWeight từ style (last wins).
 */
function extractFontWeight(style: any): TextStyle['fontWeight'] | undefined {
  if (!style) return undefined;
  if (typeof style === 'object' && !Array.isArray(style)) {
    return (style as TextStyle).fontWeight;
  }
  if (Array.isArray(style)) {
    for (let i = style.length - 1; i >= 0; i--) {
      const s = style[i];
      if (s && typeof s === 'object' && 'fontWeight' in s) {
        return (s as TextStyle).fontWeight;
      }
    }
  }
  return undefined;
}

export const ScaledText = ({ style, ...props }: RNTextProps) => {
  const getBaseValues = (): { fontSize: number; lineHeight?: number } => {
    if (!style) return { fontSize: 16 };

    // Single style object
    if (typeof style === 'object' && !Array.isArray(style)) {
      const s = style as TextStyle;
      return { fontSize: s.fontSize ?? 16, lineHeight: s.lineHeight as number | undefined };
    }

    // Array of styles - find last fontSize and lineHeight
    if (Array.isArray(style)) {
      let fontSize = 16;
      let lineHeight: number | undefined;
      for (let i = style.length - 1; i >= 0; i--) {
        const s = style[i];
        if (s && typeof s === 'object') {
          if (lineHeight === undefined && 'lineHeight' in s) lineHeight = (s as TextStyle).lineHeight as number | undefined;
          if ('fontSize' in s) { fontSize = (s as TextStyle).fontSize ?? 16; break; }
        }
      }
      return { fontSize, lineHeight };
    }

    return { fontSize: 16 };
  };

  const { fontSize: baseFontSize, lineHeight: baseLineHeight } = getBaseValues();
  const scaledFontSize = useScaledFontSize(baseFontSize);
  const ratio = baseFontSize > 0 ? scaledFontSize / baseFontSize : 1;
  // Android needs extra lineHeight for Vietnamese diacritics (ơ, ư, ô, ê) to prevent clipping
  const lineHeightMultiplier = Platform.OS === 'android' ? 1.6 : 1.5;
  const scaledLineHeight = baseLineHeight
    ? Math.max(Math.round(baseLineHeight * ratio), Math.round(scaledFontSize * lineHeightMultiplier))
    : Math.round(scaledFontSize * lineHeightMultiplier);

  // Pick Inter family theo fontWeight aggregate. Override fontWeight=normal
  // vì Inter family đã encode weight rồi (tránh fake bold trên Android).
  const fontWeight = extractFontWeight(style);
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
