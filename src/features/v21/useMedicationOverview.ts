import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../auth/auth.store";
import { useToastStore } from "../../stores/toast.store";
import { v21Error } from "./V21Layout";
import { validMedicationNote } from "./medication-input";
import { medicationDoseNeedsRefresh } from "./medication-dose-display";
import {
  v21Api,
  type MedDose,
  type MedOverview,
  type MedSchedule,
  type Patient,
} from "./v21.api";
const medicationCalendar = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Ho_Chi_Minh",
});

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
  const [todayLoading, setTodayLoading] = useState(false);
  const [now, setNow] = useState(Date.now());
  const serverOffset = useRef(0);
  const lastDay = useRef("");
  const latestDoses = useRef<MedDose[]>([]);
  const doseReads = useRef(0);
  const liveRead = useRef<object | null>(null);
  const activePatient = useRef<number | null>(null);
  const remindersActive = useRef(false);
  const acceptToday = useCallback(
    (value: { items: MedDose[]; serverTime?: string }) => {
      const serverNow = Date.parse(value.serverTime || "");
      serverOffset.current = Number.isFinite(serverNow)
        ? serverNow - Date.now()
        : 0;
      const instant = Date.now() + serverOffset.current;
      setNow(instant);
      lastDay.current = medicationCalendar.format(new Date(instant));
      latestDoses.current = value.items;
      setDoses(value.items);
      setTodayLoading(false);
    },
    [],
  );
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
          latestDoses.current = [];
          activePatient.current = null;
          setFailed(false);
          return;
        }
        activePatient.current = id;
        setTodayLoading(true);
        const overview = v21Api.overview(id, true).then((value) => {
          if (!valid()) return;
          setData(value);
          remindersActive.current = value.remindersEnabled !== false;
          loaded.current = true;
          setLoading(false);
        });
        const doseRead = ++doseReads.current;
        const today = v21Api.doses(id).then(
          (value) => {
            if (!valid() || doseRead !== doseReads.current) return;
            acceptToday(value);
            setTodayLoading(false);
          },
          (error) => {
            if (valid() && doseRead === doseReads.current) {
              setDoses([]);
              latestDoses.current = [];
              setTodayLoading(false);
            }
            throw error;
          },
        );
        // Optional statistics must never hold back saved schedules or today's doses.
        void v21Api.weekly(id).then(
          (value) => {
            if (valid()) setWeekly(value.report);
          },
          () => {
            if (valid()) setWeekly(null);
          },
        );
        const core = await Promise.allSettled([overview, today]);
        if (!valid()) return;
        setFailed(core.some((result) => result.status === "rejected"));
      } catch {
        if (valid()) {
          setFailed(true);
          setTodayLoading(false);
        }
      } finally {
        if (valid()) setLoading(false);
      }
    },
    [current, patient, acceptToday],
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
      liveRead.current = null;
      if (changed) {
        loaded.current = false;
        setPatients([]);
        setData(null);
        setDoses([]);
        latestDoses.current = [];
        activePatient.current = null;
        remindersActive.current = false;
        setWeekly(null);
        setTodayLoading(false);
      }
      setSelected(null);
      setBusy(false);
      lastDay.current = medicationCalendar.format(
        new Date(Date.now() + serverOffset.current),
      );
      const expected = version.current;
      const timer = setInterval(() => {
        if (!current(expected)) return;
        const instant = Date.now() + serverOffset.current;
        setNow(instant);
        const nextDay = medicationCalendar.format(new Date(instant));
        if (nextDay !== lastDay.current) {
          lastDay.current = nextDay;
          void refresh(true);
          return;
        }
        const nearDose = latestDoses.current.some((dose) =>
          medicationDoseNeedsRefresh(dose, instant),
        );
        if (
          nearDose &&
          remindersActive.current &&
          activePatient.current &&
          !liveRead.current &&
          !operation.current
        ) {
          const owner = {},
            read = ++doseReads.current;
          liveRead.current = owner;
          void v21Api
            .doses(activePatient.current)
            .then((value) => {
              if (current(expected) && read === doseReads.current)
                acceptToday(value);
            })
            .catch(() => {})
            .finally(() => {
              if (liveRead.current === owner) liveRead.current = null;
            });
        }
      }, 15_000);
      void refresh(true);
      return () => {
        clearInterval(timer);
        focused.current = false;
        version.current++;
        reads.current++;
        doseReads.current++;
        operation.current = null;
      };
    }, [refresh, token, patient, current, acceptToday]),
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
    todayLoading: visible && todayLoading,
    now,
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
