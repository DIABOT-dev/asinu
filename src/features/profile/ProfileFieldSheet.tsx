import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInput as NativeTextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import WheelPicker from "@quidone/react-native-wheel-picker";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../../components/ScaledText";
import { ScaledTextInput as TextInput } from "../../components/ScaledTextInput";
import { ModalToastHost } from "../../components/GlobalToastHost";
import { useThemeColors } from "../../hooks/useThemeColors";
import { useScaledTypography } from "../../hooks/useScaledTypography";
import { authApi, type UpdateProfilePayload } from "../auth/auth.api";
import { useAuthStore, type Profile } from "../auth/auth.store";
import { ApiError, getApiErrorMessage } from "../../lib/apiClient";
import { showToast } from "../../stores/toast.store";
import {
  BLOOD_TYPES,
  PROFILE_FIELD_LABELS,
  changeBirthDate,
  dateParts,
  fieldError,
  fieldUpdate,
  initialFieldDraft,
  normalizedDraft,
  type PersonalProfileField,
  type ProfileAddress,
  type ProfileFieldDraft,
} from "./profile-fields";
import {
  alphabeticProvinces,
  provinceDisplayName,
  filterAdministrativeUnits,
  findProvince,
  type AdministrativeWard,
} from "./administrative-units";
import { MeasurementRuler } from "./MeasurementRuler";

const conditions = [
  ["Tiểu đường", "diseaseDiabetes"],
  ["Cao huyết áp", "diseaseHypertension"],
  ["Tim mạch", "diseaseHeart"],
  ["Mỡ máu", "diseaseCholesterol"],
  ["Gút (Gout)", "diseaseGout"],
  ["Hen suyễn", "diseaseAsthma"],
  ["Dạ dày", "diseaseStomach"],
  ["Gan nhiễm mỡ", "diseaseFattyLiver"],
] as const;

