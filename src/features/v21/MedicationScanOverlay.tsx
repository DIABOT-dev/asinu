import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";

const RUNNER = require("../../../assets/images/medication/asinu-running-sprite-v1.png");

// The scan endpoint has no progress events. This estimate slows down and stays
// below completion until the owner of the actual request removes the overlay.
export function estimatedScanProgress(elapsedMs: number) {
  return Math.min(
    94,
    Math.round(8 + 86 * (1 - Math.exp(-Math.max(0, elapsedMs) / 4000))),
  );
}

function MedicationScanProgress() {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [elapsed, setElapsed] = useState(0);
  const [frame, setFrame] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  const phase = useRef(new Animated.Value(0)).current;
  const fill = useRef(new Animated.Value(0.08)).current;
  const progress = estimatedScanProgress(elapsed);
  const size = height < 650 ? 168 : 196;

  useEffect(() => {
    let active = true;
    let changed = false;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active && !changed) setReducedMotion(enabled);
      })
      .catch(() => {});
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        changed = true;
        setReducedMotion(enabled);
      },
    );
    const appState = AppState.addEventListener("change", (state) => {
      setForeground(state === "active");
    });
    return () => {
      active = false;
      motion.remove();
      appState.remove();
    };
  }, []);

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(
      () => setElapsed((previous) => Math.max(previous, Date.now() - started)),
      300,
    );
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (reducedMotion || !foreground) {
      phase.setValue(0);
      setFrame(0);
      return;
    }
    // Four dedicated running poses, never cropped from the pointing artwork.
    const frames = setInterval(() => setFrame((value) => (value + 1) % 4), 150);
    const run = Animated.loop(
      Animated.timing(phase, {
        toValue: 1,
        duration: 760,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    run.start();
    return () => {
      clearInterval(frames);
      run.stop();
    };
  }, [foreground, phase, reducedMotion]);

  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: progress / 100,
      duration: reducedMotion ? 0 : 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [fill, progress, reducedMotion]);

  return (
    <View
      style={[
        styles.overlay,
        {
          backgroundColor: isDark
            ? "rgba(5, 20, 23, 0.84)"
            : "rgba(21, 52, 49, 0.38)",
        },
      ]}
      accessibilityViewIsModal
      testID="medication-scan-overlay"
    >
      <ScrollView
        bounces={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.center,
          {
            paddingTop: Math.max(insets.top, 20),
            paddingBottom: Math.max(insets.bottom, 20),
          },
        ]}
      >
        <LinearGradient
          colors={isDark ? ["#173A36", "#172A2D"] : ["#EFFBF6", "#FAFDFC"]}
          style={[
            styles.panel,
            { borderColor: isDark ? "#31504C" : "#D5EDE3" },
          ]}
        >
          <View
            style={[styles.stage, { width: size, height: size }]}
            pointerEvents="none"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <View
              style={[styles.halo, { backgroundColor: colors.primaryLight }]}
            />
            <View
              style={[
                styles.healthMark,
                { left: 2, top: 44, backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons
                name="medical-outline"
                size={19}
                color={colors.primaryText}
              />
            </View>
            <View
              style={[
                styles.healthMark,
                { right: 0, top: 110, backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons
                name="fitness-outline"
                size={20}
                color={colors.primaryText}
              />
            </View>
            <View
              style={[styles.shadow, { backgroundColor: colors.primaryText }]}
            />
            <View
              testID="medication-scan-runner"
              style={[styles.sprite, { width: size, height: size }]}
            >
              <Image
                testID="medication-scan-frame"
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
            <View style={styles.road}>
              <Animated.View
                style={[
                  styles.roadMarks,
                  {
                    transform: [
                      {
                        translateX: phase.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0, -24],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {[0, 1, 2, 3, 4, 5].map((mark) => (
                  <View
                    key={mark}
                    style={[
                      styles.roadMark,
                      { backgroundColor: colors.primaryText },
                    ]}
                  />
                ))}
              </Animated.View>
            </View>
          </View>
          <Text
            style={[styles.title, { color: colors.textPrimary }]}
            accessibilityRole="header"
            accessibilityLiveRegion="polite"
          >
            {t("scanBusy")}
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            {t(elapsed >= 15000 ? "scanTakingLonger" : "scanReviewHint")}
          </Text>
          <View style={styles.progress}>
            <View style={styles.progressLabels}>
              <Text
                style={[styles.progressLabel, { color: colors.textSecondary }]}
              >
                {t("scanEstimate")}
              </Text>
              <Text style={[styles.percentage, { color: colors.primaryText }]}>
                {progress}%
              </Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={t("scanBusy")}
              accessibilityState={{ busy: true }}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={t("scanEstimatedPercent", { percent: progress })}
              accessibilityValue={{
                min: 0,
                max: 100,
                now: progress,
                text: t("scanEstimatedPercent", { percent: progress }),
              }}
              style={[styles.track, { backgroundColor: colors.primaryLight }]}
            >
              <Animated.View
                style={[
                  styles.fill,
                  {
                    backgroundColor: colors.primary,
                    transform: [{ scaleX: fill }],
                  },
                ]}
              />
            </View>
          </View>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

export function MedicationScanOverlay({ visible }: { visible: boolean }) {
  // Unmounting owns every timer/listener, including errors, blur and account changes.
  return visible ? <MedicationScanProgress /> : null;
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    elevation: 40,
  },
  center: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  panel: {
    width: "100%",
    maxWidth: 360,
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    gap: 14,
  },
  stage: { alignItems: "center", justifyContent: "center", marginTop: -8 },
  halo: {
    position: "absolute",
    width: "80%",
    height: "80%",
    borderRadius: 120,
  },
  healthMark: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  shadow: {
    position: "absolute",
    bottom: 28,
    width: "44%",
    height: 8,
    borderRadius: 20,
    opacity: 0.1,
  },
  sprite: { overflow: "hidden" },
  road: {
    position: "absolute",
    width: 112,
    height: 4,
    bottom: 15,
    overflow: "hidden",
  },
  roadMarks: { flexDirection: "row", gap: 12, width: 144 },
  roadMark: { width: 12, height: 2, borderRadius: 1, opacity: 0.3 },
  title: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    textAlign: "center",
  },
  description: { fontSize: 15, lineHeight: 23, textAlign: "center" },
  progress: { width: "100%", gap: 10, marginTop: 8 },
  progressLabels: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  progressLabel: { fontSize: 13, lineHeight: 20, flexShrink: 1 },
  percentage: {
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  track: { height: 7, width: "100%", overflow: "hidden", borderRadius: 8 },
  fill: {
    width: "100%",
    height: "100%",
    borderRadius: 8,
    transformOrigin: "left center",
  },
});
