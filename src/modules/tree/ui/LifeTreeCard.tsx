'use client';

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import treeScene from "@config/tree_scene.json";

type TreeStateResponse = {
  success: boolean;
  data: {
    user_id: string;
    level: number;
    total_points: number;
    e_day: number;
    streak: number;
    next_level_points: number;
    daily_target: number;
  };
};

type FetchStatus = "loading" | "ready" | "hidden" | "error";

const LEVEL_COLORS = [
  { level: 1, bg: "from-emerald-100 to-emerald-200", glow: "shadow-emerald-300" },
  { level: 4, bg: "from-green-200 to-green-300", glow: "shadow-green-300" },
  { level: 7, bg: "from-lime-200 to-lime-300", glow: "shadow-lime-300" },
  { level: 10, bg: "from-teal-200 to-cyan-300", glow: "shadow-cyan-300" },
];

function pickLevelColor(level: number) {
  let current = LEVEL_COLORS[0];
  for (const color of LEVEL_COLORS) {
    if (level >= color.level) {
      current = color;
    }
  }
  return current;
}

export default function LifeTreeCard() {
  const [state, setState] = useState<TreeStateResponse["data"] | null>(null);
  const [status, setStatus] = useState<FetchStatus>("loading");
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/tree/state", { cache: "no-store" });
        if (cancelled) return;
        if (res.status === 404) {
          setStatus("hidden");
          return;
        }
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const json: TreeStateResponse = await res.json();
        setState(json.data);
        setStatus("ready");
      } catch (error) {
        console.warn("[life-tree] fetch failed", error);
        if (!cancelled) setStatus("error");
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!state) return;
    setPulse(true);
    const timer = setTimeout(() => setPulse(false), 800);
    return () => clearTimeout(timer);
  }, [state?.e_day]);

  const color = useMemo(() => pickLevelColor(state?.level ?? 1), [state?.level]);

  if (status === "hidden") return null;

  return (
    <div className="rounded-3xl border border-emerald-100 bg-gradient-to-r from-white to-emerald-50 p-5 shadow-lg shadow-emerald-100/40 dark:border-emerald-900/40 dark:from-slate-900 dark:to-emerald-950/30">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "relative h-28 w-28 rounded-full bg-gradient-to-br",
              color.bg,
              pulse ? "animate-pulse" : "",
            )}
          >
            <div
              className={cn(
                "absolute inset-4 rounded-full bg-white/70 blur-lg",
                pulse ? `shadow-[0_0_40px_rgba(16,185,129,0.6)]` : "",
              )}
            />
            <div className="relative flex h-full w-full flex-col items-center justify-center text-emerald-900">
              <span className="text-xs font-semibold tracking-wide uppercase text-emerald-800/70">
                Level
              </span>
              <span className="text-4xl font-black">{state?.level ?? 1}</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase text-emerald-500">Life Tree</p>
            <h3 className="text-2xl font-bold text-emerald-900 dark:text-emerald-200">
              {state ? `Cây năng lượng ngày ${state.level}` : "Đang khởi tạo..."}
            </h3>
            <p className="text-sm text-emerald-700/70 dark:text-emerald-200/70">
              {state
                ? `E_day: ${state.e_day}/${state.daily_target} · Streak: ${state.streak} ngày`
                : "Đang thu thập điểm từ nhiệm vụ và log sức khỏe."}
            </p>
          </div>
        </div>
        <TreeVisualization level={state?.level ?? 1} eDay={state?.e_day ?? 0} dailyTarget={state?.daily_target ?? 60} pulse={pulse} />
        {state && (
          <div className="flex w-full flex-col gap-2 md:max-w-sm">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-emerald-600">
              <span>Tiến độ cấp tiếp theo</span>
              <span>
                {state.total_points}/{state.next_level_points}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-900/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-lime-400 transition-all duration-500"
                style={{
                  width: `${Math.min(
                    100,
                    (state.total_points / state.next_level_points) * 100,
                  ).toFixed(1)}%`,
                }}
              />
            </div>
            <button
              onClick={() => {
                window.location.href = "/missions";
              }}
              className="inline-flex h-10 items-center justify-center rounded-2xl bg-emerald-500 px-4 text-sm font-semibold text-white shadow-emerald-300 transition hover:bg-emerald-600"
            >
              Ghi log ngay để cây lớn hơn
            </button>
          </div>
        )}
      </div>
      {status === "loading" && (
        <p className="mt-4 text-sm text-emerald-700">Đang đồng bộ điểm Life Tree…</p>
      )}
      {status === "error" && (
        <p className="mt-4 text-sm text-red-500">
          Không thể tải Life Tree. Vui lòng thử lại sau.
        </p>
      )}
    </div>
  );
}

type TreeVizProps = {
  level: number;
  eDay: number;
  dailyTarget: number;
  pulse: boolean;
};

function TreeVisualization({ level, eDay, dailyTarget, pulse }: TreeVizProps) {
  const growth = Math.min(1, level / 10);
  const canopyScale = 0.6 + growth * 0.6;
  const trunkHeight = 60 + growth * 40;
  const energyPct = Math.min(1, eDay / Math.max(1, dailyTarget));
  const leafColors = Array.isArray(treeScene?.dominant_colors) ? treeScene.dominant_colors : ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

  return (
    <div className="relative hidden min-h-[150px] flex-1 items-center justify-center md:flex">
      <div className="relative h-36 w-36">
        <div
          className={cn(
            "absolute inset-0 rounded-full blur-2xl opacity-70 transition-all",
            pulse ? "animate-pulse" : "",
          )}
          style={{ background: `radial-gradient(circle, rgba(16,185,129,0.35), transparent)` }}
        />
        <div className="absolute bottom-0 left-1/2 w-6 -translate-x-1/2 rounded-full bg-gradient-to-b from-amber-200 to-amber-700" style={{ height: `${trunkHeight}px` }} />
        <div
          className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center justify-center"
          style={{ transform: `translate(-50%, 0) scale(${canopyScale})` }}
        >
          <CanopyLeaves colors={leafColors} energyPct={energyPct} />
        </div>
        <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-semibold text-emerald-700">
          {Math.round(energyPct * 100)}% năng lượng
        </span>
      </div>
    </div>
  );
}

function CanopyLeaves({ colors, energyPct }: { colors: string[]; energyPct: number }) {
  const leaves = Array.from({ length: 12 }).map((_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const x = Math.cos(angle) * 40;
    const y = Math.sin(angle) * 25;
    const size = 26 + (index % 4) * 4;
    const color = colors[index % colors.length];
    return { x, y, size, color, angle };
  });

  const bloom = 0.8 + energyPct * 0.5;

  return (
    <div className="relative h-32 w-32">
      {leaves.map((leaf, idx) => (
        <div
          key={idx}
          className="absolute rounded-[999px] opacity-90 transition-all duration-500"
          style={{
            width: `${leaf.size}px`,
            height: `${leaf.size * 0.75}px`,
            background: `radial-gradient(circle at 20% 20%, rgba(255,255,255,0.4), ${leaf.color})`,
            transform: `translate(${leaf.x}px, ${leaf.y}px) rotate(${(leaf.angle * 180) / Math.PI}deg) scale(${bloom})`,
            transformOrigin: "center",
            boxShadow: `0 6px 12px ${leaf.color}33`,
          }}
        />
      ))}
      <div className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-300/80 blur-xl" />
    </div>
  );
}
