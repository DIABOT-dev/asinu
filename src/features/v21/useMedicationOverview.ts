import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../auth/auth.store";
import { useToastStore } from "../../stores/toast.store";
import { v21Error } from "./V21Layout";
import {
  v21Api,
  type MedDose,
  type MedOverview,
  type MedSchedule,
  type Patient,
} from "./v21.api";

export function useMedicationOverview() {
  const { t } = useTranslation("v21");
  const token = useAuthStore((s) => s.token);
  const self = useAuthStore((s) => s.profile?.id);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patient, setPatient] = useState<number | undefined>();
  const [data, setData] = useState<MedOverview | null>(null);
  const [doses, setDoses] = useState<MedDose[]>([]);
  const [weekly, setWeekly] = useState<{
    taken: number;
    total: number;
    skipped: number;
    coins: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<MedSchedule | null>(null);
  const [mode, setMode] = useState<"menu" | "edit" | "remove">("menu");
  const [time, setTime] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const focused = useRef(false),
    version = useRef(0),
    reads = useRef(0);
  const operation = useRef<object | null>(null);
  const current = useCallback(
    (expected: number) =>
      focused.current &&
      version.current === expected &&
      useAuthStore.getState().token === token,
    [token]
  );

  const refresh = useCallback(async () => {
    const expected = version.current,
      read = ++reads.current;
    const valid = () => current(expected) && read === reads.current;
    setLoading(true);
    try {
      const flags = await v21Api.flags();
      if (!valid()) return;
      setPatients(flags.patients);
      const id =
        flags.patients.find((p) => Number(p.id) === Number(patient))?.id ||
        flags.patients[0]?.id;
      if (!id || !flags.medication) {
        setData(null);
        setDoses([]);
        setWeekly(null);
        setFailed(false);
        return;
      }
      const [overview, today, week] = await Promise.all([
        v21Api.overview(id),
        v21Api.doses(id),
        v21Api.weekly(id),
      ]);
      if (!valid()) return;
      setData(overview);
      setDoses(today.items);
      setWeekly(week.report);
      setFailed(false);
    } catch {
      if (valid()) setFailed(true);
    } finally {
      if (valid()) setLoading(false);
    }
  }, [current, patient]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      version.current++;
      operation.current = null;
      setData(null);
      setDoses([]);
      setWeekly(null);
      setSelected(null);
      setBusy(false);
      void refresh();
      return () => {
        focused.current = false;
        version.current++;
        reads.current++;
        operation.current = null;
      };
    }, [refresh])
  );

  const mutate = async (work: () => Promise<unknown>, successKey: string) => {
    const expected = version.current;
    if (operation.current || !data || !current(expected)) return;
    const owner = {};
    operation.current = owner;
    setBusy(true);
    try {
      await work();
      if (!current(expected)) return;
      setSelected(null);
      useToastStore.getState().show(t(successKey), "success");
      await refresh();
    } catch (error) {
      if (current(expected)) v21Error(error, t);
    } finally {
      if (operation.current === owner) {
        operation.current = null;
        if (current(expected)) setBusy(false);
      }
    }
  };
  const openSchedule = (schedule: MedSchedule) => {
    if (busy || loading || !data?.schedules.some((s) => s.id === schedule.id))
      return;
    setSelected(schedule);
    setMode("menu");
    setTime(schedule.time_local.slice(0, 5));
    setItems(schedule.item_ids);
  };
  const canSave =
    !!selected &&
    !!items.length &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time) &&
    (time !== selected.time_local.slice(0, 5) ||
      JSON.stringify([...items].sort()) !==
        JSON.stringify([...selected.item_ids].sort()));
  return {
    self,
    patients,
    patientId: data?.patientId,
    data,
    doses,
    weekly,
    loading,
    failed,
    busy,
    selected,
    mode,
    setMode,
    time,
    setTime,
    items,
    canSave,
    refresh,
    openSchedule,
    selectPatient: (id: number) => {
      if (!busy && id !== data?.patientId) setPatient(id);
    },
    closeSchedule: () => {
      if (!operation.current) setSelected(null);
    },
    toggleItem: (id: string) =>
      setItems((old) =>
        old.includes(id) ? old.filter((x) => x !== id) : [...old, id]
      ),
    save: () => {
      if (canSave && selected && data && mode === "edit")
        return mutate(
          () =>
            v21Api.saveSchedule(data.patientId, selected.id, {
              time_local: time,
              item_ids: items,
            }),
          "saved"
        );
    },
    remove: () => {
      if (selected && data && mode === "remove")
        return mutate(
          () => v21Api.remove(data.patientId, selected.id),
          "saved"
        );
    },
    setProblemsOnly: (value: boolean) => {
      if (data)
        return mutate(
          () => v21Api.preferences(data.patientId, value),
          value ? "preferenceOn" : "preferenceOff"
        );
    },
  };
}

export type MedicationOverviewController = ReturnType<
  typeof useMedicationOverview
>;
