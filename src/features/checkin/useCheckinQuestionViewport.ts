import { useCallback, useEffect, useRef, type RefObject } from 'react';
import { Keyboard, type ScrollView } from 'react-native';

/** Reset after native content/inset layout, rather than before the new question exists. */
export function useCheckinQuestionViewport(
  scroll: RefObject<ScrollView | null>,
  question: string,
  enabled: boolean,
  loading: boolean,
) {
  const pending = useRef(false);
  const keyboardPending = useRef(false);
  const frames = useRef<number[]>([]);
  const top = useCallback(
    () => scroll.current?.scrollTo({ y: 0, animated: false }),
    [scroll],
  );
  const cancel = useCallback(() => {
    frames.current.forEach(cancelAnimationFrame);
    frames.current = [];
    pending.current = false;
    keyboardPending.current = false;
  }, []);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    pending.current = true;
    keyboardPending.current = Keyboard.isVisible?.() || false;
    Keyboard.dismiss();
    frames.current.push(
      requestAnimationFrame(() => {
        top();
        frames.current.push(
          requestAnimationFrame(() => {
            top();
            pending.current = false;
          }),
        );
      }),
    );
    return cancel;
  }, [question, enabled, loading, top, cancel]);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const listener = Keyboard.addListener('keyboardDidHide', () => {
      if (keyboardPending.current) {
        keyboardPending.current = false;
        top();
      }
    });
    return () => listener.remove();
  }, [enabled, top]);
  const onContentSizeChange = useCallback(() => {
    if (pending.current) {
      top();
    }
  }, [top]);
  return { onContentSizeChange, onScrollBeginDrag: cancel };
}
