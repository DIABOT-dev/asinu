import { useState } from "react";
import type { ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { AiDataConsentModal } from "../../components/AiDataConsentModal";
import { ScaledText as Text } from "../../components/ScaledText";
import { useThemeColors } from "../../hooks/useThemeColors";
import {
  medicationNameHasNoDose,
  useMedicationSetup,
  type MedicationSetupController,
} from "./useMedicationSetup";
import type { MedKind } from "./v21.api";
import { medicationSetupStyles as s } from "./medication-setup.styles";
import { medicationQuickNames, validMedicationNote } from "./medication-input";
import { MedicationPhotoPreview } from "./MedicationPhotoPreview";
import { MedicationScanOverlay } from "./MedicationScanOverlay";
import { MedicationBackground } from "./MedicationBackground";
import { MedicationDosePicker } from "./MedicationDosePicker";
import { MedicationTimeField } from "./MedicationTimeField";
import {
  MedicationPurposeReview,
  MedicationPurposeTags,
} from "./MedicationPurposeTags";

function Option({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.option, (disabled || pressed) && s.disabled]}
    >
      <Ionicons name={icon} size={24} color={colors.primaryText} />
      <Text style={[s.label, s.flex, { color: colors.textPrimary }]}>
        {label}
      </Text>
    </Pressable>
  );
}
function Chip({
  label,
  selected,
  onPress,
  disabled = false,
  radio = false,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  radio?: boolean;
}) {
  const { colors } = useThemeColors();
  return (
    <Pressable
      accessibilityRole={
        radio ? "radio" : selected === undefined ? "button" : "checkbox"
      }
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[
        s.chip,
        {
          backgroundColor: selected ? colors.primaryLight : colors.surfaceMuted,
        },
        disabled && s.disabled,
      ]}
    >
      {selected && (
        <Ionicons name="checkmark" size={18} color={colors.primaryText} />
      )}
      <Text
        style={[
          s.chipText,
          { color: selected ? colors.primaryText : colors.textPrimary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}
function Help({ label, children }: { label: string; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useThemeColors();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={s.helpToggle}
      >
        <Text style={[s.label, s.flex, { color: colors.primaryText }]}>
          {label}
        </Text>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.textSecondary}
        />
      </Pressable>
      {expanded && (
        <Text style={[s.helpText, { color: colors.textPrimary }]}>
          {children}
        </Text>
      )}
    </View>
  );
}
export function MedicationSetupPanel({
  setup,
}: {
  setup: MedicationSetupController;
}) {
  const { t } = useTranslation("v21");
  const { colors } = useThemeColors();
  const insets = useSafeAreaInsets();
  const title = { color: colors.textPrimary };
  const { data, step, draft, slots, busy, listening } = setup;
  const disabled = busy || !data;
  const quickNames = medicationQuickNames(data?.conditions);
  return (
    <KeyboardAvoidingView
      style={[
        s.root,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <MedicationBackground />
      <View
        style={s.chrome}
        accessibilityElementsHidden={setup.scanning}
        importantForAccessibility={
          setup.scanning ? "no-hide-descendants" : "auto"
        }
      >
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("back")}
            disabled={busy || listening}
            onPress={setup.leave}
            style={s.iconButton}
          >
            <Ionicons name="arrow-back" size={23} color={colors.textPrimary} />
          </Pressable>
          <Text accessibilityRole="header" style={[s.heading, title, s.flex]}>
            {t("setupTitle")}
          </Text>
          {(draft.length > 0 || setup.photo || slots.length > 0) && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("saveDraftAndLeave")}
              disabled={busy || listening}
              onPress={() => void setup.exitDraft()}
              style={s.laterButton}
            >
              <Text style={[s.laterText, { color: colors.primaryText }]}>
                {t("saveDraftAndLeave")}
              </Text>
            </Pressable>
          )}
        </View>
        <View
          accessibilityRole="progressbar"
          accessibilityLabel={t("step", {
            current: step,
            label: t(`doseStep${step}`),
          })}
          accessibilityValue={{ min: 1, max: 4, now: step }}
          style={s.progress}
        >
          {[1, 2, 3, 4].map((n) => (
            <View
              key={n}
              style={[s.progressSegment, n === 4 && s.progressLast]}
            >
              <View
                style={[
                  s.progressDot,
                  {
                    backgroundColor:
                      n <= step ? colors.primaryLight : colors.surfaceMuted,
                  },
                ]}
              >
                {n < step ? (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={colors.primaryText}
                  />
                ) : (
                  <Text
                    style={[
                      s.stepNumber,
                      {
                        color:
                          n <= step ? colors.primaryText : colors.textSecondary,
                      },
                    ]}
                  >
                    {n}
                  </Text>
                )}
              </View>
              {n < 4 && (
                <View
                  style={[
                    s.progressLine,
                    {
                      backgroundColor:
                        n < step ? colors.primary : colors.border,
                    },
                  ]}
                />
              )}
            </View>
          ))}
        </View>
      </View>
      <ScrollView
        accessibilityElementsHidden={setup.scanning}
        importantForAccessibility={
          setup.scanning ? "no-hide-descendants" : "auto"
        }
        key={step}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={s.scroll}
        contentContainerStyle={s.content}
      >
        <Text accessibilityRole="header" style={[s.stepTitle, title]}>
          {t(`doseStep${step}`)}
        </Text>
        {setup.draftStatus !== "idle" && (
          <View style={s.draftStatus}>
            <Ionicons
              name={
                setup.draftStatus === "error"
                  ? "cloud-offline-outline"
                  : setup.draftStatus === "saved"
                  ? "cloud-done-outline"
                  : "cloud-upload-outline"
              }
              size={18}
              color={
                setup.draftStatus === "error"
                  ? colors.danger
                  : colors.primaryText
              }
            />
            <Text
              accessibilityLiveRegion="polite"
              style={[
                s.caption,
                s.flex,
                {
                  color:
                    setup.draftStatus === "error"
                      ? colors.danger
                      : colors.textSecondary,
                },
              ]}
            >
              {t(
                setup.draftStatus === "error"
                  ? setup.draftErrorKey
                  : setup.draftStatus === "saved"
                  ? "draftSaved"
                  : "draftSaving"
              )}
            </Text>
            {setup.draftStatus === "error" && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("retry")}
                accessibilityState={{ disabled: busy || listening }}
                disabled={busy || listening}
                onPress={() => void setup.retryDraft()}
                style={{
                  minHeight: 44,
                  justifyContent: "center",
                  paddingHorizontal: 8,
                }}
              >
                <Text style={[s.label, { color: colors.primaryText }]}>
                  {t("retry")}
                </Text>
              </Pressable>
            )}
          </View>
        )}
        {(draft.length > 0 || setup.photo || slots.length > 0) && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("deleteDraft")}
            disabled={busy || listening}
            onPress={setup.discardDraft}
            style={{
              minHeight: 44,
              alignSelf: "flex-end",
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={colors.textSecondary}
            />
            <Text style={[s.caption, { color: colors.textSecondary }]}>
              {t("deleteDraft")}
            </Text>
          </Pressable>
        )}
        {!data ? (
          <View style={s.empty}>
            {setup.loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Option
                label={t("retry")}
                icon="refresh"
                onPress={() => void setup.reload()}
              />
            )}
          </View>
        ) : (
          <>
            {step === 1 && <MedicationDosePicker setup={setup} />}
            {step === 2 && (
              <>
                {data.items.length > 0 && (
                  <View style={s.section}>
                    <Text style={[s.sectionTitle, title]}>
                      {t("doseSavedMedicines")}
                    </Text>
                    {data.items.map((item) => {
                      const selected = draft.findIndex(
                        (row) => row.existingItemId === item.id
                      );
                      return (
                        <Pressable
                          key={item.id}
                          accessibilityRole="checkbox"
                          accessibilityLabel={item.display_name}
                          accessibilityState={{
                            checked: selected >= 0,
                            disabled,
                          }}
                          disabled={disabled}
                          onPress={() =>
                            selected >= 0
                              ? setup.removeItem(selected)
                              : setup.selectExisting(item.id)
                          }
                          style={s.option}
                        >
                          <Ionicons
                            name={selected >= 0 ? "checkbox" : "square-outline"}
                            size={24}
                            color={colors.primaryText}
                          />
                          <Text style={[s.label, title, s.flex]}>
                            {item.display_name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                {setup.photo && (
                  <Image
                    source={{ uri: setup.photo }}
                    resizeMode="contain"
                    style={s.photo}
                  />
                )}
                {data.flags.scan && setup.scanFailures < 2 && (
                  <>
                    <Option
                      label={t("camera")}
                      icon="camera-outline"
                      disabled={disabled || listening}
                      onPress={() => void setup.pick(true)}
                    />
                    <Option
                      label={t("library")}
                      icon="images-outline"
                      disabled={disabled || listening}
                      onPress={() => void setup.pick(false)}
                    />
                  </>
                )}
                <Option
                  label={t("manual")}
                  icon="create-outline"
                  disabled={disabled || listening}
                  onPress={setup.addManual}
                />
                <Option
                  label={t(listening ? "stopVoice" : "voiceName")}
                  icon={listening ? "stop-circle-outline" : "mic-outline"}
                  disabled={disabled}
                  onPress={setup.voice}
                />
                {!setup.scanning && (busy || listening) && (
                  <View style={s.status}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={[s.label, title, s.flex]}>
                      {t(listening ? "voiceListening" : "loading")}
                    </Text>
                  </View>
                )}
              </>
            )}
            {step === 3 && (
              <>
                {draft.some((item) => item.source === "PHOTO_AI") && (
                  <View style={s.section}>
                    <Text style={[s.helpText, title]}>
                      {t("scanReviewNotice")}
                    </Text>
                    {setup.photo && (
                      <MedicationPhotoPreview
                        uri={setup.photo}
                        label={t("medicationSourcePhoto")}
                      />
                    )}
                  </View>
                )}
                {draft.map((item, index) => (
                  <View key={item.clientId} style={s.item}>
                    <View style={s.itemHeader}>
                      <Text style={[s.sectionTitle, title, s.flex]}>
                        {t("setupItemNumber", { number: index + 1 })}
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("setupRemoveItem", {
                          number: index + 1,
                        })}
                        disabled={busy}
                        onPress={() => setup.removeItem(index)}
                        style={s.iconButton}
                      >
                        <Ionicons
                          name="trash-outline"
                          size={21}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    </View>
                    {item.existingItemId ? (
                      <View style={s.section}>
                        <Text style={[s.sectionTitle, title]}>
                          {item.display_name}
                        </Text>
                        <MedicationPurposeTags
                          codes={item.selectedPurposeCodes || []}
                        />
                      </View>
                    ) : (
                      <>
                        {item.source === "PHOTO_AI" && !!item.printed_name && (
                          <View style={s.printedName}>
                            <Text
                              style={[
                                s.caption,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {t("medicationPrintedName")}
                            </Text>
                            <Text selectable style={[s.label, title]}>
                              {item.printed_name}
                            </Text>
                          </View>
                        )}
                        <Text
                          style={[s.caption, { color: colors.textSecondary }]}
                        >
                          {t("name")}
                        </Text>
                        <TextInput
                          accessibilityLabel={t("name")}
                          placeholder={t("setupNamePlaceholder")}
                          placeholderTextColor={colors.textSecondary}
                          maxLength={30}
                          value={item.display_name}
                          editable={!busy}
                          onChangeText={(value) =>
                            setup.update(index, {
                              display_name: value,
                              confirmed: false,
                            })
                          }
                          style={[
                            s.nameInput,
                            {
                              color: colors.textPrimary,
                              backgroundColor: colors.surfaceMuted,
                            },
                          ]}
                        />
                        {!!item.display_name &&
                          !medicationNameHasNoDose(item.display_name) && (
                            <Text
                              accessibilityRole="alert"
                              style={[s.error, { color: colors.danger }]}
                            >
                              {t("noDosage")}
                            </Text>
                          )}
                        <Text
                          style={[s.caption, { color: colors.textSecondary }]}
                        >
                          {t("medicationKindLabel")}
                        </Text>
                        <View style={s.chips}>
                          {(["MEDICINE", "SUPPLEMENT"] as MedKind[]).map(
                            (kind) => (
                              <Chip
                                key={kind}
                                radio
                                label={t(kind)}
                                selected={item.kind === kind}
                                disabled={busy}
                                onPress={() =>
                                  setup.update(index, {
                                    kind,
                                    confirmed: false,
                                  })
                                }
                              />
                            )
                          )}
                        </View>
                        <MedicationPurposeReview
                          item={item}
                          disabled={busy}
                          onRetry={() => setup.retryPurpose(index)}
                          onToggle={(code) =>
                            setup.update(index, {
                              selectedPurposeCodes:
                                item.selectedPurposeCodes?.includes(code)
                                  ? item.selectedPurposeCodes.filter(
                                      (value) => value !== code
                                    )
                                  : [
                                      ...(item.selectedPurposeCodes || []),
                                      code,
                                    ],
                              confirmed: false,
                            })
                          }
                        />
                        <Pressable
                          accessibilityRole="checkbox"
                          accessibilityLabel={t(
                            item.selectedPurposeCodes?.length
                              ? "itemAndTagsConfirmed"
                              : "itemConfirmed"
                          )}
                          accessibilityState={{
                            checked: item.confirmed,
                            disabled:
                              busy ||
                              (item.kind === "MEDICINE" &&
                                !item.purposeLookup?.result),
                          }}
                          disabled={
                            busy ||
                            (item.kind === "MEDICINE" &&
                              !item.purposeLookup?.result)
                          }
                          onPress={() =>
                            setup.update(index, { confirmed: !item.confirmed })
                          }
                          style={s.confirmRow}
                        >
                          <Ionicons
                            name={
                              item.confirmed ? "checkbox" : "square-outline"
                            }
                            size={23}
                            color={colors.primaryText}
                          />
                          <Text style={[s.label, title, s.flex]}>
                            {t(
                              item.selectedPurposeCodes?.length
                                ? "itemAndTagsConfirmed"
                                : "itemConfirmed"
                            )}
                          </Text>
                        </Pressable>
                      </>
                    )}
                    {!!item.timeHints?.length && (
                      <Text
                        style={[s.caption, { color: colors.textSecondary }]}
                      >
                        {t("medicationTimeHint", {
                          times: item.timeHints
                            .map((hint) => t(`medicationHint_${hint}`))
                            .join(", "),
                        })}
                      </Text>
                    )}
                    <Text style={[s.label, { color: colors.primaryText }]}>
                      {t("doseAssignTimes")}
                    </Text>
                    <View style={s.chips}>
                      {slots.map((slot, slotIndex) => (
                        <Chip
                          key={slotIndex}
                          label={slot.time_local}
                          selected={slot.item_indexes.includes(index)}
                          disabled={busy}
                          onPress={() => setup.assignItem(index, slotIndex)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
                <Option
                  label={t("doseAddMore")}
                  icon="add"
                  disabled={busy}
                  onPress={setup.addMore}
                />
                <View style={s.section}>
                  <Text style={[s.sectionTitle, title]}>
                    {t("setupQuickAdd")}
                  </Text>
                  <View style={s.chips}>
                    {quickNames.map((code) => (
                      <Chip
                        key={code}
                        label={t(code)}
                        disabled={busy || draft.length >= 20}
                        onPress={() =>
                          setup.addItem(t(code), code === "supplement")
                        }
                      />
                    ))}
                  </View>
                  <Option
                    label={t("addItem")}
                    icon="add"
                    disabled={busy || draft.length >= 20}
                    onPress={() => setup.addItem()}
                  />
                </View>
              </>
            )}
            {step === 4 && (
              <>
                {slots.map((slot, index) => (
                  <View key={index} style={s.review}>
                    <MedicationTimeField
                      label={t("setupReminderTime")}
                      accessibilityLabel={`${t("timeLabel")} ${index + 1}`}
                      value={slot.time_local}
                      disabled={busy}
                      onChange={(value) =>
                        setup.setSlots((old) =>
                          old.map((s, n) =>
                            n === index ? { ...s, time_local: value } : s
                          )
                        )
                      }
                    />
                    <View style={s.reviewItems}>
                      {slot.item_indexes.map((itemIndex) => (
                        <View key={itemIndex} style={s.reviewItem}>
                          {draft[itemIndex]?.photo_uri && (
                            <MedicationPhotoPreview
                              compact
                              uri={draft[itemIndex].photo_uri!}
                              label={draft[itemIndex].display_name}
                            />
                          )}
                          <View style={[s.flex, { gap: 6 }]}>
                            <Text style={[s.label, title]}>
                              {draft[itemIndex]?.display_name}
                            </Text>
                            <MedicationPurposeTags
                              codes={
                                draft[itemIndex]?.selectedPurposeCodes || []
                              }
                            />
                            <Text
                              style={[
                                s.caption,
                                { color: colors.textSecondary },
                              ]}
                            >
                              {t(draft[itemIndex]?.kind || "MEDICINE")}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    <Text style={[s.caption, { color: colors.textSecondary }]}>
                      {t("medicationNoteLabel")}
                    </Text>
                    <TextInput
                      accessibilityLabel={t("medicationNoteAt", {
                        time: slot.time_local,
                      })}
                      placeholder={t("medicationNotePlaceholder")}
                      placeholderTextColor={colors.textSecondary}
                      value={slot.note || ""}
                      maxLength={60}
                      editable={!busy}
                      onChangeText={(note) =>
                        setup.setSlots((old) =>
                          old.map((row, n) =>
                            n === index ? { ...row, note } : row
                          )
                        )
                      }
                      style={[
                        s.nameInput,
                        {
                          color: colors.textPrimary,
                          backgroundColor: colors.surfaceMuted,
                        },
                      ]}
                    />
                    {!validMedicationNote(slot.note || "") && (
                      <Text
                        accessibilityRole="alert"
                        style={[s.error, { color: colors.danger }]}
                      >
                        {t("medicationNoteInvalid")}
                      </Text>
                    )}
                    {(slot.time_local < "07:00" ||
                      slot.time_local >= "21:00") && (
                      <View style={s.status}>
                        <Ionicons
                          name="notifications-outline"
                          size={19}
                          color={colors.primaryText}
                        />
                        <Text style={[s.label, { color: colors.primaryText }]}>
                          {t("medicationPushOnly")}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
                <Help label={t("setupReviewHelp")}>{t("reviewIntro")}</Help>
              </>
            )}
          </>
        )}
      </ScrollView>
      {data && (
        <View
          accessibilityElementsHidden={setup.scanning}
          importantForAccessibility={
            setup.scanning ? "no-hide-descendants" : "auto"
          }
          style={[
            s.footer,
            {
              backgroundColor: colors.background,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              step === 4 ? (data.self ? "save" : "sendConsent") : "next"
            )}
            accessibilityState={{ disabled: !setup.canContinue, busy }}
            disabled={!setup.canContinue}
            onPress={setup.next}
            style={[
              s.primaryButton,
              { backgroundColor: colors.primaryText },
              !setup.canContinue && s.disabled,
            ]}
          >
            {busy && <ActivityIndicator color={colors.surface} />}
            <Text style={[s.buttonText, { color: colors.surface }]}>
              {t(step === 4 ? (data.self ? "save" : "sendConsent") : "next")}
            </Text>
          </Pressable>
        </View>
      )}
      <MedicationScanOverlay visible={setup.scanning} />
      <AiDataConsentModal
        visible={setup.consent}
        onDecline={setup.declineAi}
        onAgree={setup.agreeAi}
      />
    </KeyboardAvoidingView>
  );
}

export default function MedicationSetupScreen() {
  const setup = useMedicationSetup();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <MedicationSetupPanel setup={setup} />
    </>
  );
}
