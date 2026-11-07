import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  AppState,
  Image,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../components/ScaledText";

const RUNNER = require("../../../assets/images/medication/asinu-running-sprite-v1.png");

// Synthesis has no progress events. Never imply completion before the audio
// player reports that the recording is ready (the owner then shows the result).
export function estimatedConclusionAudioProgress(elapsedMs: number) {
  return Math.min(
    94,
    Math.round(8 + 86 * (1 - Math.exp(-Math.max(0, elapsedMs) / 6000)))
  );
}

export function CheckinConclusionLoading() {
  const { t } = useTranslation("home");
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [elapsed, setElapsed] = useState(0);
  const [frame, setFrame] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active"
  );
  const size = height < 650 ? 160 : 196;
  const progress = estimatedConclusionAudioProgress(elapsed);

  useEffect(() => {
    let active = true;
    let changed = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !changed) {
          setReducedMotion(enabled);
        }
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        changed = true;
        setReducedMotion(enabled);
      }
    );
    const appState = AppState.addEventListener("change", (state) =>
      setForeground(state === "active")
    );
    return () => {
      active = false;
      motion.remove();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Date.now() - started), 500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (reducedMotion || !foreground) {
      setFrame(0);
      return;
    }
    const timer = setInterval(() => setFrame((value) => (value + 1) % 4), 150);
    return () => clearInterval(timer);
  }, [reducedMotion, foreground]);

  return (
    <View
      testID="checkin-conclusion-loading"
      style={[
        styles.container,
        { minHeight: Math.max(360, height - insets.top - insets.bottom - 240) },
      ]}
    >
      <View
        style={[styles.stage, { width: size, height: size }]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <View style={styles.halo} />
        <View style={styles.shadow} />
        <View style={{ width: size, height: size, overflow: "hidden" }}>
          <Image
            testID="checkin-conclusion-runner"
            source={RUNNER}
            resizeMode="contain"
            style={{
              position: "absolute",
              width: size * 2,
              height: size * 2,
              transform: [
                { translateX: -(frame % 2) * size },
                { translateY: -Math.floor(frame / 2) * size },
              ],
            }}
          />
        </View>
      </View>
      <Text
        style={styles.title}
        accessibilityRole="header"
        accessibilityLiveRegion="polite"
      >
        {t("checkinPreparingAudioTitle")}
      </Text>
      <Text style={styles.description}>
        {t(
          elapsed >= 15000
            ? "checkinPreparingAudioLonger"
            : "checkinPreparingAudioHint"
        )}
      </Text>
      <View style={styles.progress}>
        <View style={styles.labels}>
          <Text style={styles.estimate}>
            {t("checkinPreparingAudioEstimate")}
          </Text>
          <Text style={styles.percentage}>{progress}%</Text>
        </View>
        <View
          style={styles.track}
          accessibilityRole="progressbar"
          accessibilityLabel={t("checkinPreparingAudioTitle")}
          accessibilityState={{ busy: true }}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: progress,
            text: t("checkinPreparingAudioPercent", { percent: progress }),
          }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={t("checkinPreparingAudioPercent", {
            percent: progress,
          })}
        >
          <View
            style={[styles.fill, { transform: [{ scaleX: progress / 100 }] }]}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    maxWidth: 360,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 16,
  },
  stage: { alignItems: "center", justifyContent: "center" },
  halo: {
    position: "absolute",
    width: "82%",
    height: "82%",
    borderRadius: 120,
    backgroundColor: "#E0F5EC",
  },
  shadow: {
    position: "absolute",
    bottom: 24,
    width: "42%",
    height: 8,
    borderRadius: 20,
    backgroundColor: "#1B8275",
    opacity: 0.12,
  },
  title: {
    width: "100%",
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
    color: "#0F2942",
  },
  description: {
    width: "100%",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    color: "#526C66",
    maxWidth: 300,
  },
  progress: { width: "100%", maxWidth: 280, marginTop: 12, gap: 10 },
  labels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  estimate: { flexShrink: 1, fontSize: 14, lineHeight: 22, color: "#526C66" },
  percentage: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: "#177C70",
  },
  track: {
    width: "100%",
    height: 7,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "#D8EAE3",
  },
  fill: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    backgroundColor: "#259E8F",
    transformOrigin: "left center",
  },
});
