import React, { forwardRef } from 'react';
import {
  StyleSheet,
  TextInput as RNTextInput,
  TextInputProps,
  TextStyle,
} from 'react-native';
import { useScaledFontSize } from '../hooks/useScaledTypography';

/**
 * Native TextInput with the same app-level font scale as ScaledText.
 * allowFontScaling is disabled to avoid applying the OS scale a second time.
 */
export const ScaledTextInput = forwardRef<RNTextInput, TextInputProps>(function ScaledTextInput(
  { style, ...props },
  ref,
) {
  const resolvedStyle = StyleSheet.flatten(style) as TextStyle | undefined;
  const baseFontSize = typeof resolvedStyle?.fontSize === 'number' && resolvedStyle.fontSize > 0
    ? resolvedStyle.fontSize
    : 16;
  const baseLineHeight = typeof resolvedStyle?.lineHeight === 'number'
    ? resolvedStyle.lineHeight
    : undefined;
  const scaledFontSize = useScaledFontSize(baseFontSize);
  const ratio = baseFontSize > 0 ? scaledFontSize / baseFontSize : 1;

  const scaledStyle: TextStyle = {
    fontSize: scaledFontSize,
    ...(baseLineHeight ? { lineHeight: Math.round(baseLineHeight * ratio) } : {}),
  };

  return (
    <RNTextInput
      ref={ref}
      {...props}
      style={[style, scaledStyle]}
      allowFontScaling={false}
    />
  );
});

