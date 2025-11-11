"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Card from "@/interfaces/ui/components/atoms/Card";
import ChatOverlay from "@/interfaces/ui/components/ChatOverlay";
import { apiFetch, ApiError } from "@/lib/http";


export default function Dashboard() {
  const [chatOpen, setChatOpen] = useState(false);
  const [displayName, setDisplayName] = useState<string>("bạn");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await apiFetch<{
          user_id: string;
          display_name?: string | null;
          email?: string | null;
          phone?: string | null;
        }>("/api/auth/session", { cache: "no-store" });
        if (cancelled) return;
        const nameCandidate =
          session.display_name ||
          session.email?.split("@")[0] ||
          session.phone ||
          "bạn";
        setDisplayName(nameCandidate);
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          return;
        }
        console.warn("Failed to load session", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const goChart = () => router.push("/chart");
  const goRewards = () => router.push("/rewards");
  const quick = (path: string) => router.push(`/log/${path}`);

  // Reminder (ẩn nếu null)
  const reminderText: string | null = null;

  return (
    <div className="min-h-screen pb-24 bg-bg">
      {/* Header */}
      <header className="p-4 bg-white shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Xin chào bạn, {displayName}</p>
            {/* ĐÃ bỏ h1 lặp “Hãy hoàn thành các mục tiêu” */}
          </div>
          <div className="text-xs font-semibold text-primary-700">Điểm thưởng: 3,249</div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Banner kế hoạch hôm nay */}
        <div className="rounded-2xl p-4 bg-primary-50 border border-primary-100">
          <p className="text-2xl font-extrabold text-primary-700">Bạn hãy hoàn thành các mục tiêu nhé!</p>
        </div>

        <TodayMissions />

        {/* Reminder – chỉ hiện khi có nhắc */}
        {reminderText && (
          <div className="rounded-2xl p-3 border bg-white">
            <p className="text-[15.5px]">{reminderText}</p>
          </div>
        )}

        {/* Dữ liệu cá nhân (D4: giữ nguyên, chỉ fix nút không bị xuống dòng) */}
        <Card className="p-4 min-h-32">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Dữ liệu cá nhân</p>
              <p className="text-sm text-muted">Biểu đồ & nhật ký </p>
            </div>
            <button
              onClick={goChart}
              className="h-[var(--h-input-sm)] px-10 rounded-lg border-2 border-primary text-primary bg-white hover:bg-primary-50 transition
                         whitespace-nowrap shrink-0 min-w-[96px]"  // ✅ FIX D4
            >
              Mở bảng
            </button>
          </div>
        </Card>

      
     {/* Khám phá & nhận thưởng (chưa mở, hiển thị thông báo) */}
<Card className="p-4">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="font-semibold">Nhận thưởng</p>
      <p className="text-sm text-muted">Tích điểm – Đổi quà</p>
    </div>
    <button
      onClick={() => {
        const FEATURE_REWARDS_ENABLED = false; // flag bật/tắt
        if (!FEATURE_REWARDS_ENABLED) {
          alert("Tính năng này sẽ mở sau MVP. Vui lòng quay lại sau!");
          return;
        }
        router.push("/rewards");
      }}
      className="h-[var(--h-input-sm)] px-10 rounded-lg border-2 border-primary 
                 text-primary bg-white hover:bg-primary-50 transition 
                 whitespace-nowrap shrink-0 min-w-[96px]"
    >
      Mở bảng
    </button>
  </div>
</Card>

        {/* Nhập liệu nhanh (đã OK) */}
        <section>
          <p className="font-semibold mb-3 text-[16px]">Nhập liệu nhanh</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { key: "bg",      label: "Ghi đường huyết", icon: "/assets/icons/bg.png" },
              { key: "insulin", label: "Tiêm insulin",    icon: "/assets/icons/insulin.png" },
              { key: "water",   label: "Uống nước",       icon: "/assets/icons/water.png" },
              { key: "meal",    label: "Bữa ăn",          icon: "/assets/icons/meal.png" },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => quick(key)}
                className="group rounded-2xl p-4 text-center border border-primary-100 bg-primary-50 hover:bg-primary-100 transition"
                aria-label={label}
              >
                <Image src={icon} alt={label} width={48} height={48} className="mx-auto mb-2 h-12 w-12" />
                <div className="text-[14px] font-semibold text-primary-700 group-hover:text-primary-700">
                  {label}
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Bản tin cộng đồng */}
        <Card className="p-4">
          <p className="font-semibold mb-1">Bản tin cộng đồng</p>
          <p className="text-sm text-muted">Sắp ra mắt…</p>
        </Card>
      </main>

      {/* ✅ Mascot AI cố định góc màn hình – bấm để mở ChatOverlay */}
      <button
        aria-label="Mở trò chuyện DIABOT"
        onClick={() => setChatOpen(true)}
        className="fixed left-3 bottom-20 md:left-5 md:bottom-24 z-50 rounded-full focus:outline-none"
        title="Trò chuyện với DIABOT"
      >
        <img
          src="/assets/asinu.png"
          alt="DIABOT"
          width={180}
          height={180}
          className="select-none pointer-events-none drop-shadow-lg"
        />
      </button>

      <ChatOverlay open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}
