import React, { useState } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RippleRefreshScrollView } from "../../components/RippleRefresh";
import { ScaledText as Text } from "../../components/ScaledText";
import { Screen } from "../../components/Screen";
import { OfflineBanner } from "../../components/OfflineBanner";
import { EarlySignalCard } from "../../components/EarlySignalCard";
import { HealthJournalCalendar } from "../../components/HealthJournalCalendar";
import { useThemeColors } from "../../hooks/useThemeColors";
import { getBottomTabBarHeight, spacing } from "../../styles";
import { useHealthTreeOverview } from "./useHealthTreeOverview";
import { useAuthStore } from "../auth/auth.store";

const STATUS_COLORS = {
  ok: {
    color: "#059669",
    darkColor: "#34d399",
  },
  monitor: {
    color: "#d97706",
    darkColor: "#fbbf24",
  },
  danger: {
    color: "#dc2626",
    darkColor: "#f87171",
  },
} as const;

export function HealthTreeOverview() {
  const userId = useAuthStore((state) => state.profile?.id);
  return <HealthTreeOverviewContent key={userId ?? "signed-out"} />;
}

function HealthTreeOverviewContent() {
  const { t: tc } = useTranslation("common");
  const { t: tt } = useTranslation("tree");
  const { score, refreshing, error, refreshKey, refresh, retry } =
    useHealthTreeOverview();
  const { colors, isDark } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [selectedMonth, setSelectedMonth] = useState<string>();
  const [panel, setPanel] = useState<"early" | "attention" | null>(
    null
  );
  const togglePanel = (next: "early" | "attention") =>
    setPanel((current) => (current === next ? null : next));
  const tabBarHeight = getBottomTabBarHeight(insets.bottom);
  const hasStatus = Boolean(
    score && (score.checkinDone || score.factors.length)
  );
  const meta = hasStatus
    ? STATUS_COLORS[score!.level]
    : null;
  const color = meta
    ? isDark
      ? meta.darkColor
      : meta.color
    : colors.textSecondary;
  const hasFactors = Boolean(score?.factors.length);

  return (
    <Screen>
      {error && score ? <OfflineBanner onRetry={() => void retry()} /> : null}
      <RippleRefreshScrollView
        refreshing={refreshing}
        onRefresh={refresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: tabBarHeight + spacing.lg,
          },
        ]}
      >
        <View style={styles.toolbar}>
          <Pressable
            style={styles.tool}
            accessibilityRole="button"
            accessibilityLabel={tt("earlyTitle")}
            accessibilityState={{ expanded: panel === "early" }}
            onPress={() => togglePanel("early")}
          >
            <MaterialCommunityIcons
              name="radar"
              size={27}
              color={
                hasFactors
                  ? color
                  : panel === "early"
                  ? colors.primaryDark
                  : colors.textSecondary
              }
            />
          </Pressable>
          <Pressable
            style={styles.tool}
            accessibilityRole="button"
            accessibilityLabel={tt("journalAttentionDays")}
            accessibilityState={{ expanded: panel === "attention" }}
            onPress={() => togglePanel("attention")}
          >
            <MaterialCommunityIcons
              name="calendar-alert"
              size={27}
              color={
                panel === "attention"
                  ? colors.primaryDark
                  : colors.textSecondary
              }
            />
          </Pressable>
        </View>
        <View style={styles.section}>
          <HealthJournalCalendar
            refreshKey={refreshKey}
            plain
            showSummary={false}
            showAttention={false}
            onMonthChange={setSelectedMonth}
          />
        </View>
      </RippleRefreshScrollView>
      {panel === "early" && (
        <EarlySignalCard
          healthScore={score}
          refreshKey={refreshKey}
          modalOnly
          onClose={() => setPanel(null)}
        />
      )}
      <Modal
        visible={panel === "attention"}
        transparent
        animationType="fade"
        onRequestClose={() => setPanel(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setPanel(null)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.surface }]}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                {tt("journalAttentionDays")}
              </Text>
              <Pressable
                style={styles.tool}
                accessibilityRole="button"
                accessibilityLabel={tc("close")}
                onPress={() => setPanel(null)}
              >
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContent}
            >
              {panel === "attention" ? (
                <HealthJournalCalendar
                  refreshKey={refreshKey}
                  initialMonth={selectedMonth}
                  attentionOnly
                  plain
                />
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    gap: 12,
  },
  section: { width: "100%", maxWidth: 680 },
  toolbar: {
    width: "100%",
    maxWidth: 680,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
  },
  tool: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(4,20,18,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    width: "100%",
    maxWidth: 680,
    maxHeight: "88%",
    padding: 16,
    borderRadius: 24,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  sheetTitle: { flex: 1, fontSize: 22, fontWeight: "700" },
  modalContent: { paddingBottom: 12 },
});
