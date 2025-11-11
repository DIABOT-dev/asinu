// src/modules/insulin/ui/InsulinForm.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { SaveInsulinLog } from "@/modules/insulin/application/usecases/SaveInsulinLog";
import { InsulinRepoApi } from "@/modules/insulin/infrastructure/adapters/InsulinRepo.api";
import type { SaveInsulinLogDTO } from "../domain/types";

function nowLocalISO(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function InsulinForm() {
  const router = useRouter();
  const [dose, setDose] = React.useState<string>("");
  const [type, setType] = React.useState<"am" | "pm">("am");
  const [context, setContext] = React.useState<"before" | "after2h" | "random">("before");
  const [takenAt, setTakenAt] = React.useState<string>(nowLocalISO());
  const [submitting, setSubmitting] = React.useState(false);
  const [toast, setToast] = React.useState<{message: string; type: 'success'|'error'} | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const dto: SaveInsulinLogDTO = {
      dose: Number(dose),
      type,
      context,
      taken_at: new Date(takenAt).toISOString(),
    };

    const d = Number(dose);
    if (d < 0.5 || d > 100) {
      setToast({message: 'Liều insulin phải từ 0.5 đến 100 U', type: 'error'});
      setSubmitting(false);
      return;
    }

    const uc = new SaveInsulinLog(new InsulinRepoApi());
    const res = await uc.execute(dto);
    setSubmitting(false);

    if (res.ok && res.status === 201) {
      setToast({message: 'Đã ghi liều insulin!', type: 'success'});
      setTimeout(() => router.back(), 1000);
    } else {
      setToast({message: 'Có lỗi. Vui lòng thử lại.', type: 'error'});
    }
  }

  return (
    <div
      className="min-h-[100svh] flex flex-col"
      style={{ background: "var(--surface-bg,#f7f8f9)" }}
    >
      {/* Header (Back + title) */}
      <header
        className="sticky top-0 z-10 flex items-center gap-3 px-4 py-3"
        style={{ background: "var(--surface-bg,#f7f8f9)", borderBottom: "1px solid var(--border,#ececec)" }}
      >
        <button
          onClick={() => router.back()}
          className="inline-flex h-10 w-10 items-center justify-center rounded-2xl"
          aria-label="Quay lại"
          style={{
            background: "var(--surface-card,#fff)",
            boxShadow: "var(--shadow-card,0 1px 2px rgba(16,24,40,.06))",
            border: "1px solid var(--border,#e5e7eb)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 className="text-[1.125rem] font-bold" style={{ color: "var(--text-primary,#0f172a)" }}>
          Ghi liều insulin
        </h1>
      </header>

      {/* Body */}
      <div className="grow flex">
        <div className="w-full max-w-[640px] mx-auto px-4 pt-8 pb-24 md:pt-16">
          <form
            onSubmit={handleSubmit}
            aria-label="Log Insulin Form"
            className="rounded-2xl p-4 md:p-6"
            style={{
              background: "var(--surface-card,#fff)",
              boxShadow: "var(--shadow-card,0 6px 24px rgba(16,24,40,.06))",
              border: "1px solid var(--border,#e5e7eb)",
            }}
          >
            {/* Dose */}
            <div className="mb-4">
              <label htmlFor="dose" className="block mb-2 font-semibold" style={{ color: "var(--color-primary-700,#0e7490)" }}>
                Liều (U)
              </label>
              <input
                id="dose"
                inputMode="numeric"
                type="number"
                min={0}
                step="0.5"
                required
                value={dose}
                onChange={(e) => setDose(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl outline-none"
                style={{
                  background: "var(--surface-input,#fff)",
                  border: "1.5px solid var(--border,#e5e7eb)",
                  boxShadow: "inset 0 1px 0 rgba(16,24,40,.02)",
                }}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid var(--color-primary-600,#0ea5a4)")}
                onBlur={(e) => (e.currentTarget.style.border = "1.5px solid var(--border,#e5e7eb)")}
              />
            </div>

            {/* Type AM/PM */}
            <div className="mb-4">
              <p className="mb-2 font-semibold" style={{ color: "var(--color-primary-700,#0e7490)" }}>Thời điểm</p>
              <div className="grid grid-cols-2 gap-3">
                {(["am", "pm"] as const).map((val) => {
                  const active = type === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setType(val)}
                      className="h-12 rounded-2xl font-semibold"
                      style={{
                        background: active ? "var(--color-primary-600,#0ea5a4)" : "var(--surface-input,#fff)",
                        color: active ? "#fff" : "var(--text-primary,#0f172a)",
                        border: active ? "1.5px solid var(--color-primary-700,#0e7490)" : "1.5px solid var(--border,#e5e7eb)",
                      }}
                      aria-pressed={active}
                    >
                      {val.toUpperCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Context */}
            <div className="mb-4">
              <label className="block mb-2 font-semibold" style={{ color: "var(--color-primary-700,#0e7490)" }}>
                Ngữ cảnh
              </label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { val: "before", label: "Trước ăn" },
                  { val: "after2h", label: "Sau ăn 2h" },
                  { val: "random", label: "Ngẫu nhiên" },
                ] as const).map((opt) => {
                  const active = context === opt.val;
                  return (
                    <button
                      key={opt.val}
                      type="button"
                      onClick={() => setContext(opt.val)}
                      className="h-12 rounded-2xl text-sm font-medium px-3"
                      style={{
                        background: active ? "var(--color-primary-600,#0ea5a4)" : "var(--surface-input,#fff)",
                        color: active ? "#fff" : "var(--text-primary,#0f172a)",
                        border: active ? "1.5px solid var(--color-primary-700,#0e7490)" : "1.5px solid var(--border,#e5e7eb)",
                      }}
                      aria-pressed={active}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time */}
            <div className="mb-6">
              <label htmlFor="taken_at" className="block mb-2 font-semibold" style={{ color: "var(--color-primary-700,#0e7490)" }}>
                Thời điểm
              </label>
              <input
                id="taken_at"
                type="datetime-local"
                value={takenAt}
                onChange={(e) => setTakenAt(e.target.value)}
                className="w-full h-12 px-4 rounded-2xl outline-none"
                style={{
                  background: "var(--surface-input,#fff)",
                  border: "1.5px solid var(--border,#e5e7eb)",
                  boxShadow: "inset 0 1px 0 rgba(16,24,40,.02)",
                }}
                max={nowLocalISO()}
                onFocus={(e) => (e.currentTarget.style.border = "1.5px solid var(--color-primary-600,#0ea5a4)")}
                onBlur={(e) => (e.currentTarget.style.border = "1.5px solid var(--border,#e5e7eb)")}
              />
            </div>

            {/* Submit — bám sát form */}
            <div className="mt-6">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-14 rounded-2xl font-extrabold tracking-wide text-white"
                style={{
                  background: "var(--color-primary-700,#0e7490)",
                  boxShadow: "0 6px 16px rgba(14,116,144,.25)",
                  opacity: submitting ? 0.75 : 1,
                }}
                aria-busy={submitting}
              >
                {submitting ? "Đang lưu…" : "Ghi lại"}
              </button>
            </div>
          </form>
        </div>
      </div>
      {toast && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-3 rounded-lg shadow-lg ${
          toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white z-50`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
