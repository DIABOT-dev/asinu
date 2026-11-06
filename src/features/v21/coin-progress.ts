import type { CoinToday } from "./v21.api";

const TASK_ORDER = [
  "CHECKIN",
  "MED_ANSWER",
  "VITAL",
  "GIFT_OPEN",
  "WEEKLY",
] as const;
const WEEKLY_CHECKIN_TARGET = 5;
const count = (value: number) =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

export function getCoinJourney(data: CoinToday) {
  const tasks = TASK_ORDER.flatMap((code) => {
    const task = data.tasks.find((item) => item.task_code === code);
    if (!task) return [];
    const weekly = code === "WEEKLY";
    const target = weekly ? WEEKLY_CHECKIN_TARGET : count(task.daily_limit);
    if (!target || (weekly && !count(task.weekly_limit))) return [];
    // WEEKLY.done counts bonus awards, while weeklyDays counts distinct check-in days.
    const done = Math.min(
      target,
      weekly ? count(data.weeklyDays) : count(task.done),
    );
    return [
      {
        code,
        done,
        target,
        weekly,
        complete: done === target,
        percent: Math.round((done / target) * 100),
      },
    ];
  });
  const completed = tasks.filter((task) => task.complete).length;
  return {
    tasks,
    completed,
    percent: tasks.length ? Math.round((completed / tasks.length) * 100) : 0,
  };
}
