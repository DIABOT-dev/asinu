import { useCallback, useState } from "react";
import { Alert, RefreshControl, Switch, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/features/auth/auth.store";
import { useToastStore } from "../../src/stores/toast.store";
import {
  v21Api,
  Patient,
  MedOverview,
  MedDose,
} from "../../src/features/v21/v21.api";
import {
  Action,
  Choice,
  Field,
  Heading,
  Note,
  V21Layout,
  v21Error,
} from "../../src/features/v21/V21Layout";
export default function MedicationScreen() {
  const { t } = useTranslation("v21"),
    router = useRouter(),
    self = useAuthStore((s) => s.profile?.id);
  const [patients, setPatients] = useState<Patient[]>([]),
    [patient, setPatient] = useState<number | undefined>(),
    [data, setData] = useState<MedOverview | null>(null),
    [doses, setDoses] = useState<MedDose[]>([]),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<string | null>(null),
    [time, setTime] = useState(""),
    [items, setItems] = useState<string[]>([]),
    [weekly, setWeekly] = useState<{
      taken: number;
      total: number;
      skipped: number;
      coins: number;
    } | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const f = await v21Api.flags();
      setPatients(f.patients);
      const id = patient || f.patients[0]?.id;
      if (!id) {
        setData(null);
        return;
      }
      const [a, b, c] = await Promise.all([
        v21Api.overview(id),
        v21Api.doses(id),
        v21Api.weekly(id),
      ]);
      setData(a);
      setDoses(b.items);
      setWeekly(c.report);
    } catch (e) {
      v21Error(e, t);
    } finally {
      setLoading(false);
    }
  }, [patient, t]);
  useFocusEffect(
    useCallback(() => {
      setEdit(null);
      void refresh();
    }, [refresh]),
  );
  const mutate = async (work: () => Promise<unknown>, successKey = "saved") => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      setEdit(null);
      useToastStore.getState().show(t(successKey), "success");
      await refresh();
    } catch (e) {
      v21Error(e, t);
    } finally {
      setBusy(false);
    }
  };
  return (
    <V21Layout
      title={t("medicationTitle")}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void refresh()} />
      }
    >
      {patients.length > 1 && (
        <>
          <Heading>{t("forWhom")}</Heading>
          {patients.map((x) => (
            <Choice
              key={x.id}
              label={Number(x.id) === Number(self) ? t("myself") : x.name}
              selected={(patient || data?.patientId) === x.id}
              onPress={() => setPatient(x.id)}
              disabled={busy}
            />
          ))}
        </>
      )}
      {!data && <Note>{loading ? t("loading") : t("featureUnavailable")}</Note>}
      {data && (
        <>
          {data.remindersEnabled === false && <Note>{t("remindersOff")}</Note>}
          {!data.self && (
            <View
              style={{ flexDirection: "row", gap: 16, alignItems: "center" }}
            >
              <View style={{ flex: 1 }}>
                <Note>{t("problemsOnly")}</Note>
              </View>
              <Switch
                accessibilityLabel={t("problemsOnly")}
                value={!!data.problemsOnly}
                disabled={busy}
                onValueChange={(value) =>
                  void mutate(
                    () => v21Api.preferences(data.patientId, value),
                    value ? "preferenceOn" : "preferenceOff",
                  )
                }
              />
            </View>
          )}
          {!data.schedules.length && <Note>{t("noSchedules")}</Note>}
          {data.schedules.map((s) => (
            <View key={s.id} style={{ gap: 12, paddingVertical: 12 }}>
              <Heading>
                {s.time_local} ·{" "}
                {t(
                  s.consent_state === "PENDING"
                    ? "pendingConsent"
                    : s.consent_state,
                )}
              </Heading>
              {s.item_ids.map((id) => (
                <Note key={id}>
                  {data.items.find((i) => i.id === id)?.display_name}
                </Note>
              ))}
              {s.pushOnly && <Note>{t("pushOnly")}</Note>}
              {data.self && s.consent_state === "PENDING" && (
                <Action
                  label={t("consentTitle")}
                  onPress={() =>
                    router.push({
                      pathname: "/medication/consent",
                      params: { scheduleId: s.id },
                    } as any)
                  }
                />
              )}
              <Action
                secondary
                label={t("editSchedule")}
                disabled={busy}
                onPress={() => {
                  setEdit(s.id);
                  setTime(s.time_local);
                  setItems(s.item_ids);
                }}
              />
              {edit === s.id && (
                <>
                  <Field
                    accessibilityLabel={t("timeLabel")}
                    placeholder={t("timeLabel")}
                    value={time}
                    onChangeText={setTime}
                    maxLength={5}
                    keyboardType="numbers-and-punctuation"
                  />
                  {data.items.map((i) => (
                    <Choice
                      key={i.id}
                      selected={items.includes(i.id)}
                      label={i.display_name}
                      onPress={() =>
                        setItems((old) =>
                          old.includes(i.id)
                            ? old.filter((x) => x !== i.id)
                            : [...old, i.id],
                        )
                      }
                    />
                  ))}
                  <Action
                    label={t("save")}
                    disabled={
                      busy ||
                      !items.length ||
                      !/^([01]\d|2[0-3]):[0-5]\d$/.test(time) ||
                      (time === s.time_local &&
                        JSON.stringify([...items].sort()) ===
                          JSON.stringify([...s.item_ids].sort()))
                    }
                    onPress={() =>
                      void mutate(() =>
                        v21Api.saveSchedule(data.patientId, s.id, {
                          time_local: time,
                          item_ids: items,
                        }),
                      )
                    }
                  />
                </>
              )}
              <Action
                secondary
                danger
                label={t("removeSchedule")}
                disabled={busy}
                onPress={() =>
                  Alert.alert(
                    t("removeSchedule"),
                    t("removeConfirm", { time: s.time_local }),
                    [
                      { text: t("cancel"), style: "cancel" },
                      {
                        text: t("removeSchedule"),
                        style: "destructive",
                        onPress: () =>
                          void mutate(() =>
                            v21Api.remove(data.patientId, s.id),
                          ),
                      },
                    ],
                  )
                }
              />
            </View>
          ))}
          <Action
            label={t("addSchedule")}
            disabled={busy}
            onPress={() =>
              router.push({
                pathname: "/medication/setup",
                params: { patientId: data.patientId },
              } as any)
            }
          />
          {weekly && (
            <>
              <Heading>{t("weekTitle")}</Heading>
              <Note>{t("weekAdherence", weekly)}</Note>
              {weekly.skipped > 0 && (
                <Note>{t("weekSkipped", { count: weekly.skipped })}</Note>
              )}
              <Note>{t("weekCoins", { count: weekly.coins })}</Note>
            </>
          )}
          <Heading>{t("todayDoses")}</Heading>
          {doses.map((d) => (
            <View key={d.id} style={{ gap: 6 }}>
              <Note>
                {d.time_local} · {t(d.state)}
              </Note>
              {data.self && ["CALLING", "UNCONFIRMED"].includes(d.state) && (
                <Action
                  secondary
                  label={t("callTitle")}
                  onPress={() =>
                    router.push({
                      pathname: "/medication/call/[doseId]",
                      params: { doseId: d.id },
                    } as any)
                  }
                />
              )}
            </View>
          ))}
        </>
      )}
    </V21Layout>
  );
}
