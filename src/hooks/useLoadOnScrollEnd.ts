import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

export const SCROLL_PAGE_SIZE = 10;

export function appendDistinctPage<T extends { id: string }>(current: T[], page: T[]): T[] {
  const ids = new Set(current.map((item) => item.id));
  const additions = page.filter((item) => {
    if (ids.has(item.id)) {
      return false;
    }
    ids.add(item.id);
    return true;
  });
  return [...current, ...additions];
}

export function useLoadOnScrollEnd(loadMore: () => void, scope: string, hasMore: boolean) {
  const previous = useRef({ scope, offset: 0 });
  const [viewportHeight, setViewportHeight] = useState(0);
  const onLayout = useCallback(({ nativeEvent }: LayoutChangeEvent) => {
    if (previous.current.scope !== scope) {
      previous.current = { scope, offset: 0 };
    }
    setViewportHeight(nativeEvent.layout.height);
  }, [scope]);
  const onScroll = useCallback(({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const offset = contentOffset.y;
    const lastOffset = previous.current.scope === scope ? previous.current.offset : 0;
    previous.current = { scope, offset };
    const remaining = contentSize.height - layoutMeasurement.height;
    if (hasMore && offset > 0 && offset > lastOffset && remaining > 0 && remaining - offset <= 160) {
      loadMore();
    }
  }, [hasMore, loadMore, scope]);
  return {
    scrollProps: { onLayout, onScroll, scrollEventThrottle: 16 },
    // Keep a short swipe available on tablets when an entire page fits.
    minimumContentSize: hasMore && viewportHeight > 0 ? { minHeight: viewportHeight + 8 } : undefined,
  };
}