type Props = {
  field: PersonalProfileField;
  profile: Profile;
  onClose: () => void;
  /** Onboarding confirms a local draft; the full questionnaire is submitted later. */
  onConfirm?: (update: UpdateProfilePayload) => void;
  birthYearOnly?: { min: number; max: number };
  allowEmptyPhone?: boolean;
};
export function ProfileFieldSheet({
  field,
  profile,
  onClose,
  onConfirm,
  birthYearOnly,
  allowEmptyPhone = false,
}: Props) {
  const { t } = useTranslation("profile");
  const { t: tc } = useTranslation("common");
  const { colors, isDark } = useThemeColors();
  const { scaledSize } = useScaledTypography();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [draft, setDraft] = useState<ProfileFieldDraft>(() =>
    initialFieldDraft(field, profile)
  );
  const baseline = useRef(
    normalizedDraft(field, initialFieldDraft(field, profile))
  );
  const [customCondition, setCustomCondition] = useState("");
  const [saving, setSaving] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addressSelector, setAddressSelector] = useState<
    "province" | "ward" | null
  >(null);
  const [addressQuery, setAddressQuery] = useState("");
  const busy = useRef(false);
  const active = useRef(true);
  const wheels = useRef(new Set<string>());
  const measurementMoving = useRef(false);
  const input = useRef<NativeTextInput>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const changed = normalizedDraft(field, draft) !== baseline.current;
  const year = Number(String(draft).slice(0, 4));
  const invalid =
    (onConfirm && allowEmptyPhone && field === "phone" && !String(draft).trim()
      ? null
      : fieldError(field, draft)) ||
    (birthYearOnly && (year < birthYearOnly.min || year > birthYearOnly.max)
      ? "dateOfBirthInvalid"
      : null);
  const disabled = saving || spinning || !changed || Boolean(invalid);
  const setValue = (next: ProfileFieldDraft) => {
    if (busy.current || !active.current) return;
    setError(null);
    setDraft(next);
  };
  const address = draft as ProfileAddress;
  const selectedProvince =
    field === "address"
      ? findProvince(address.provinceCode, address.province)
      : undefined;
  const addressOptions = filterAdministrativeUnits<AdministrativeWard>(
    addressSelector === "province"
      ? alphabeticProvinces
      : selectedProvince?.wards ?? [],
    addressQuery
  );
  const openAddressSelector = (part: "province" | "ward") => {
    if (
      busy.current ||
      !active.current ||
      (part === "ward" && !selectedProvince)
    )
      return;
    setAddressQuery("");
    setAddressSelector(part);
  };
  const selectAddressOption = (option: AdministrativeWard) => {
    if (busy.current || !active.current) return;
    if (addressSelector === "province") {
      if (option.code !== selectedProvince?.code)
        setValue({
          ...address,
          province: option.name,
          provinceCode: option.code,
          ward: "",
          wardCode: "",
        });
    } else if (
      selectedProvince?.wards.some((ward) => ward.code === option.code)
    ) {
      setValue({ ...address, ward: option.name, wardCode: option.code });
    }
    setAddressSelector(null);
    setAddressQuery("");
  };
  const close = () => {
    if (busy.current) return;
    active.current = false;
    onClose();
  };
  const save = async () => {
    if (
      busy.current ||
      !active.current ||
      wheels.current.size > 0 ||
      measurementMoving.current ||
      !changed ||
      invalid
    )
      return;
    if (onConfirm) {
      const update = fieldUpdate(field, draft);
      active.current = false;
      onConfirm(update);
      onClose();
      return;
    }
    const owner = String(profile.id);
    if (String(useAuthStore.getState().profile?.id) !== owner) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    try {
      const updated = await authApi.updateProfile(fieldUpdate(field, draft));
      if (
        !active.current ||
        String(useAuthStore.getState().profile?.id) !== owner
      )
        return;
      if (String(updated?.id) !== owner)
        throw new Error("Profile response does not match owner");
      useAuthStore.setState({ profile: updated });
      active.current = false;
      onClose();
      showToast(t("profileUpdated"), "success");
    } catch (cause) {
      if (
        active.current &&
        String(useAuthStore.getState().profile?.id) === owner
      ) {
        setError(
          cause instanceof ApiError &&
            cause.statusCode === 409 &&
            field === "phone"
            ? t("phoneAlreadyUsed")
            : getApiErrorMessage(cause, t, "profileUpdateError")
        );
      }
    } finally {
      busy.current = false;
      if (active.current) setSaving(false);
    }
  };
  const toggleCondition = (value: string) => {
    if (busy.current || !active.current) return;
    setError(null);
    setDraft((previous) =>
      (previous as string[]).includes(value)
        ? (previous as string[]).filter((item) => item !== value)
        : [...(previous as string[]), value]
    );
  };
  const addCondition = () => {
    if (busy.current || !customCondition.trim()) return;
    const additions = customCondition
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    setDraft((previous) => [
      ...new Set([...(previous as string[]), ...additions]),
    ]);
    setCustomCondition("");
    setError(null);
  };
  const textField = ["name", "phone"].includes(field);
  const parts = dateParts(String(draft));
  const rowHeight = Math.max(44, Math.round(scaledSize.lg * 1.6));
  const wheel = (part: "day" | "month" | "year", values: number[]) => (
    <View style={styles.wheelColumn} key={part}>
      <Text style={styles.wheelLabel}>{t(part)}</Text>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t(part)}
        accessibilityState={{ disabled: saving }}
        accessibilityValue={{ text: String(parts[part]) }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(event) => {
          const index = values.indexOf(parts[part]);
          const next = Math.max(
            0,
            Math.min(
              values.length - 1,
              index + (event.nativeEvent.actionName === "increment" ? 1 : -1)
            )
          );
          setValue(changeBirthDate(String(draft), part, values[next]));
        }}
      >
        <WheelPicker
          testID={`profile-date-${part}`}
          data={values.map((value) => ({
            value,
            label: String(value).padStart(part === "year" ? 4 : 2, "0"),
          }))}
          value={parts[part]}
          width="100%"
          itemHeight={rowHeight}
          visibleItemCount={3}
          enableScrollByTapOnItem
          disableIntervalMomentum
          itemTextStyle={{
            fontSize: scaledSize.lg,
            color: colors.textPrimary,
            fontWeight: "600",
          }}
          overlayItemStyle={{
            backgroundColor: colors.primary,
            opacity: 0.1,
            borderRadius: 12,
          }}
          _onScrollStart={() => {
            wheels.current.add(part);
            setSpinning(true);
          }}
          _onScrollEnd={() => {
            wheels.current.delete(part);
            setSpinning(wheels.current.size > 0);
          }}
          onValueChanged={({ item }) =>
            setValue(changeBirthDate(String(draft), part, item.value))
          }
        />
      </View>
    </View>
  );

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={() =>
        addressSelector ? setAddressSelector(null) : close()
      }
      onShow={() => {
        if (textField) input.current?.focus();
      }}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View
          style={[
            styles.sheet,
            addressSelector && styles.selectorSheet,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
          accessibilityViewIsModal
        >
          {addressSelector && (
            <View style={styles.sheetHandle} importantForAccessibility="no" />
          )}
          <View
            style={[styles.header, addressSelector && styles.selectorHeader]}
          >
            {addressSelector ? (
              <Pressable
                style={styles.closeButton}
                onPress={() => setAddressSelector(null)}
                accessibilityRole="button"
                accessibilityLabel={tc("back")}
              >
                <Ionicons
                  name="arrow-back"
                  size={24}
                  color={colors.textPrimary}
                />
              </Pressable>
            ) : (
              <View style={styles.closeSpacer} />
            )}
            <Text accessibilityRole="header" style={styles.title}>
              {t(
                addressSelector === "province"
                  ? "selectProvinceTitle"
                  : addressSelector === "ward"
                  ? "selectWardTitle"
                  : birthYearOnly
                  ? "birthYear"
                  : PROFILE_FIELD_LABELS[field]
              )}
            </Text>
            {addressSelector ? (
              <View style={styles.closeSpacer} />
            ) : (
              <Pressable
                style={styles.closeButton}
                onPress={close}
                disabled={saving}
                accessibilityRole="button"
                accessibilityLabel={tc("close")}
                accessibilityState={{ disabled: saving }}
              >
                <Ionicons name="close" size={24} color={colors.textPrimary} />
              </Pressable>
            )}
          </View>
          {addressSelector ? (
            <View style={styles.addressPicker}>
              <View style={styles.searchRow}>
                <Ionicons
                  name="search"
                  size={22}
                  color={colors.textSecondary}
                />
                <TextInput
                  style={styles.input}
                  value={addressQuery}
                  onChangeText={setAddressQuery}
                  accessibilityLabel={t("searchAddress")}
                  placeholder={t("searchAddress")}
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
              <FlatList<AdministrativeWard>
                style={styles.addressList}
                data={addressOptions}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                keyExtractor={(item) => item.code}
                initialNumToRender={12}
                ListEmptyComponent={
                  <Text style={styles.wheelLabel}>{t("noAddressResults")}</Text>
                }
                renderItem={({ item }) => (
                  <Pressable
                    style={styles.addressOption}
                    onPress={() => selectAddressOption(item)}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                  >
                    <Text style={styles.addressOptionText}>
                      {addressSelector === "province"
                        ? provinceDisplayName(item.name)
                        : item.name}
                    </Text>
                    {(addressSelector === "province"
                      ? address.provinceCode
                      : address.wardCode) === item.code && (
                      <Ionicons
                        name="checkmark"
                        size={22}
                        color={colors.primaryText}
                      />
                    )}
                  </Pressable>
                )}
              />
            </View>
          ) : (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.body}
            >
              {textField && (
                <View style={styles.inputRow}>
                  <TextInput
                    ref={input}
                    testID="profile-field-input"
                    style={styles.input}
                    accessibilityLabel={t(PROFILE_FIELD_LABELS[field])}
                    value={String(draft)}
                    onChangeText={setValue}
                    editable={!saving}
                    autoCapitalize={field === "name" ? "words" : "none"}
                    keyboardType={
                      field === "phone"
                        ? "phone-pad"
                        : field === "name"
                        ? "default"
                        : "decimal-pad"
                    }
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      void save();
                    }}
                  />
                  {String(draft).length > 0 && (
                    <Pressable
                      style={styles.closeButton}
                      onPress={() => setValue("")}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel={t("clearField")}
                    >
                      <Ionicons
                        name="close-circle"
                        size={24}
                        color={colors.textSecondary}
                      />
                    </Pressable>
                  )}
                </View>
              )}
              {(field === "heightCm" || field === "weightKg") && (
                <MeasurementRuler
                  kind={field === "heightCm" ? "height" : "weight"}
                  value={String(draft)}
                  disabled={saving}
                  onChange={(value) => setValue(String(value))}
                  onInteractionChange={(moving) => {
                    measurementMoving.current = moving;
                    if (active.current) setSpinning(moving);
                  }}
                />
              )}
              {field === "gender" && (
                <View
                  style={styles.genderRow}
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t("gender")}
                >
                  {(["Nữ", "Nam", "Khác"] as const).map((value) => (
                    <Pressable
                      key={value}
                      style={[
                        styles.genderOption,
                        draft === value && styles.selectedOption,
                      ]}
                      onPress={() => setValue(value)}
                      disabled={saving}
                      accessibilityRole="radio"
                      accessibilityLabel={
                        value === "Khác"
                          ? t("genderOther")
                          : tc(value === "Nam" ? "male" : "female")
                      }
                      accessibilityState={{
                        checked: draft === value,
                        disabled: saving,
                      }}
                    >
                      <View style={styles.genderIcon}>
                        <Ionicons
                          name={
                            value === "Khác"
                              ? "person-outline"
                              : value === "Nam"
                              ? "male"
                              : "female"
                          }
                          size={36}
                          color={colors.primaryText}
                        />
                      </View>
                      <Text style={styles.optionText}>
                        {value === "Khác"
                          ? t("genderOther")
                          : tc(value === "Nam" ? "male" : "female")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {field === "dateOfBirth" && (
                <View
                  style={styles.wheels}
                  pointerEvents={saving ? "none" : "auto"}
                >
                  {!birthYearOnly &&
                    wheel(
                      "day",
                      Array.from(
                        {
                          length: new Date(
                            parts.year,
                            parts.month,
                            0
                          ).getDate(),
                        },
                        (_, index) => index + 1
                      )
                    )}
                  {!birthYearOnly &&
                    wheel(
                      "month",
                      Array.from({ length: 12 }, (_, index) => index + 1)
                    )}
                  {wheel(
                    "year",
                    birthYearOnly
                      ? Array.from(
                          { length: birthYearOnly.max - birthYearOnly.min + 1 },
                          (_, index) => birthYearOnly.max - index
                        )
                      : Array.from(
                          { length: 151 },
                          (_, index) => new Date().getFullYear() - index
                        )
                  )}
                </View>
              )}
              {field === "bloodType" && (
                <View
                  style={styles.choices}
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t("bloodType")}
                >
                  {["", ...BLOOD_TYPES].map((value) => (
                    <Pressable
                      key={value || "unknown"}
                      style={[
                        styles.choice,
                        draft === value && styles.selectedOption,
                      ]}
                      onPress={() => setValue(value)}
                      disabled={saving}
                      accessibilityRole="radio"
                      accessibilityLabel={value || t("bloodTypeUnknown")}
                      accessibilityState={{
                        checked: draft === value,
                        disabled: saving,
                      }}
                    >
                      <Text style={styles.optionText}>
                        {value || t("bloodTypeUnknown")}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {field === "chronicDiseases" && (
                <>
                  <View style={styles.choices}>
                    {[
                      ...conditions.map(([value, label]) => ({
                        value,
                        label: t(label),
                      })),
                      ...(draft as string[])
                        .filter(
                          (value) =>
                            !conditions.some(([existing]) => value === existing)
                        )
                        .map((value) => ({ value, label: value })),
                    ].map(({ value, label }) => (
                      <Pressable
                        key={value}
                        style={[
                          styles.choice,
                          (draft as string[]).includes(value) &&
                            styles.selectedOption,
                        ]}
                        onPress={() => toggleCondition(value)}
                        disabled={saving}
                        accessibilityRole="checkbox"
                        accessibilityLabel={label}
                        accessibilityState={{
                          checked: (draft as string[]).includes(value),
                          disabled: saving,
                        }}
                      >
                        <Text style={styles.optionText}>{label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      accessibilityLabel={t("addCustomDisease")}
                      placeholder={t("enterCustomDisease")}
                      placeholderTextColor={colors.textSecondary}
                      value={customCondition}
                      onChangeText={setCustomCondition}
                      editable={!saving}
                    />
                    <Pressable
                      style={styles.closeButton}
                      onPress={addCondition}
                      disabled={saving || !customCondition.trim()}
                      accessibilityRole="button"
                      accessibilityLabel={t("addCustomDisease")}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={26}
                        color={colors.primaryText}
                      />
                    </Pressable>
                  </View>
                </>
              )}
              {field === "address" && (
                <>
                  {(["province", "ward"] as const).map((part) => (
                    <View key={part} style={styles.addressField}>
                      <Text style={styles.addressLabel}>{t(part)}</Text>
                      <Pressable
                        style={[
                          styles.addressDropdown,
                          part === "ward" &&
                            !selectedProvince &&
                            styles.dropdownDisabled,
                        ]}
                        onPress={() => openAddressSelector(part)}
                        disabled={
                          saving || (part === "ward" && !selectedProvince)
                        }
                        accessibilityRole="button"
                        accessibilityLabel={t(part)}
                        accessibilityHint={
                          part === "ward" && !selectedProvince
                            ? t("selectProvinceFirst")
                            : t(`${part}Placeholder`)
                        }
                        accessibilityState={{
                          disabled:
                            saving || (part === "ward" && !selectedProvince),
                          expanded: false,
                        }}
                      >
                        <Text
                          style={[
                            styles.addressOptionText,
                            !address[part] && styles.placeholder,
                          ]}
                        >
                          {address[part] || t(`${part}Placeholder`)}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={22}
                          color={colors.textSecondary}
                        />
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.addressField}>
                    <Text style={styles.addressLabel}>{t("street")}</Text>
                    <View style={styles.inputRow}>
                      <TextInput
                        style={[styles.input, styles.streetInput]}
                        accessibilityLabel={t("street")}
                        placeholder={t("streetPlaceholder")}
                        placeholderTextColor={colors.textSecondary}
                        value={address.street}
                        onChangeText={(value) =>
                          setValue({ ...address, street: value })
                        }
                        editable={!saving}
                        maxLength={300}
                        multiline
                      />
                    </View>
                  </View>
                  {profile.address && (
                    <Pressable
                      onPress={() =>
                        setValue({
                          province: "",
                          ward: "",
                          street: "",
                          provinceCode: "",
                          wardCode: "",
                        })
                      }
                      style={styles.clearAddressButton}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel={t("clearAddress")}
                    >
                      <Text style={styles.error}>{t("clearAddress")}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    accessibilityRole="link"
                    onPress={() => {
                      void Linking.openURL(
                        "https://diachiviet.com/du-lieu-mo/"
                      );
                    }}
                  >
                    <Text style={styles.source}>
                      {t("administrativeSource")}
                    </Text>
                  </Pressable>
                </>
              )}
              {(error || (changed && invalid)) && (
                <Text
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={styles.error}
                >
                  {error || t(invalid!)}
                </Text>
              )}
            </ScrollView>
          )}
          {!addressSelector && (
            <Pressable
              style={[styles.saveButton, disabled && styles.disabled]}
              onPress={() => {
                void save();
              }}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={tc("save")}
              accessibilityState={{ disabled, busy: saving }}
            >
              {saving ? (
                <ActivityIndicator color="#F2FFFC" />
              ) : (
                <Text style={styles.saveText}>{tc("save")}</Text>
              )}
            </Pressable>
          )}
        </View>
        <ModalToastHost />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function createStyles(
  colors: ReturnType<typeof useThemeColors>["colors"],
  isDark: boolean
) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(15, 35, 31, 0.44)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: isDark ? "#1A1D27" : "#FDFFFE",
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 12,
      maxHeight: "90%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    title: {
      flex: 1,
      textAlign: "center",
      fontSize: 20,
      fontWeight: "700",
      color: colors.textPrimary,
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    closeSpacer: { width: 44 },
    body: { gap: 16, paddingBottom: 20 },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
      paddingHorizontal: 14,
      minHeight: 56,
    },
    input: {
      flex: 1,
      minHeight: 54,
      fontSize: 18,
      color: colors.textPrimary,
      paddingVertical: 12,
    },
    genderRow: { flexDirection: "row", gap: 14 },
    genderOption: {
      flex: 1,
      minHeight: 132,
      alignItems: "center",
      justifyContent: "center",
      gap: 12,
      padding: 16,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    genderIcon: {
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primaryLight,
    },
    selectedOption: {
      borderColor: colors.primaryText,
      backgroundColor: colors.primaryLight,
    },
    optionText: { fontSize: 16, fontWeight: "600", color: colors.textPrimary },
    choices: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    choice: {
      minHeight: 44,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: "center",
    },
    wheels: { flexDirection: "row", gap: 10 },
    wheelColumn: { flex: 1, minWidth: 0 },
    wheelLabel: {
      textAlign: "center",
      fontSize: 14,
      fontWeight: "600",
      color: colors.textSecondary,
      marginBottom: 10,
    },
    addressField: { gap: 8 },
    selectorSheet: { height: "90%", paddingHorizontal: 0, paddingTop: 8 },
    sheetHandle: {
      alignSelf: "center",
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      marginBottom: 12,
    },
    selectorHeader: {
      paddingHorizontal: 16,
      paddingBottom: 18,
      marginBottom: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    addressPicker: { flex: 1, paddingTop: 16 },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginHorizontal: 20,
      marginBottom: 14,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.surfaceMuted,
    },
    addressList: { flex: 1 },
    addressDropdown: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 56,
      padding: 14,
      gap: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dropdownDisabled: { backgroundColor: colors.surfaceMuted, opacity: 0.6 },
    addressOption: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      minHeight: 58,
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    addressOptionText: { flex: 1, fontSize: 17, color: colors.textPrimary },
    placeholder: { color: colors.textSecondary },
    clearAddressButton: { minHeight: 44, justifyContent: "center" },
    source: { fontSize: 12, color: colors.textSecondary },
    addressLabel: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.textPrimary,
    },
    streetInput: { minHeight: 76, textAlignVertical: "top" },
    error: { color: colors.danger, fontSize: 14 },
    saveButton: {
      minHeight: 52,
      borderRadius: 16,
      backgroundColor: colors.primaryDark,
      alignItems: "center",
      justifyContent: "center",
      padding: 12,
      marginBottom: 4,
    },
    saveText: { color: "#F2FFFC", fontSize: 18, fontWeight: "700" },
    disabled: { opacity: 0.45 },
  });
}
