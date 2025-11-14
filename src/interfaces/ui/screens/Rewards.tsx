"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/interfaces/ui/components/atoms/Card";
import { apiFetch, ApiError } from "@/lib/http";
import type {
  LadderStep,
  RewardCatalogPayload,
  RewardCatalogItem,
  RewardRedemption,
} from "@/modules/rewards/types";

type HistoryResponse = { items: RewardRedemption[] };
type LadderResponse = { ladder: LadderStep[] };

export default function Rewards() {
  const [catalog, setCatalog] = useState<RewardCatalogPayload | null>(null);
  const [history, setHistory] = useState<RewardRedemption[]>([]);
  const [ladder, setLadder] = useState<LadderStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [donating, setDonating] = useState<string | null>(null);
  const rewardsEnabled = typeof process.env.NEXT_PUBLIC_REWARDS === "string"
    ? /^(1|true|yes|on)$/i.test(process.env.NEXT_PUBLIC_REWARDS)
    : false;
  const donationEnabled = typeof process.env.NEXT_PUBLIC_DONATION === "string"
    ? /^(1|true|yes|on)$/i.test(process.env.NEXT_PUBLIC_DONATION)
    : false;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [catalogRes, historyRes, ladderRes] = await Promise.all([
        apiFetch<RewardCatalogPayload>("/api/rewards/catalog", { cache: "no-store" }),
        apiFetch<HistoryResponse>("/api/rewards/redemptions", { cache: "no-store" }),
        apiFetch<LadderResponse>("/api/rewards/ladders", { cache: "no-store" }),
      ]);
      setCatalog(catalogRes);
      setHistory(historyRes.items);
      setLadder(ladderRes.ladder);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError("Tính năng Rewards đang tạm thời khóa.");
      } else {
        setError("Không thể tải dữ liệu phần thưởng.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!rewardsEnabled) {
      setLoading(false);
      return;
    }
    load();
  }, [load, rewardsEnabled]);

  const handleRedeem = async (item: RewardCatalogItem) => {
    if (!item.can_redeem || redeeming) return;
    setRedeeming(item.id);
    try {
      await apiFetch("/api/rewards/redeem", {
        method: "POST",
        body: JSON.stringify({ item_id: item.id }),
      });
      await load();
      alert(`Đổi quà thành công: ${item.title}`);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Đổi quà thất bại. Vui lòng thử lại.");
      }
    } finally {
      setRedeeming(null);
    }
  };

  const donatePoints = async (amount: number) => {
    if (!donationEnabled) return;
    setDonating(`points-${amount}`);
    try {
      await apiFetch("/api/donate", {
        method: "POST",
        body: JSON.stringify({
          provider: "vnpay",
          amount_points: amount,
          campaign: "sponsored-mission",
        }),
      });
      await load();
      alert(`Đã chuyển ${amount} điểm tới quỹ cộng đồng. Cảm ơn bạn!`);
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Không thể ghi nhận quyên góp bằng điểm.");
      }
    } finally {
      setDonating(null);
    }
  };

  const donateMoney = async (amount: number) => {
    if (!donationEnabled) return;
    setDonating(`cash-${amount}`);
    try {
      const donation = await apiFetch<{
        payment_url?: string;
      }>("/api/donate", {
        method: "POST",
        body: JSON.stringify({
          provider: "vnpay",
          amount_vnd: amount,
          campaign: "sponsored-mission",
        }),
      });
      if (donation.payment_url) {
        window.open(donation.payment_url, "_blank", "noopener,noreferrer");
      }
      await load();
      alert("Cảm ơn bạn đã ủng hộ!");
    } catch (err) {
      if (err instanceof ApiError) {
        alert(err.message);
      } else {
        alert("Không thể tạo liên kết quyên góp.");
      }
    } finally {
      setDonating(null);
    }
  };

  const supporterBadge = useMemo(() => {
    if (!catalog?.supporter_badge) return null;
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 text-primary-800 px-3 py-1 text-xs font-semibold">
        <span>🌱</span> Người ủng hộ
      </span>
    );
  }, [catalog?.supporter_badge]);

  if (!rewardsEnabled) {
    return (
      <div className="px-4 py-12">
        <Card className="p-6 text-center">
          <p className="font-semibold text-lg">Rewards đang tắt</p>
          <p className="text-muted text-sm mt-2">
            Quà tặng sẽ mở ngay khi đội ngũ hoàn tất QA.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-4 py-12">
        <Card className="p-6 text-center">
          <p className="text-sm text-muted">Đang tải dữ liệu phần thưởng…</p>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-12">
        <Card className="p-6 text-center">
          <p className="text-sm text-muted">{error}</p>
        </Card>
      </div>
    );
  }

  if (!catalog) {
    return null;
  }

  return (
    <div className="px-4 pb-32 space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted">Điểm khả dụng</p>
            <p className="text-3xl font-semibold text-primary-700">{catalog.balance}</p>
          </div>
          {supporterBadge}
        </div>
        {ladder.length > 0 && (
          <div className="rounded-xl2 border border-primary-100 p-3 bg-primary-50/40">
            <p className="text-sm font-semibold text-primary-700 mb-2">Lộ trình đổi quà</p>
            <ul className="space-y-1 text-sm text-primary-800">
              {ladder.map((step) => (
                <li key={step.threshold} className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary-500">{step.threshold}đ</span>
                  <span>{step.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      <section>
        <p className="font-semibold mb-2">Đổi quà</p>
        <div className="space-y-3">
          {catalog.items.map((item) => (
            <Card key={item.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{item.title}</p>
                <p className="text-sm text-muted">{item.subtitle || "Ưu đãi độc quyền"}</p>
                <p className="text-xs text-primary-600 mt-1">{item.cost} điểm</p>
              </div>
              <button
                disabled={!item.can_redeem || redeeming === item.id}
                onClick={() => handleRedeem(item)}
                className="btn min-w-[96px] disabled:opacity-50"
              >
                {redeeming === item.id ? "Đang đổi…" : "Đổi quà"}
              </button>
            </Card>
          ))}
        </div>
      </section>

      {donationEnabled && (
        <section>
          <p className="font-semibold mb-2">Ủng hộ cộng đồng</p>
          <Card className="p-4 space-y-3">
            <p className="text-sm text-muted">Tích điểm để gửi tặng bệnh nhân cần hỗ trợ.</p>
            <div className="flex flex-wrap gap-2">
              {[30, 60, 120].map((amount) => (
                <button
                  key={amount}
                  onClick={() => donatePoints(amount)}
                  disabled={donating === `points-${amount}`}
                  className="px-4 py-2 rounded-xl border border-primary text-primary hover:bg-primary-50 disabled:opacity-50"
                >
                  {donating === `points-${amount}` ? "Đang gửi..." : `Tặng ${amount} điểm`}
                </button>
              ))}
              <button
                onClick={() => donateMoney(100000)}
                disabled={donating === "cash-100000"}
                className="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {donating === "cash-100000" ? "Đang mở..." : "Chuyển 100.000đ qua VNPay"}
              </button>
            </div>
          </Card>
        </section>
      )}

      <section>
        <p className="font-semibold mb-2">Lịch sử đổi quà</p>
        <Card className="p-4 space-y-2">
          {history.length === 0 && (
            <p className="text-sm text-muted">Chưa có giao dịch nào.</p>
          )}
          {history.map((entry) => (
            <div key={entry.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-2 last:border-none">
              <div>
                <p className="font-semibold">{entry.title}</p>
                <p className="text-xs text-muted">
                  {new Date(entry.created_at).toLocaleDateString("vi-VN")} • {entry.cost} điểm
                </p>
              </div>
              <span className="text-xs font-semibold text-primary-600 uppercase">{entry.status}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
