import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useThemeColors } from '../../hooks/useThemeColors';

export function HomeHealthFeedCarousel<T extends { id: string }>({ items, renderItem }: { items: T[]; renderItem: (item: T) => React.ReactNode }) {
  const { width } = useWindowDimensions();
  const { colors } = useThemeColors();
  const [pageWidth, setPageWidth] = useState(width - 32);
  const [index, setIndex] = useState(0);
  const position = useRef(0);
  const dragging = useRef(false);
  const list = useRef<FlatList<{ item: T; key: string }>>(null);
  const reducedMotion = useReducedMotion();
  const slides = useMemo(() => [
    ...items.map((item) => ({ item, key: item.id })),
    ...(items.length > 1 ? [{ item: items[0], key: `${items[0].id}-loop` }] : []),
  ], [items]);

  useEffect(() => {
    position.current = 0;
    setIndex(0);
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [items.length, items[0]?.id, pageWidth]);

  useFocusEffect(useCallback(() => {
    if (items.length < 2 || reducedMotion) return;
    const timer = setInterval(() => {
      if (AppState.currentState !== 'active' || dragging.current) return;
      position.current = Math.min(position.current + 1, items.length);
      list.current?.scrollToOffset({ offset: position.current * pageWidth, animated: true });
    }, 5000);
    return () => clearInterval(timer);
  }, [items.length, pageWidth, reducedMotion]));

  return <View onLayout={(event) => setPageWidth(event.nativeEvent.layout.width)}>
    <FlatList
      ref={list}
      data={slides}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      keyExtractor={(slide) => slide.key}
      renderItem={({ item }) => <View style={{ width: pageWidth }}>{renderItem(item.item)}</View>}
      getItemLayout={(_, offset) => ({ length: pageWidth, offset: offset * pageWidth, index: offset })}
      onScrollBeginDrag={() => { dragging.current = true; }}
      onScrollEndDrag={() => { dragging.current = false; }}
      onMomentumScrollEnd={(event) => {
        const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
        position.current = next >= items.length ? 0 : next;
        setIndex(position.current);
        if (next >= items.length) list.current?.scrollToOffset({ offset: 0, animated: false });
      }}
    />
    {items.length > 1 && <View style={styles.dots} pointerEvents="none" accessible={false}>
      {items.map((item, dot) => <View key={item.id} style={[styles.dot, { backgroundColor: dot === index ? colors.primaryDark : colors.border }]} />)}
    </View>}
  </View>;
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
