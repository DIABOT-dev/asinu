import { ReactNode, useEffect, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import { StateLoading } from './state/StateLoading';

type ScreenReadyGateProps = {
  children: ReactNode;
  fallback?: ReactNode;
  minDelayMs?: number;
  ready?: boolean;
};

export const ScreenReadyGate = ({
  children,
  fallback,
  minDelayMs = 120,
  ready = true,
}: ScreenReadyGateProps) => {
  const [canRender, setCanRender] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let frameOne: ReturnType<typeof requestAnimationFrame> | undefined;
    let frameTwo: ReturnType<typeof requestAnimationFrame> | undefined;
    let delayTimer: ReturnType<typeof setTimeout> | undefined;

    setCanRender(false);

    if (!ready) {
      return () => {
        cancelled = true;
      };
    }

    const startedAt = Date.now();
    const interactionTask = InteractionManager.runAfterInteractions(() => {
      frameOne = requestAnimationFrame(() => {
        frameTwo = requestAnimationFrame(() => {
          const remainingDelay = Math.max(0, minDelayMs - (Date.now() - startedAt));
          delayTimer = setTimeout(() => {
            if (!cancelled) {
              setCanRender(true);
            }
          }, remainingDelay);
        });
      });
    });

    return () => {
      cancelled = true;
      interactionTask.cancel();
      if (frameOne !== undefined) cancelAnimationFrame(frameOne);
      if (frameTwo !== undefined) cancelAnimationFrame(frameTwo);
      if (delayTimer !== undefined) clearTimeout(delayTimer);
    };
  }, [minDelayMs, ready]);

  if (!canRender) {
    return fallback ?? (
      <View style={styles.fallback}>
        <StateLoading overlay={false} />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
