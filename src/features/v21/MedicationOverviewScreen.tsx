import { useState } from "react";
import type { ReactNode } from "react";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { QueuedModal } from "../../components/QueuedModal";
import { ScaledText as Text } from "../../components/ScaledText";
import { useGuardedRouter } from "../../hooks/useGuardedRouter";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useScaledFontSize } from "../../hooks/useScaledTypography";
import { env } from "../../lib/env";
import { HealthCoinIcon } from "./HealthCoinIcon";
import {
  useMedicationOverview,
  type MedicationOverviewController,
} from "./useMedicationOverview";
import { medicationStyles as s } from "./medication-overview.styles";
import type { MedDose } from "./v21.api";
import { validMedicationNote } from "./medication-input";
import { MedicationPurposeTags } from "./MedicationPurposeTags";
import { MedicationDraftEntry } from "./MedicationDraftEntry";
import { MedicationPhotoPreview } from "./MedicationPhotoPreview";
import { medicationDoseStatusKey } from "./medication-dose-display";
import { MedicationTimeField } from "./MedicationTimeField";

type Tab = "today" | "schedules";
type PanelProps = {
  med: MedicationOverviewController;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  onBack: () => void;
  onAdd: () => void;
  onContinue: (draftId: string) => void;
  onConsent: (id: string) => void;
  onAnswer: (id: string) => void;
};
const doseIcons: Record<MedDose["state"], keyof typeof Ionicons.glyphMap> = {
  SCHEDULED: "time-outline",
  CALLING: "notifications-outline",
  TAKEN: "checkmark-circle-outline",
  SKIPPED: "pause-circle-outline",
  OUT_OF_MEDS: "alert-circle-outline",
  UNCONFIRMED: "help-circle-outline",
  SKIPPED_NO_DEVICE: "phone-portrait-outline",
  CANCELLED: "close-circle-outline",
};
function Button({
  label,
  onPress,
  disabled = false,
  danger = false,
  quiet = false,
  busy = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  quiet?: boolean;
  busy?: boolean;
}) {
  const { colors } = useThemeColors();
  const color = quiet ? colors.primaryText : colors.surface;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        {
          backgroundColor: quiet
            ? colors.primaryLight
            : danger
            ? colors.danger
            : colors.primaryText,
        },
        (disabled || busy || pressed) && s.disabled,
      ]}
    >
      {busy && <ActivityIndicator color={color} />}
      <Text style={[s.buttonText, { color }]}>{label}</Text>
    </Pressable>
  );
}
function Empty({ title, children }: { title: string; children?: ReactNode }) {
  const { colors } = useThemeColors();
  return (
    <View style={s.empty}>
      <MaterialCommunityIcons
        name="pill"
        size={42}
        color={colors.primaryText}
      />
      <Text style={[s.sectionTitle, s.center, { color: colors.textPrimary }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

export function MedicationOverviewPanel({
  med,
  tab,
  onTabChange,
  onBack,
  onAdd,
  onContinue,
  onConsent,
  onAnswer,
}: PanelProps) {
  const { t } = useTranslation("v21");
  const { colors, isDark } = useThemeColors();
  const [choosePatient, setChoosePatient] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const appFontSize = useScaledFontSize(14);
  const compact = width < 360 || ((fontScale || 1) * appFontSize) / 14 > 1.15;
  const personName =
    Number(med.patientId) === Number(med.self)
      ? t("myself")
      : med.patients.find((p) => Number(p.id) === Number(med.patientId))?.name;
  const caption = { color: colors.textSecondary },
    title = { color: colors.textPrimary },
    tint = { color: colors.primaryText };
  const drafts = med.data?.drafts || (med.data?.draft ? [med.data.draft] : []);
  const takenToday = med.doses.filter((dose) => dose.state === "TAKEN").length;
  const totalToday = med.doses.filter(
    (dose) => dose.state !== "CANCELLED"
  ).length;
  return (
    <View style={[s.root, { backgroundColor: colors.background }]}>
      <View style={s.chrome}>
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            onPress={onBack}
            style={s.iconButton}
          >
            <Ionicons name="arrow-back" size={23} color={colors.textPrimary} />
          </Pressable>
          <View style={s.copy}>
            <Text
              accessibilityRole="header"
              style={[s.heading, s.center, title]}
            >
              {t("medicationTitle")}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("addSchedule")}
            accessibilityState={{
              disabled: !med.data || med.busy || med.loading,
            }}
            disabled={!med.data || med.busy || med.loading}
            onPress={onAdd}
            style={({ pressed }) => [
              s.iconButton,
              (pressed || !med.data || med.busy || med.loading) && s.disabled,
            ]}
          >
            <Ionicons name="add-outline" size={28} color={colors.primaryText} />
          </Pressable>
        </View>
        <View
          accessibilityRole="tablist"
          style={[s.tabs, { backgroundColor: colors.surfaceMuted }]}
        >
          {(["today", "schedules"] as const).map((key) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={t(
                key === "today"
                  ? "medicationTodayTab"
                  : "medicationSchedulesTab"
              )}
              accessibilityState={{ selected: tab === key }}
              onPress={() => onTabChange(key)}
              style={[
                s.tab,
                tab === key && {
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text
                style={[
                  s.tabText,
                  {
                    color:
                      tab === key ? colors.primaryText : colors.textSecondary,
                  },
                ]}
              >
                {t(
                  key === "today"
                    ? "medicationTodayTab"
                    : "medicationSchedulesTab"
                )}
              </Text>
            </Pressable>
          ))}
        </View>
        {med.patients.length > 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t("forWhom")} ${personName || ""}`}
            accessibilityState={{ expanded: choosePatient, disabled: med.busy }}
            disabled={med.busy}
            onPress={() => setChoosePatient(!choosePatient)}
            style={s.patient}
          >
            <Ionicons
              name="person-outline"
              size={19}
              color={colors.primaryText}
            />
            <Text style={[s.title, tint, s.copy]}>
              {personName || t("forWhom")}
            </Text>
            <Ionicons
              name={choosePatient ? "chevron-up" : "chevron-down"}
              size={18}
              color={colors.textSecondary}
            />
          </Pressable>
        )}
        {choosePatient && (
          <ScrollView style={s.people} contentContainerStyle={s.peopleContent}>
            {med.patients.map((person) => (
              <Pressable
                key={person.id}
                accessibilityRole="radio"
                accessibilityState={{ checked: person.id === med.patientId }}
                accessibilityLabel={
                  Number(person.id) === Number(med.self)
                    ? t("myself")
                    : person.name
                }
                onPress={() => {
                  med.selectPatient(person.id);
                  setChoosePatient(false);
                }}
                style={s.row}
              >
                <Text style={[s.title, title, s.copy]}>
                  {Number(person.id) === Number(med.self)
                    ? t("myself")
                    : person.name}
                </Text>
                {person.id === med.patientId && (
                  <Ionicons
                    name="checkmark"
                    size={21}
                    color={colors.primaryText}
                  />
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
      <ScrollView
        testID="medication-overview-scroll"
        key={`${med.patientId}:${tab}`}
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={med.loading}
            onRefresh={() => void med.refresh()}
            tintColor={colors.primary}
          />
        }
      >
        {med.failed && (
          <View style={s.notice}>
            <Text style={[s.caption, caption, s.copy]}>{t("error")}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("retry")}
              onPress={() => void med.refresh()}
              style={s.iconButton}
            >
              <Ionicons name="refresh" size={23} color={colors.primaryText} />
            </Pressable>
          </View>
        )}
        {!med.data ? (
          <View style={s.empty}>
            {med.loading && (
              <ActivityIndicator
                accessibilityLabel={t("loading")}
                color={colors.primary}
              />
            )}
            <Text style={[s.caption, caption, s.center]}>
              {t(
                med.loading
                  ? "loading"
                  : med.failed
                  ? "error"
                  : "featureUnavailable"
              )}
            </Text>
          </View>
        ) : (
          <>
            {drafts.length > 0 && (
              <View style={{ gap: 16 }}>
                {drafts.map((draft) => (
                  <MedicationDraftEntry
                    key={draft.id}
                    draft={draft}
                    onContinue={() => onContinue(draft.id)}
                    disabled={med.busy || med.loading}
                    onDelete={() =>
                      Alert.alert(t("deleteDraftTitle"), t("deleteDraftBody"), [
                        { text: t("cancel"), style: "cancel" },
                        {
                          text: t("deleteDraft"),
                          style: "destructive",
                          onPress: () => void med.removeDraft(draft.id),
                        },
                      ])
                    }
                  />
                ))}
              </View>
            )}
            {med.data.remindersEnabled === false && (
              <View
                style={[s.notice, { backgroundColor: colors.primaryLight }]}
              >
                <Ionicons
                  name="notifications-off-outline"
                  size={20}
                  color={colors.primaryText}
                />
                <Text style={[s.caption, caption, s.copy]}>
                  {t("remindersOff")}
                </Text>
              </View>
            )}
            {tab === "today" ? (
              <>
                {med.doses.length > 0 && (
                  <View style={s.sectionHeader}>
                    <Text
                      accessibilityRole="header"
                      style={[s.sectionTitle, title]}
                    >
                      {t("todayDoses")}
                    </Text>
                    {totalToday > 0 && (
                      <Text style={[s.caption, caption]}>
                        {t("medicationTodayProgress", {
                          taken: takenToday,
                          total: totalToday,
                        })}
                      </Text>
                    )}
                  </View>
                )}
                {med.todayLoading && !med.doses.length && (
                  <ActivityIndicator
                    accessibilityLabel={t("loading")}
                    color={colors.primary}
                  />
                )}
                {!med.todayLoading && !med.doses.length && !drafts.length && (
                  <Empty title={t("medicationNoDoses")}>
                    {med.data.schedules.length > 0 && (
                      <Button
                        quiet
                        label={t("medicationGoToSchedules")}
                        onPress={() => onTabChange("schedules")}
                      />
                    )}
                  </Empty>
                )}
                <View style={s.list}>
                  {med.doses.map((dose) => {
                    const status = medicationDoseStatusKey(
                      dose,
                      med.now,
                      med.data!.remindersEnabled !== false
                    );
                    const color = [
                      "OUT_OF_MEDS",
                      "UNCONFIRMED",
                      "medicationOverdue",
                    ].includes(status)
                      ? isDark
                        ? "#f0c47a"
                        : "#996515"
                      : ["TAKEN", "CALLING"].includes(dose.state)
                      ? colors.primaryText
                      : colors.textSecondary;
                    const elapsed = med.now - Date.parse(dose.scheduled_at);
                    // A missed first call returns to SCHEDULED while waiting
                    // for its retry. Keep the same two-hour answer window as
                    // the detail API, using the controller's server clock.
                    const canAnswer =
                      med.data!.self &&
                      ["SCHEDULED", "CALLING", "UNCONFIRMED"].includes(
                        dose.state
                      ) &&
                      Number.isFinite(elapsed) &&
                      elapsed <= 2 * 60 * 60 * 1000 &&
                      (dose.state !== "SCHEDULED" || elapsed >= 0);
                    const focus =
                      dose.state === "CALLING" || status === "medicationDueNow";
                    return (
                      <View
                        key={dose.id}
                        style={[
                          s.dose,
                          { borderColor: colors.border },
                          focus && [
                            s.doseFocus,
                            {
                              backgroundColor: colors.primaryLight,
                              borderColor: colors.primaryText,
                            },
                          ],
                        ]}
                      >
                        <View style={[s.doseTop, compact && s.doseTopCompact]}>
                          <Text style={[s.time, title]}>
                            {dose.time_local.slice(0, 5)}
                          </Text>
                          <View style={s.doseStatus}>
                            <Ionicons
                              name={doseIcons[dose.state]}
                              size={19}
                              color={color}
                              accessible={false}
                            />
                            <Text style={[s.doseStatusText, { color }]}>
                              {t(status)}
                            </Text>
                          </View>
                        </View>
                        {canAnswer && (
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${t(
                              "medicationAnswerAction"
                            )} ${dose.time_local.slice(0, 5)}`}
                            accessibilityState={{ disabled: med.busy }}
                            disabled={med.busy}
                            onPress={() => onAnswer(dose.id)}
                            style={({ pressed }) => [
                              s.answerButton,
                              { backgroundColor: colors.primaryText },
                              (pressed || med.busy) && s.disabled,
                            ]}
                          >
                            <Text
                              style={[s.buttonText, { color: colors.surface }]}
                            >
                              {t("medicationAnswerAction")}
                            </Text>
                            <Ionicons
                              name="arrow-forward"
                              size={19}
                              color={colors.surface}
                              accessible={false}
                            />
                          </Pressable>
                        )}
                      </View>
                    );
                  })}
                </View>
                {!med.data.schedules.length && !drafts.length && (
                  <Button label={t("addSchedule")} onPress={onAdd} />
                )}
                {med.weekly && med.weekly.total > 0 && (
                  <View style={[s.week, { borderColor: colors.border }]}>
                    <Text style={[s.sectionTitle, title]}>
                      {t("weekTitle")}
                    </Text>
                    <Text style={[s.title, title]}>
                      {t("weekAdherence", med.weekly)}
                    </Text>
                    {med.weekly.skipped > 0 && (
                      <Text style={[s.title, title]}>
                        {t("weekSkipped", { count: med.weekly.skipped })}
                      </Text>
                    )}
                    <View style={s.status}>
                      <HealthCoinIcon size={22} />
                      <Text style={[s.title, tint]}>
                        {t("weekCoins", { count: med.weekly.coins })}
                      </Text>
                    </View>
                  </View>
                )}
              </>
            ) : (
              <>
                {!med.data.schedules.length && !drafts.length && (
                  <Empty title={t("medicationEmptyTitle")}>
                    <Button label={t("addSchedule")} onPress={onAdd} />
                  </Empty>
                )}
                {med.data.schedules.length > 0 && (
                  <View style={s.sectionHeader}>
                    <Text
                      accessibilityRole="header"
                      style={[s.sectionTitle, title]}
                    >
                      {t("medicationDailySchedules")}
                    </Text>
                    <Text style={[s.caption, caption]}>
                      {t("medicationScheduleCount", {
                        count: med.data.schedules.length,
                      })}
                    </Text>
                  </View>
                )}
                {med.data.schedules.map((schedule) => {
                  const items = schedule.item_ids.flatMap((id) => {
                    const item = med.data!.items.find((row) => row.id === id);
                    return item ? [item] : [];
                  });
                  const stateKey = !schedule.active
                    ? "scheduleOff"
                    : schedule.consent_state === "PENDING"
                    ? "pendingConsent"
                    : schedule.consent_state;
                  const stateColor = !schedule.active
                    ? colors.textSecondary
                    : schedule.consent_state === "ACTIVE"
                    ? colors.primaryText
                    : isDark
                    ? "#f0c47a"
                    : "#996515";
                  const timing =
                    schedule.note ||
                    (schedule.meal_anchor
                      ? t(
                          schedule.meal_anchor === "bedtime"
                            ? "anchor_bedtime"
                            : schedule.meal_anchor
                        )
                      : "");
                  return (
                    <View
                      key={schedule.id}
                      style={[s.schedule, { borderColor: colors.border }]}
                    >
                      <View style={s.scheduleHeader}>
                        <Text style={[s.time, title, s.copy]}>
                          {schedule.time_local.slice(0, 5)}
                        </Text>
                        <Switch
                          accessibilityLabel={t("medicationScheduleEnabled", {
                            time: schedule.time_local.slice(0, 5),
                          })}
                          hitSlop={{ top: 8, bottom: 8, left: 0, right: 0 }}
                          accessibilityState={{
                            disabled: med.busy || med.loading,
                          }}
                          value={schedule.active}
                          disabled={med.busy || med.loading}
                          onValueChange={(value) =>
                            void med.setScheduleActive(schedule, value)
                          }
                          trackColor={{
                            false: colors.border,
                            true: colors.primaryText,
                          }}
                          thumbColor={colors.surface}
                        />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={t("medicationScheduleActions", {
                            time: schedule.time_local.slice(0, 5),
                          })}
                          accessibilityState={{
                            disabled: med.busy || med.loading,
                          }}
                          disabled={med.busy || med.loading}
                          onPress={() => med.openSchedule(schedule)}
                          style={({ pressed }) => [
                            s.iconButton,
                            (pressed || med.busy || med.loading) && s.disabled,
                          ]}
                        >
                          <Ionicons
                            name="ellipsis-horizontal"
                            size={23}
                            color={colors.textSecondary}
                          />
                        </Pressable>
                      </View>
                      <View style={s.scheduleItems}>
                        {items.map((item) => (
                          <View key={item.id} style={s.scheduleItem}>
                            {item.photoUrl ? (
                              <MedicationPhotoPreview
                                uri={
                                  item.photoUrl.startsWith("/")
                                    ? env.apiBaseUrl + item.photoUrl
                                    : item.photoUrl
                                }
                                label={item.display_name}
                                compact
                              />
                            ) : (
                              <View style={s.itemSymbol} accessible={false}>
                                {item.kind === "SUPPLEMENT" ? (
                                  <Ionicons
                                    name="leaf-outline"
                                    size={22}
                                    color={colors.textSecondary}
                                  />
                                ) : (
                                  <MaterialCommunityIcons
                                    name="pill"
                                    size={24}
                                    color={colors.primaryText}
                                  />
                                )}
                              </View>
                            )}
                            <View style={s.copy}>
                              <Text style={[s.itemName, title]}>
                                {item.display_name}
                              </Text>
                              {!!item.kind && (
                                <Text style={[s.itemKind, caption]}>
                                  {t(item.kind)}
                                </Text>
                              )}
                            </View>
                          </View>
                        ))}
                      </View>
                      {!!timing && (
                        <Text style={[s.caption, caption]}>{timing}</Text>
                      )}
                      <View style={s.scheduleState}>
                        <Ionicons
                          name={
                            !schedule.active
                              ? "pause-circle-outline"
                              : schedule.consent_state === "ACTIVE"
                              ? "checkmark-circle-outline"
                              : "time-outline"
                          }
                          size={17}
                          color={stateColor}
                          accessible={false}
                        />
                        <Text
                          style={[
                            s.caption,
                            s.stateCopy,
                            { color: stateColor },
                          ]}
                        >
                          {t(stateKey)}
                        </Text>
                      </View>
                      {schedule.pushOnly && (
                        <View style={s.scheduleState}>
                          <Ionicons
                            name="notifications-outline"
                            size={17}
                            color={colors.textSecondary}
                            accessible={false}
                          />
                          <Text style={[s.caption, caption, s.stateCopy]}>
                            {t("medicationPushOnly")}
                          </Text>
                        </View>
                      )}
                      {med.data!.self &&
                        schedule.active &&
                        schedule.consent_state === "PENDING" && (
                          <Button
                            quiet
                            label={t("medicationReviewConsent")}
                            onPress={() => onConsent(schedule.id)}
                          />
                        )}
                    </View>
                  );
                })}
                {!med.data.self && (
                  <View style={s.preference}>
                    <Text style={[s.caption, caption, s.copy]}>
                      {t("problemsOnly")}
                    </Text>
                    <Switch
                      accessibilityLabel={t("problemsOnly")}
                      value={!!med.data.problemsOnly}
                      disabled={med.busy || med.loading}
                      onValueChange={(value) => void med.setProblemsOnly(value)}
                      trackColor={{
                        false: colors.border,
                        true: colors.primary,
                      }}
                      thumbColor={colors.surface}
                    />
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
      <MedicationScheduleSheet med={med} />
    </View>
  );
}

export function MedicationScheduleSheet({
  med,
}: {
  med: MedicationOverviewController;
}) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const title = { color: colors.textPrimary },
    caption = { color: colors.textSecondary };
  return (
    <QueuedModal
      visible={!!med.selected}
      transparent
      animationType="fade"
      onRequestClose={med.closeSchedule}
    >
      <KeyboardAvoidingView
        style={s.modalRoot}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("close")}
          onPress={med.closeSchedule}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
        />
        <View
          accessibilityViewIsModal
          style={[
            s.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={s.sheetHeader}>
            <Text accessibilityRole="header" style={[s.heading, title, s.copy]}>
              {t(
                med.mode === "move"
                  ? "doseMove"
                  : med.mode === "edit"
                  ? "editSchedule"
                  : med.mode === "remove"
                  ? "removeSchedule"
                  : "medicationScheduleAt",
                { time: med.selected?.time_local.slice(0, 5) }
              )}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("close")}
              accessibilityState={{ disabled: med.busy }}
              disabled={med.busy}
              onPress={med.closeSchedule}
              style={s.iconButton}
            >
              <Ionicons name="close" size={23} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={s.sheetContent}
          >
            {med.mode === "menu" ? (
              <>
                {med.selected?.active &&
                  med.selected.consent_state !== "DECLINED" &&
                  med.selected.item_ids.map((id) => {
                    const item = med.data?.items.find((row) => row.id === id);
                    return (
                      item && (
                        <Pressable
                          key={id}
                          accessibilityRole="button"
                          accessibilityLabel={t("doseMoveItem", {
                            name: item.display_name,
                          })}
                          onPress={() => med.openMove(id)}
                          style={s.row}
                        >
                          <Ionicons
                            name="time-outline"
                            size={24}
                            color={colors.primaryText}
                          />
                          <Text style={[s.title, title, s.copy]}>
                            {item.display_name}
                          </Text>
                          <Text
                            style={[s.caption, { color: colors.primaryText }]}
                          >
                            {t("doseMove")}
                          </Text>
                        </Pressable>
                      )
                    );
                  })}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("editSchedule")}
                  onPress={() => med.setMode("edit")}
                  style={s.row}
                >
                  <Ionicons
                    name="create-outline"
                    size={24}
                    color={colors.primaryText}
                  />
                  <Text style={[s.title, title]}>{t("editSchedule")}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t("removeSchedule")}
                  onPress={() => med.setMode("remove")}
                  style={s.row}
                >
                  <Ionicons
                    name="trash-outline"
                    size={24}
                    color={colors.danger}
                  />
                  <Text style={[s.title, { color: colors.danger }]}>
                    {t("removeSchedule")}
                  </Text>
                </Pressable>
              </>
            ) : med.mode === "move" ? (
              <>
                <Text style={[s.title, title]}>
                  {
                    med.data?.items.find((item) => item.id === med.movingItem)
                      ?.display_name
                  }
                </Text>
                {med.data?.schedules
                  .filter(
                    (row) =>
                      row.id !== med.selected?.id &&
                      row.active &&
                      row.consent_state !== "DECLINED"
                  )
                  .map((row) => (
                    <Pressable
                      key={row.id}
                      accessibilityRole="radio"
                      accessibilityLabel={row.time_local.slice(0, 5)}
                      accessibilityState={{
                        checked: med.time === row.time_local.slice(0, 5),
                        disabled: med.busy,
                      }}
                      disabled={med.busy}
                      onPress={() => med.setTime(row.time_local.slice(0, 5))}
                      style={s.row}
                    >
                      <Ionicons
                        name={
                          med.time === row.time_local.slice(0, 5)
                            ? "radio-button-on"
                            : "radio-button-off"
                        }
                        size={22}
                        color={colors.primaryText}
                      />
                      <Text style={[s.title, title]}>
                        {row.time_local.slice(0, 5)}
                      </Text>
                    </Pressable>
                  ))}
                <MedicationTimeField
                  label={t("doseOtherTime")}
                  value={med.time}
                  onChange={med.setTime}
                  disabled={med.busy}
                />
                <Button
                  label={t("doseMove")}
                  disabled={!med.canMove}
                  busy={med.busy}
                  onPress={() => void med.move()}
                />
              </>
            ) : med.mode === "edit" ? (
              <>
                <MedicationTimeField
                  label={t("timeLabel")}
                  value={med.time}
                  onChange={med.setTime}
                  disabled={med.busy}
                />
                <Text style={[s.caption, caption]}>
                  {t("medicationNoteLabel")}
                </Text>
                <TextInput
                  accessibilityLabel={t("medicationNoteLabel")}
                  placeholder={t("medicationNotePlaceholder")}
                  placeholderTextColor={colors.textSecondary}
                  value={med.note}
                  onChangeText={med.setNote}
                  maxLength={60}
                  editable={!med.busy}
                  style={[
                    s.noteInput,
                    title,
                    { backgroundColor: colors.surfaceMuted },
                  ]}
                />
                {!validMedicationNote(med.note) && (
                  <Text
                    accessibilityRole="alert"
                    style={[s.caption, { color: colors.danger }]}
                  >
                    {t("medicationNoteInvalid")}
                  </Text>
                )}
                {med.data?.items.map((item) => (
                  <Pressable
                    key={item.id}
                    accessibilityRole="checkbox"
                    accessibilityLabel={item.display_name}
                    accessibilityState={{
                      checked: med.items.includes(item.id),
                      disabled: med.busy,
                    }}
                    disabled={med.busy}
                    onPress={() => med.toggleItem(item.id)}
                    style={s.row}
                  >
                    <Ionicons
                      name={
                        med.items.includes(item.id)
                          ? "checkbox"
                          : "square-outline"
                      }
                      size={23}
                      color={colors.primaryText}
                    />
                    <View style={[s.copy, { gap: 6 }]}>
                      <Text style={[s.title, title]}>{item.display_name}</Text>
                      <MedicationPurposeTags
                        codes={item.purpose_tags?.codes || []}
                      />
                    </View>
                  </Pressable>
                ))}
                <Button
                  label={t("save")}
                  disabled={!med.canSave}
                  busy={med.busy}
                  onPress={() => void med.save()}
                />
              </>
            ) : (
              <>
                <Text style={[s.caption, caption]}>
                  {t("removeConfirm", {
                    time: med.selected?.time_local.slice(0, 5),
                  })}
                </Text>
                <Button
                  label={t("removeSchedule")}
                  danger
                  busy={med.busy}
                  onPress={() => void med.remove()}
                />
                <Button
                  label={t("cancel")}
                  quiet
                  disabled={med.busy}
                  onPress={med.closeSchedule}
                />
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </QueuedModal>
  );
}

export default function MedicationOverviewScreen() {
  const med = useMedicationOverview();
  const router = useGuardedRouter();
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("today");
  return (
    <View
      style={[
        s.root,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          backgroundColor: colors.background,
        },
      ]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <MedicationOverviewPanel
        med={med}
        tab={tab}
        onTabChange={setTab}
        onBack={() =>
          router.canGoBack() ? router.back() : router.replace("/(tabs)/home")
        }
        onAdd={() => {
          if (med.data && !med.busy)
            router.push({
              pathname: "/medication/setup",
              params: { patientId: med.data.patientId, newPlan: "1" },
            });
        }}
        onContinue={(draftId) => {
          if (med.data && !med.busy)
            router.push({
              pathname: "/medication/setup",
              params: { patientId: med.data.patientId, draftId },
            });
        }}
        onConsent={(scheduleId) =>
          router.push({
            pathname: "/medication/consent",
            params: { scheduleId },
          })
        }
        onAnswer={(doseId) =>
          router.push({
            pathname: "/medication/call/[doseId]",
            params: { doseId },
          })
        }
      />
    </View>
  );
}
