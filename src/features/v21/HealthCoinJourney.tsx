import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, View } from "react-native";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getCoinJourney } from "./coin-progress";
import { CoinRulesMascot } from "./CoinRulesMascot";
import { HealthCoinIcon } from "./HealthCoinIcon";
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

export function HealthCoinJourney({
  data,
  onOpenDetails,
}: {
  data: CoinToday;
  onOpenDetails: () => void;
}) {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const model = getCoinJourney(data);
  const ink = { color: colors.textPrimary };
  const muted = { color: colors.textSecondary };
  const accent = isDark ? "#8dd9c2" : "#4a9381";
  const track = isDark ? "#284a43" : "#dcece7";
  const fill = isDark ? "#164e42" : "#e0f3eb";
  const line = { borderColor: colors.border };

  return (
    <View style={styles.root}>
      <View style={styles.balanceRow}>
        <HealthCoinIcon size={26} />
        <Text style={[styles.balanceText, ink]}>
          {t("balance", { count: data.balance })}
        </Text>
      </View>
      <View style={styles.rulesRow}>
        <CoinRulesMascot />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("rules")}
          onPress={onOpenDetails}
          style={({ pressed }) => [
            styles.rules,
            { backgroundColor: fill },
            pressed && { opacity: 0.65 },
          ]}
        >
          <Text style={[styles.rulesTitle, ink]}>{t("rules")}</Text>
        </Pressable>
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
        <Text style={[styles.emptyText, muted]}>{t("journeyNoTasks")}</Text>
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
              <Text
                style={[styles.taskProgress, { color: colors.primaryText }]}
              >
                {t("taskCoins", {
                  count:
                    data.tasks.find((item) => item.task_code === task.code)
                      ?.coins ?? 0,
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  balanceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  balanceText: {
    flex: 1,
    minWidth: 0,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: "600",
  },
  emptyText: { fontSize: 15, lineHeight: 21 },
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
  rulesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rules: {
    flex: 1,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
  },
  rulesTitle: { fontSize: 17, fontWeight: "700", textAlign: "center" },
});
