/**
 * LazyLoad — Deferred rendering for heavy components.
 * Only renders children when the component is visible on screen.
 */
import React, { useState, useCallback } from 'react';
import { View, ViewProps } from 'react-native';

interface LazyLoadProps extends ViewProps {
  children: React.ReactNode;
  /** Placeholder while not yet rendered */
  fallback?: React.ReactNode;
  /** Minimum height for placeholder */
  minHeight?: number;
}

export function LazyLoad({ children, fallback, minHeight = 100, style, ...props }: LazyLoadProps) {
  const [visible, setVisible] = useState(false);

  const onLayout = useCallback(() => {
    if (!visible) setVisible(true);
  }, [visible]);

  return (
    <View onLayout={onLayout} style={style} {...props}>
      {visible ? children : (fallback || <View style={{ minHeight }} />)}
    </View>
  );
}
