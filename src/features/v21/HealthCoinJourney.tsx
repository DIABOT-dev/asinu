import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getCoinJourney } from "./coin-progress";
import type { CoinToday, CoinTask } from "./v21.api";

const ICONS: Record<
  CoinTask["task_code"],
  React.ComponentProps<typeof MaterialCommunityIcons>["name"]
> = {
  CHECKIN: "heart-pulse",
  MED_ANSWER: "pill",
  VITAL: "chart-bar",
  GIFT_OPEN: "gift-open-outline",
  WEEKLY: "calendar-check-outline",
};
const RING_LENGTH = 2 * Math.PI * 51;

export function HealthCoinJourney({
  data,
  expanded,
  onToggleDetails,
}: {
  data: CoinToday;
  expanded: boolean;
  onToggleDetails: () => void;
}) {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 340 || fontScale > 1.35;
  const ringSize = Math.min(200, Math.round(120 * Math.max(1, fontScale || 1)));
  const model = getCoinJourney(data);
  const ink = { color: colors.textPrimary };
  const muted = { color: colors.textSecondary };
  const accent = isDark ? "#8dd9c2" : "#4a9381";
  const track = isDark ? "#284a43" : "#dcece7";
  const fill = isDark ? "#164e42" : "#e0f3eb";
  const line = { borderColor: colors.border };

  return (
    <View style={styles.root}>
      <View style={[styles.hero, stacked && styles.heroStack]}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={t("journeyTitle")}
          accessibilityValue={{
            min: 0,
            max: 100,
            now: model.percent,
            text: t("journeySummary", {
              done: model.completed,
              total: model.tasks.length,
            }),
          }}
          style={[styles.ring, { width: ringSize, height: ringSize }]}
        >
          <Svg
            width={ringSize}
            height={ringSize}
            viewBox="0 0 120 120"
            accessible={false}
          >
            <Circle
              cx={60}
              cy={60}
              r={51}
              stroke={track}
              strokeWidth={8}
              fill="none"
            />
            {model.percent > 0 && (
              <Circle
                cx={60}
                cy={60}
                r={51}
                stroke={accent}
                strokeWidth={8}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={`${RING_LENGTH} ${RING_LENGTH}`}
                strokeDashoffset={RING_LENGTH * (1 - model.percent / 100)}
                rotation={-90}
                origin="60,60"
              />
            )}
          </Svg>
          <View
            style={styles.ringCopy}
            pointerEvents="none"
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <MaterialCommunityIcons
              name="sprout-outline"
              size={23}
              color={accent}
            />
            <Text style={[styles.percent, ink]}>{model.percent}%</Text>
            <Text style={[styles.completeLabel, muted]}>
              {t("journeyComplete")}
            </Text>
          </View>
        </View>
        {!stacked && (
          <View
            style={[styles.heroDivider, { backgroundColor: colors.border }]}
          />
        )}
        <View style={[styles.heroCopy, stacked && styles.heroCopyStack]}>
          <Text accessibilityRole="header" style={[styles.heroTitle, ink]}>
            {t("journeyTitle")}
          </Text>
          <Text style={[styles.heroDescription, muted]}>
            {t(
              model.percent === 100
                ? "journeyFinished"
                : "journeyEncouragement",
            )}
          </Text>
          <MaterialCommunityIcons
            name="heart-pulse"
            size={40}
            color={accent}
            style={styles.heroHeart}
            accessible={false}
          />
        </View>
      </View>

      <View style={styles.taskHeader}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, ink]}>
          {t("journeyTasks")}
        </Text>
        <View style={[styles.taskCount, { backgroundColor: fill }]}>
          <MaterialCommunityIcons
            name="checkbox-marked-outline"
            size={16}
            color={accent}
          />
          <Text style={[styles.taskCountText, ink]}>
            {t("journeyTaskCount", { count: model.tasks.length })}
          </Text>
        </View>
      </View>

      {!model.tasks.length && (
        <Text style={[styles.heroDescription, muted]}>
          {t("journeyNoTasks")}
        </Text>
      )}
      <View>
        {model.tasks.map((task, index) => (
          <View
            key={task.code}
            style={[
              styles.taskRow,
              index < model.tasks.length - 1 && styles.taskDivider,
              line,
            ]}
          >
            <View style={styles.taskIcon} accessible={false}>
              <MaterialCommunityIcons
                name={ICONS[task.code]}
                size={29}
                color={accent}
              />
            </View>
            <View style={styles.taskCopy}>
              <Text style={[styles.taskTitle, ink]}>{t(task.code)}</Text>
              <Text style={[styles.taskProgress, muted]}>
                {t(task.weekly ? "journeyDays" : "journeyTimes", {
                  done: task.done,
                  total: task.target,
                })}
              </Text>
              <View
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel={t(task.code)}
                accessibilityValue={{
                  min: 0,
                  max: task.target,
                  now: task.done,
                }}
                style={[styles.track, { backgroundColor: track }]}
              >
                <View
                  style={[
                    styles.progress,
                    { backgroundColor: accent, width: `${task.percent}%` },
                  ]}
                />
              </View>
            </View>
            <View style={styles.checkSlot}>
              {task.complete && (
                <View style={[styles.check, { backgroundColor: fill }]}>
                  <MaterialCommunityIcons
                    name="check"
                    size={22}
                    color={accent}
                    accessible={false}
                  />
                </View>
              )}
            </View>
          </View>
        ))}
      </View>

      {model.tasks.length > 0 && (
        <View style={[styles.reward, line]}>
          <MaterialCommunityIcons
            name="gift-outline"
            size={44}
            color={accent}
            accessible={false}
          />
          <View style={[styles.rewardCopy, { borderColor: colors.border }]}>
            <Text style={[styles.rewardTitle, ink]}>
              {t(model.percent === 100 ? "journeyGoalComplete" : "journeyGoal")}
            </Text>
            <Text style={[styles.heroDescription, muted]}>
              {t("journeyRewardDescription")}
            </Text>
          </View>
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        onPress={onToggleDetails}
        style={({ pressed }) => [styles.rules, pressed && { opacity: 0.65 }]}
      >
        <MaterialCommunityIcons
          name="information-outline"
          size={24}
          color={accent}
        />
        <Text style={[styles.rulesTitle, ink]}>{t("rules")}</Text>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={accent}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingTop: 8,
    paddingBottom: 12,
  },
  heroStack: { flexDirection: "column", alignItems: "flex-start" },
  ring: {
    width: 120,
    height: 120,
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ringCopy: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  percent: { fontSize: 28, fontWeight: "800" },
  completeLabel: { fontSize: 13 },
  heroDivider: { width: StyleSheet.hairlineWidth, height: 90 },
  heroCopy: { flex: 1, minWidth: 0, gap: 6 },
  heroCopyStack: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: "auto",
    width: "100%",
  },
  heroTitle: { fontSize: 19, lineHeight: 25, fontWeight: "700" },
  heroDescription: { fontSize: 15, lineHeight: 21 },
  heroHeart: { position: "absolute", right: 0, bottom: 0, opacity: 0.14 },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    paddingTop: 10,
  },
  sectionTitle: { flexGrow: 1, flexShrink: 1, fontSize: 17, fontWeight: "700" },
  taskCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  taskCountText: { fontSize: 12, fontWeight: "600" },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  taskDivider: { borderBottomWidth: StyleSheet.hairlineWidth },
  taskIcon: { width: 38, alignItems: "center", flexShrink: 0 },
  taskCopy: { flex: 1, minWidth: 0, gap: 3 },
  taskTitle: { fontSize: 16, fontWeight: "600", lineHeight: 22 },
  taskProgress: { fontSize: 14 },
  track: { height: 6, borderRadius: 4, overflow: "hidden", marginTop: 1 },
  progress: { height: "100%", borderRadius: 4 },
  checkSlot: { width: 28, alignItems: "center", flexShrink: 0 },
  check: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  reward: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingVertical: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rewardCopy: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingLeft: 18,
    gap: 3,
  },
  rewardTitle: { fontSize: 18, fontWeight: "700" },
  rules: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  rulesTitle: { flex: 1, fontSize: 17, fontWeight: "700" },
});
