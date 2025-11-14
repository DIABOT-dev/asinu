'use client';

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Relative = {
  id: string;
  relation: string;
  role: string;
  created_at: string;
  relative_user_id: string;
  profile: {
    user_id: string;
    display_name: string | null;
    email: string | null;
    phone: string | null;
  };
};

type Status = "loading" | "ready" | "hidden" | "error";

const RELATIONS = [
  { value: "mother", label: "Mẹ" },
  { value: "father", label: "Bố" },
  { value: "wife", label: "Vợ" },
  { value: "husband", label: "Chồng" },
  { value: "daughter", label: "Con gái" },
  { value: "son", label: "Con trai" },
  { value: "sibling", label: "Anh/Chị/Em" },
  { value: "other", label: "Khác" },
] as const;

const ROLES = [
  { value: "viewer", label: "Chỉ xem" },
  { value: "editor", label: "Xem + ghi hộ" },
] as const;

export default function RelativesPanel() {
  const [status, setStatus] = useState<Status>("loading");
  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [form, setForm] = useState({ relative_id: "", relation: "other", role: "viewer" });
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRelatives = async () => {
    try {
      const res = await fetch("/api/relative/list", { cache: "no-store" });
      if (res.status === 404) {
        setStatus("hidden");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const json = await res.json();
      setRelatives(json.data ?? []);
      setStatus("ready");
    } catch (error) {
      console.warn("[family] load failed", error);
      setStatus("error");
    }
  };

  useEffect(() => {
    loadRelatives();
  }, []);

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relative/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Không thêm được người thân");
      }
      const json = await res.json();
      setRelatives(json.data ?? []);
      setForm({ relative_id: "", relation: "other", role: "viewer" });
      setMessage("Đã thêm người thân.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể thêm người thân");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (relativeId: string) => {
    if (!confirm("Bạn chắc chắn muốn hủy liên kết?")) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/relative/remove", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relative_id: relativeId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.error ?? "Không thể hủy liên kết");
      }
      const json = await res.json();
      setRelatives(json.data ?? []);
      setMessage("Đã hủy liên kết.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Không thể hủy liên kết");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "hidden") return null;

  return (
    <div className="rounded-2xl border p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold mb-2">Người thân & quyền truy cập</h3>
        {status === "loading" && <span className="text-xs text-gray-500 animate-pulse">Đang tải...</span>}
      </div>

      {status === "error" && (
        <p className="text-sm text-red-500">Không thể tải danh sách người thân. Vui lòng thử lại sau.</p>
      )}

      {status === "ready" && relatives.length === 0 && (
        <p className="text-sm text-gray-500">Chưa có người thân nào được thêm.</p>
      )}

      {status === "ready" && relatives.length > 0 && (
        <ul className="space-y-3">
          {relatives.map((relative) => (
            <li
              key={relative.id}
              className="flex flex-col gap-1 rounded-xl border border-gray-200 p-3 bg-gray-50"
            >
              <div className="flex justify-between text-sm font-semibold">
                <span>{relative.profile.display_name ?? relative.profile.email ?? relative.profile.phone ?? relative.profile.user_id}</span>
                <span className="text-xs uppercase text-gray-500">{relative.role}</span>
              </div>
              <div className="text-xs text-gray-500 flex flex-wrap gap-3">
                <span>Quan hệ: {relative.relation}</span>
                {relative.profile.email && <span>{relative.profile.email}</span>}
                {relative.profile.phone && <span>{relative.profile.phone}</span>}
              </div>
              <button
                onClick={() => handleRemove(relative.relative_user_id)}
                className="self-start text-xs text-red-500 hover:text-red-700"
                disabled={submitting}
              >
                Hủy liên kết
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleAdd} className="mt-4 grid gap-3">
        <div className="grid gap-1">
          <label className="text-xs font-semibold uppercase text-gray-500">Mã người thân / Email</label>
          <input
            type="text"
            required
            value={form.relative_id}
            onChange={(event) => setForm((prev) => ({ ...prev, relative_id: event.target.value }))}
            placeholder="Nhập ID hoặc email tài khoản"
            className="h-10 rounded-xl border px-3 text-sm"
            disabled={submitting}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            className="h-10 rounded-xl border px-3 text-sm"
            value={form.relation}
            onChange={(event) => setForm((prev) => ({ ...prev, relation: event.target.value }))}
            disabled={submitting}
          >
            {RELATIONS.map((relation) => (
              <option key={relation.value} value={relation.value}>
                {relation.label}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border px-3 text-sm"
            value={form.role}
            onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}
            disabled={submitting}
          >
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className={cn(
            "h-10 rounded-xl bg-gray-900 text-white text-sm font-semibold",
            submitting && "opacity-60",
          )}
          disabled={submitting}
        >
          Thêm người thân
        </button>
      </form>

      {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
    </div>
  );
}
