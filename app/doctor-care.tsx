import { Stack, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import * as Crypto from "expo-crypto";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScaledText as Text } from "../src/components/ScaledText";
import { ScaledTextInput as TextInput } from "../src/components/ScaledTextInput";
import { useAuthStore } from "../src/features/auth/auth.store";
import { Screen } from "../src/components/Screen";
import { ScreenBackButton } from "../src/components/ScreenHeaderButton";
import { useGuardedRouter as useRouter } from "../src/hooks/useGuardedRouter";
import { useThemeColors } from "../src/hooks/useThemeColors";
import { apiClient, getApiErrorMessage } from "../src/lib/apiClient";
import { showToast } from "../src/stores/toast.store";

type CareUpdate = {
  id: string;
  actor_role: "patient" | "doctor";
  content: string;
  created_at: string;
};
type CareItem = {
  id: string;
  description: string;
  owner_role: "patient" | "doctor";
  due_at: string;
  state: string;
  version: number;
  updates: CareUpdate[];
};
type CarePlan = {
  id: string;
  title: string;
  goal: string;
  state: string;
  version: number;
  close_reason: string | null;
  items: CareItem[];
};
type CareRelationship = {
  id: string;
  tenant_id: string;
  source_task_id: string;
  doctor_name: string;
  doctor_available: boolean;
  consent_state: string;
  consent_version: string;
  plans: CarePlan[];
};
type CareResponse = {
  ok: boolean;
  data?: { items?: CareRelationship[]; item?: CareRelationship };
};

