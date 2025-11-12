// src/modules/chart/ui/LogTimeline.tsx
import React from "react";
import { FetchLogTimeline } from "../application/usecases/FetchLogTimeline";
import { Metric, RangeOption, TimelineGroup } from "../domain/types";
import { track } from "../infrastructure/adapters/Telemetry";
import { Skeleton } from "./components/Skeleton";

export default function LogTimeline({ range, metrics }: { range: RangeOption; metrics?: Metric[] }) {
  const [groups, setGroups] = React.useState<TimelineGroup[]>([]);
  const [cursor, setCursor] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [done, setDone] = React.useState(false);
  React.useEffect(() => {
    setGroups([]);
    setCursor(null);
    setDone(false);
    void loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, JSON.stringify(metrics || [])]);

  async function loadMore(first=false) {
    if (loading || done) return;
    setLoading(true);
    const res = await FetchLogTimeline(range, metrics, first? null : cursor);
    setGroups(prev => mergeGroups(prev, res.groups));
    setCursor(res.nextCursor ?? null);
    setDone(!res.nextCursor);
    setLoading(false);
    track("chart_timeline_load_more", { range, metrics, nextCursor: res.nextCursor });
  }

return (
    <div className="rounded-2xl border p-3 bg-white shadow-sm" style={{ borderColor: "var(--color-border)" }}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-800">Nhật ký hoạt động</h3>
        <span className="text-xs text-gray-400">Hiển thị mọi bản ghi mới nhất</span>
      </div>

      <div className="space-y-6">
        {groups.length === 0 && loading && <Skeleton className="h-24" />}
        {groups.length === 0 && !loading && <Empty />}
        <div className="space-y-6">
          {groups.map(g => (
            <div key={g.date}>
              <div className="text-sm font-medium text-gray-600 mb-2 border-b border-gray-100 pb-1">{g.date}</div>
              <ul className="space-y-3">
                {g.items.map((it, idx) => (
                  <li key={idx} className="rounded-xl border border-gray-200 p-3 flex items-center justify-between bg-gray-50 shadow-xs">
                    <div>
                      <div className="text-sm font-medium text-gray-800">{it.title}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(it.ts).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                        {" · "}{String(it.value)}{it.unit?` ${it.unit}`:""}
                        {it.context?` · ${it.context}`:""}
                      </div>
                      {it.note && <div className="text-xs text-gray-500 mt-1">{it.note}</div>}
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary-100 text-primary-700 font-medium">{it.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {!done && (
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => loadMore(false)}
              className="px-5 py-2 rounded-xl font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
            >
              {loading ? "Đang tải..." : "Tải thêm"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper function to merge new groups with existing ones
function mergeGroups(existingGroups: TimelineGroup[], newGroups: TimelineGroup[]): TimelineGroup[] {
  const merged = [...existingGroups];
  newGroups.forEach(newGroup => {
    const existingGroupIndex = merged.findIndex(g => g.date === newGroup.date);
    if (existingGroupIndex !== -1) {
      // Merge items if group already exists
      merged[existingGroupIndex].items = [...merged[existingGroupIndex].items, ...newGroup.items];
    } else {
      // Add new group
      merged.push(newGroup);
    }
  });
  // Sort by date descending
  return merged.sort((a, b) => b.date.localeCompare(a.date));
}

// Component to display when there's no data
function Empty() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center text-gray-500">
      <p className="text-4xl mb-2">📝</p>
      <p className="text-sm">Chưa có hoạt động nào được ghi lại.</p>
      <p className="text-xs mt-1">Hãy bắt đầu ghi nhật ký để xem lịch sử của bạn.</p>
    </div>
  );
}
