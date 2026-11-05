import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../auth/auth.store";
import { useToastStore } from "../../stores/toast.store";
import { v21Error } from "./V21Layout";
import { validMedicationNote } from "./medication-input";
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
  const [note, setNote] = useState("");
  const patientScope = useRef(patient);
  const visibleScope = useRef({ token, patient });
  const focused = useRef(false),
    version = useRef(0),
    reads = useRef(0);
  const operation = useRef<object | null>(null);
  const loaded = useRef(false);
  const current = useCallback(
    (expected: number) =>
      focused.current &&
      version.current === expected &&
      patientScope.current === patient &&
      useAuthStore.getState().token === token,
    [token, patient],
  );

  const refresh = useCallback(
    async (background = false) => {
      const expected = version.current,
        read = ++reads.current;
      const valid = () => current(expected) && read === reads.current;
      if (!background || !loaded.current) setLoading(true);
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
          v21Api.overview(id, true),
          v21Api.doses(id),
          v21Api.weekly(id),
        ]);
        if (!valid()) return;
        setData(overview);
        setDoses(today.items);
        setWeekly(week.report);
        loaded.current = true;
        setFailed(false);
      } catch {
        if (valid()) setFailed(true);
      } finally {
        if (valid()) setLoading(false);
      }
    },
    [current, patient],
  );

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      version.current++;
      const changed =
        visibleScope.current.token !== token ||
        visibleScope.current.patient !== patient;
      visibleScope.current = { token, patient };
      operation.current = null;
      if (changed) {
        loaded.current = false;
        setPatients([]);
        setData(null);
        setDoses([]);
        setWeekly(null);
      }
      setSelected(null);
      setBusy(false);
      void refresh(true);
      return () => {
        focused.current = false;
        version.current++;
        reads.current++;
        operation.current = null;
      };
    }, [refresh, token, patient]),
  );

  const viewVersion = version.current;
  const mutate = async (work: () => Promise<unknown>, successKey?: string) => {
    const expected = viewVersion;
    if (operation.current || !data || !current(expected)) return false;
    const owner = {};
    operation.current = owner;
    setBusy(true);
    try {
      await work();
      if (!current(expected)) return false;
      setSelected(null);
      if (successKey) useToastStore.getState().show(t(successKey), "success");
      await refresh(true);
      return current(expected);
    } catch (error) {
      if (current(expected)) v21Error(error, t);
      return false;
    } finally {
      if (operation.current === owner) {
        operation.current = null;
        if (current(expected)) setBusy(false);
      }
    }
  };
  const openSchedule = (schedule: MedSchedule) => {
    if (
      !current(viewVersion) ||
      busy ||
      loading ||
      !data?.schedules.some((s) => s.id === schedule.id)
    )
      return;
    setSelected(schedule);
    setMode("menu");
    setTime(schedule.time_local.slice(0, 5));
    setItems(schedule.item_ids);
    setNote(schedule.note || "");
  };
  const canSave =
    current(viewVersion) &&
    !busy &&
    !loading &&
    !!selected &&
    !!items.length &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(time) &&
    validMedicationNote(note) &&
    (time !== selected.time_local.slice(0, 5) ||
      note.trim() !== (selected.note || "") ||
      JSON.stringify([...items].sort()) !==
        JSON.stringify([...selected.item_ids].sort()));
  const visible =
    !!token &&
    current(viewVersion) &&
    visibleScope.current.token === token &&
    visibleScope.current.patient === patient;
  return {
    self,
    patients: visible ? patients : [],
    patientId: visible ? data?.patientId : undefined,
    data: visible ? data : null,
    doses: visible ? doses : [],
    weekly: visible ? weekly : null,
    loading: !visible || loading,
    failed: visible && failed,
    busy,
    selected: visible ? selected : null,
    mode,
    setMode: (value: Parameters<typeof setMode>[0]) => {
      if (current(viewVersion)) setMode(value);
    },
    time,
    setTime: (value: string) => {
      if (current(viewVersion)) setTime(value);
    },
    items,
    note,
    setNote: (value: string) => {
      if (current(viewVersion)) setNote(value);
    },
    canSave,
    refresh,
    removeDraft: (id?: string) => {
      const drafts = data?.drafts || (data?.draft ? [data.draft] : []);
      const draft = id ? drafts.find((d) => d.id === id) : drafts[0];
      if (draft && data)
        return mutate(
          () => v21Api.removeDraft(data.patientId, draft.id, draft.revision),
          "draftDeleted",
        );
    },
    openSchedule,
    selectPatient: (id: number) => {
      if (current(viewVersion) && !busy && id !== data?.patientId) {
        patientScope.current = id;
        setPatient(id);
      }
    },
    closeSchedule: () => {
      if (current(viewVersion) && !operation.current) setSelected(null);
    },
    toggleItem: (id: string) => {
      if (current(viewVersion))
        setItems((old) =>
          old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
        );
    },
    save: () => {
      if (canSave && selected && data && mode === "edit")
        return mutate(
          () =>
            v21Api.saveSchedule(data.patientId, selected.id, {
              time_local: time,
              item_ids: items,
              note: note.trim(),
              meal_anchor: selected.meal_anchor,
              active: selected.active,
            }),
          "saved",
        );
    },
    setScheduleActive: (schedule: MedSchedule, active: boolean) => {
      if (
        busy ||
        loading ||
        !data ||
        schedule.active === active ||
        !data.schedules.some((s) => s.id === schedule.id)
      )
        return;
      return mutate(
        () =>
          v21Api.saveSchedule(data.patientId, schedule.id, {
            time_local: schedule.time_local.slice(0, 5),
            item_ids: schedule.item_ids,
            meal_anchor: schedule.meal_anchor,
            note: schedule.note || "",
            active,
          }),
        active && schedule.consent_state === "PENDING"
          ? "scheduleAwaitingConsent"
          : active
            ? "scheduleResumed"
            : "schedulePaused",
      );
    },
    remove: () => {
      if (selected && data && mode === "remove")
        return mutate(
          () => v21Api.remove(data.patientId, selected.id),
          "saved",
        );
    },
    setProblemsOnly: (value: boolean) => {
      if (data)
        return mutate(
          () => v21Api.preferences(data.patientId, value),
          value ? "preferenceOn" : "preferenceOff",
        );
    },
  };
}

export type MedicationOverviewController = ReturnType<
  typeof useMedicationOverview
>;
