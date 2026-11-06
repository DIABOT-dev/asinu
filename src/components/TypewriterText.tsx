import React, { useCallback, useMemo, useState } from "react";
import { useFocusEffect } from "expo-router";
import { StyleSheet, Text as NativeText, type TextProps } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { ScaledText } from "./ScaledText";

type Props = Omit<TextProps, "children"> & { text: string };

const CHARACTER_DELAY_MS = 90;
const READING_PAUSE_MS = 2600;
const RESTART_PAUSE_MS = 450;

export function TypewriterText({ text, accessibilityLabel, ...props }: Props) {
  // NFC keeps Vietnamese accents attached to the revealed letter.
  const normalizedText = text.normalize("NFC");
  const characters = useMemo(
    () => Array.from(normalizedText),
    [normalizedText]
  );
  const reducedMotion = useReducedMotion();
  const [frame, setFrame] = useState({ text: normalizedText, count: 0 });

  useFocusEffect(
    useCallback(() => {
      if (reducedMotion || characters.length === 0) return;
      let active = true;
      let count = 0;
      let timer: ReturnType<typeof setTimeout>;
      setFrame({ text: normalizedText, count });

      const tick = () => {
        if (!active) return;
        if (count < characters.length) {
          count++;
          setFrame({ text: normalizedText, count });
          timer = setTimeout(
            tick,
            count === characters.length ? READING_PAUSE_MS : CHARACTER_DELAY_MS
          );
        } else {
          count = 0;
          setFrame({ text: normalizedText, count });
          timer = setTimeout(tick, RESTART_PAUSE_MS);
        }
      };

      timer = setTimeout(tick, CHARACTER_DELAY_MS);
      return () => {
        active = false;
        clearTimeout(timer);
      };
    }, [characters, normalizedText, reducedMotion])
  );

  const count = reducedMotion
    ? characters.length
    : frame.text === normalizedText
    ? frame.count
    : 0;

  return (
    <ScaledText
      {...props}
      accessibilityLabel={accessibilityLabel ?? text}
      accessibilityLiveRegion="none"
    >
      <NativeText accessible={false}>
        {characters.slice(0, count).join("")}
      </NativeText>
      {/* Reserve the complete line so the bubble and nearby controls stay still. */}
      <NativeText
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.pending}
      >
        {characters.slice(count).join("")}
      </NativeText>
    </ScaledText>
  );
}

const styles = StyleSheet.create({ pending: { color: "transparent" } });