export default function DoctorCareScreen() {
  const insets = useSafeAreaInsets();
  const owner = useAuthStore((state) => state.profile?.id ?? null);
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const [stateOwner, setStateOwner] = useState(owner);
  const { t, i18n } = useTranslation("home"),
    router = useRouter(),
    { colors } = useThemeColors();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: 20, gap: 16, paddingBottom: 48 },
        heading: { fontSize: 20, fontWeight: "700", color: colors.textPrimary },
        title: { fontSize: 17, fontWeight: "700", color: colors.textPrimary },
        text: { fontSize: 15, color: colors.textPrimary, lineHeight: 23 },
        muted: { fontSize: 13, color: colors.textSecondary },
        section: {
          paddingVertical: 18,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          gap: 12,
        },
        row: {
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 10,
          alignItems: "center",
        },
        button: {
          minHeight: 44,
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderRadius: 8,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        },
        secondary: {
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.border,
        },
        buttonText: { fontSize: 15, fontWeight: "600", color: colors.surface },
        secondaryText: { color: colors.textPrimary },
        disabled: { opacity: 0.45 },
        input: {
          minHeight: 88,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
          padding: 12,
          color: colors.textPrimary,
          backgroundColor: colors.surface,
          textAlignVertical: "top",
          fontSize: 15,
        },
        selected: { backgroundColor: colors.primaryLight },
        selector: {
          padding: 12,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 8,
        },
      }),
    [colors]
  );
  const [relationshipData, setRelationships] = useState<CareRelationship[]>([]),
    [selectedData, setSelected] = useState<CareRelationship | null>(null),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false),
    [responses, setResponses] = useState<Record<string, string>>({});
  const { relationshipId } = useLocalSearchParams<{
    relationshipId?: string;
  }>();
  const selectedId = useRef<string | null>(relationshipId ?? null),
    generation = useRef(0);
  const pendingActions = useRef(
    new Map<string, { body: string; id: string }>()
  );
  const selected = stateOwner === owner ? selectedData : null;
  const relationships = stateOwner === owner ? relationshipData : [];
  useEffect(() => {
    generation.current++;
    selectedId.current = relationshipId ?? null;
    setSelected(null);
    setRelationships([]);
    setResponses({});
    pendingActions.current.clear();
    setBusy(false);
    setLoading(Boolean(owner));
    setStateOwner(owner);
  }, [owner, relationshipId]);
  const load = useCallback(async () => {
    if (!owner) return;
    const current = ++generation.current;
    setFailed(false);
    try {
      const result = await apiClient<CareResponse>("/api/doctor/care");
      if (current !== generation.current || currentOwner.current !== owner)
        return;
      const items = result.data?.items ?? [];
      setRelationships(items);
      const id =
        items.find((item) => item.id === selectedId.current)?.id ??
        items[0]?.id;
      selectedId.current = id ?? null;
      if (id) {
        const detail = await apiClient<CareResponse>("/api/doctor/care", {
          method: "POST",
          body: { operation: "get", relationship_id: id },
        });
        if (current === generation.current && currentOwner.current === owner)
          setSelected(detail.data?.item ?? null);
      } else setSelected(null);
    } catch {
      if (current === generation.current && currentOwner.current === owner)
        setFailed(true);
    } finally {
      if (current === generation.current && currentOwner.current === owner)
        setLoading(false);
    }
  }, [owner, relationshipId]);
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), 20_000);
      return () => {
        generation.current++;
        clearInterval(timer);
      };
    }, [load])
  );
  const act = async (input: Record<string, unknown>, key: string) => {
    if (busy || !owner || currentOwner.current !== owner) return;
    setBusy(true);
    const body = JSON.stringify(input),
      previous = pendingActions.current.get(key);
    const actionId =
      previous?.body === body ? previous.id : Crypto.randomUUID();
    pendingActions.current.set(key, { body, id: actionId });
    try {
      await apiClient("/api/doctor/care", {
        method: "POST",
        body: { ...input, action_id: actionId },
      });
      if (currentOwner.current !== owner) return;
      pendingActions.current.delete(key);
      await load();
      showToast(t("doctorCareSaved"), "success");
    } catch (error) {
      if (currentOwner.current === owner)
        showToast(getApiErrorMessage(error, t, "doctorCareError"), "error");
    } finally {
      if (currentOwner.current === owner) setBusy(false);
    }
  };
  const button = (
    label: string,
    onPress: () => void,
    disabled = false,
    secondary = false
  ) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        (disabled || busy) && styles.disabled,
      ]}
    >
      <Text style={[styles.buttonText, secondary && styles.secondaryText]}>
        {label}
      </Text>
    </Pressable>
  );
  const consent = (decision: "accept" | "decline" | "revoke") => {
    if (!selected) return;
    const run = () =>
      void act(
        {
          operation: "consent",
          relationship_id: selected.id,
          consent_version: "care-v1",
          decision,
        },
        `consent:${selected.id}:${decision}`
      );
    if (decision === "revoke")
      Alert.alert(t("doctorCareStop"), t("doctorCareStopDescription"), [
        { text: t("doctorCareCancel"), style: "cancel" },
        { text: t("doctorCareStop"), style: "destructive", onPress: run },
      ]);
    else run();
  };
  const when = (value: string) =>
    new Date(value).toLocaleString(
      i18n.language.startsWith("en") ? "en-US" : "vi-VN",
      { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
    );
  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 16,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <ScreenBackButton
          accessibilityLabel={t("common:back")}
          onPress={() =>
            router.canGoBack()
              ? router.back()
              : router.replace("/doctor-consultation-history")
          }
        />
        <Text
          accessibilityRole="header"
          style={[styles.heading, { flex: 1, textAlign: "center" }]}
        >
          {t("doctorCareTitle")}
        </Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
      >
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
        {failed ? (
          <View style={styles.section}>
            <Text style={styles.text}>{t("doctorCareError")}</Text>
            {button(t("doctorCareRetry"), () => void load(), false, true)}
          </View>
        ) : null}
        {!loading && !relationships.length ? (
          <Text style={styles.text}>{t("doctorCareEmpty")}</Text>
        ) : null}
        <View style={styles.row}>
          {relationships.map((item) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityState={{ selected: item.id === selected?.id }}
              onPress={() => {
                selectedId.current = item.id;
                setSelected(null);
                void load();
              }}
              style={[
                styles.selector,
                item.id === selected?.id && styles.selected,
              ]}
            >
              <Text style={styles.text}>{item.doctor_name}</Text>
            </Pressable>
          ))}
        </View>
        {selected ? (
          <>
            <Text style={styles.heading}>{selected.doctor_name}</Text>
            <Text style={styles.muted}>
              {t(`doctorCareConsent_${selected.consent_state}`)}
            </Text>
            {!selected.doctor_available ? (
              <Text style={styles.text}>{t("doctorCareUnavailable")}</Text>
            ) : null}
            {selected.consent_state === "pending" ? (
              <View style={styles.section}>
                <Text style={styles.text}>
                  {t("doctorCareConsentDescription", {
                    doctor: selected.doctor_name,
                  })}
                </Text>
                <View style={styles.row}>
                  {button(
                    t("doctorCareAgree"),
                    () => consent("accept"),
                    !selected.doctor_available
                  )}
                  {selected.consent_state === "pending"
                    ? button(
                        t("doctorCareDecline"),
                        () => consent("decline"),
                        false,
                        true
                      )
                    : null}
                </View>
              </View>
            ) : null}
            {selected.consent_state === "active" && !selected.plans.length ? (
              <Text style={styles.text}>{t("doctorCareNoPlan")}</Text>
            ) : null}
            {selected.plans.map((plan) => (
              <View key={plan.id} style={styles.section}>
                <Text style={styles.title}>{plan.title}</Text>
                <Text style={styles.muted}>
                  {t(`doctorCarePlan_${plan.state}`)}
                </Text>
                <Text style={styles.text}>{plan.goal}</Text>
                {plan.items.map((item) => (
                  <View style={styles.section} key={item.id}>
                    <Text style={styles.title}>{item.description}</Text>
                    <Text style={styles.muted}>
                      {t(
                        item.owner_role === "patient"
                          ? "doctorCareYou"
                          : "doctorCareSpecialist"
                      )}{" "}
                      · {when(item.due_at)}
                    </Text>
                    <Text style={styles.muted}>
                      {t(`doctorCareItem_${item.state}`)}
                    </Text>
                    {item.updates.map((update) => (
                      <View key={update.id}>
                        <Text style={styles.muted}>
                          {t(
                            update.actor_role === "patient"
                              ? "doctorCareYou"
                              : "doctorCareSpecialist"
                          )}{" "}
                          · {when(update.created_at)}
                        </Text>
                        <Text style={styles.text}>{update.content}</Text>
                      </View>
                    ))}
                    {selected.consent_state === "active" &&
                    selected.doctor_available &&
                    plan.state === "active" &&
                    item.owner_role === "patient" &&
                    ["pending", "changes_requested"].includes(item.state) ? (
                      <>
                        <TextInput
                          accessibilityLabel={t("doctorCareResponse")}
                          placeholder={t("doctorCareResponse")}
                          placeholderTextColor={colors.textSecondary}
                          multiline
                          maxLength={3000}
                          style={styles.input}
                          value={responses[item.id] ?? ""}
                          onChangeText={(value) =>
                            setResponses({ ...responses, [item.id]: value })
                          }
                          editable={!busy}
                        />
                        {button(
                          t("doctorCareSend"),
                          () =>
                            void act(
                              {
                                operation: "submit",
                                relationship_id: selected.id,
                                item_id: item.id,
                                expected_version: item.version,
                                response: responses[item.id]?.trim(),
                              },
                              `submit:${item.id}:${item.version}`
                            ),
                          !responses[item.id]?.trim()
                        )}
                      </>
                    ) : null}
                  </View>
                ))}
                {plan.close_reason ? (
                  <Text style={styles.text}>{plan.close_reason}</Text>
                ) : null}
                {selected.consent_state === "active" &&
                plan.state === "proposed"
                  ? button(
                      t("doctorCareAcceptPlan"),
                      () =>
                        void act(
                          {
                            operation: "accept_plan",
                            relationship_id: selected.id,
                            plan_id: plan.id,
                            expected_version: plan.version,
                          },
                          `plan:${plan.id}:${plan.version}`
                        ),
                      !selected.doctor_available
                    )
                  : null}
              </View>
            ))}
            {selected.consent_state === "active"
              ? button(
                  t("doctorCareStop"),
                  () => consent("revoke"),
                  false,
                  true
                )
              : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
