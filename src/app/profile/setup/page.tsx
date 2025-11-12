"use client";

import { useMemo, useState } from "react";

/** ---------- Types ---------- */
type Gender = "male" | "female" | "other";
type Goal = "glycemic_control" | "fat_loss" | "endurance";

type DiabetesClass = "prediabetes" | "type1" | "type2" | "other";
type HbA1cBand = "lte7" | "gt7" | "unknown";
type Therapy = "insulin" | "oral" | "lifestyle";
type InsulinFreq = "pump" | "1" | "2to3" | "4";
type Stage = "stable" | "titrate";

/** ---------- Page ---------- */
export default function ProfileSetupPage() {
  /* Wizard */
  const [step, setStep] = useState<1 | 2 | 3>(1);

  /* Step 1 – Basic */
  const [dob, setDob] = useState<string>("");
  const [gender, setGender] = useState<Gender>("male");
  const [height, setHeight] = useState<number>(170);
  const [weight, setWeight] = useState<number>(65);
  const [conditions, setConditions] = useState<string[]>([]);
  const [conditionOther, setConditionOther] = useState<string>("");
  const hasOther = conditions.includes("other");

  /* Step 2 – Diabetes */
  const [dClass, setDClass] = useState<DiabetesClass>("prediabetes");
  const [hba1cBand, setHba1cBand] = useState<HbA1cBand>("unknown");
  const [therapy, setTherapy] = useState<Therapy>("lifestyle");
  const [insulinFreq, setInsulinFreq] = useState<InsulinFreq | null>(null);
  const [stage, setStage] = useState<Stage>("stable");

  /* Step 3 – Goal */
  const [goal, setGoal] = useState<Goal>("glycemic_control");

  /* Validations */
  const canNextStep1 = useMemo(() => {
    if (!dob) return false;
    if (hasOther && !conditionOther.trim()) return false;
    return true;
  }, [dob, hasOther, conditionOther]);

  const canNextStep2 = useMemo(() => {
    if (!dClass || !therapy || !hba1cBand || !stage) return false;
    if (therapy === "insulin" && !insulinFreq) return false;
    return true;
  }, [dClass, therapy, hba1cBand, stage, insulinFreq]);

  /* Helpers */
  const toggleCondition = (key: string) =>
    setConditions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );

  const onSubmit = async () => {
    // Chuẩn payload -> map sang bảng profiles + bảng phụ trong Postgres
    const payload = {
      dob,
      gender,
      height_cm: height,
      weight_kg: weight,
      conditions,
      condition_other: hasOther ? conditionOther.trim() : null,
      diabetes: {
        classification: dClass, // "prediabetes" | "type1" | "type2" | "other"
        hba1c_band: hba1cBand, // "lte7" | "gt7" | "unknown"
        therapy,               // "insulin" | "oral" | "lifestyle"
        insulin_freq: therapy === "insulin" ? insulinFreq : null, // null nếu không insulin
        stage,                 // "stable" | "titrate"
      },
      goal,
    };

    console.log("submit payload", payload);
    // TODO: nối API thật:
    // await fetch("/api/profile/setup", {method:"POST", headers:{ "Content-Type":"application/json" }, body: JSON.stringify(payload)});
    // Sau khi success: router.push("/dashboard")
  };

  return (
    <div className="mx-auto max-w-md px-4 pb-28">
      <header className="pt-6 text-center">
        <h1 className="text-2xl font-bold">Thiết lập hồ sơ</h1>
        <p className="text-sm text-muted-foreground">
          Bước {step}/3: {step === 1 ? "Hoàn thiện thông tin" : step === 2 ? "Thông tin tiểu đường" : "Mục tiêu sức khỏe"}
        </p>
      </header>

      {/* --------- STEP 1 --------- */}
      {step === 1 && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Thông tin cá nhân</h2>

          <Label>Ngày sinh</Label>
          <input
            type="date"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            className="mb-4 w-full rounded-xl border px-3 py-3"
            placeholder="dd/mm/yyyy"
          />

          <Label>Giới tính</Label>
          <div className="mb-4 flex gap-4">
            <Radio name="gender" checked={gender === "male"} onChange={() => setGender("male")} label="Nam" />
            <Radio name="gender" checked={gender === "female"} onChange={() => setGender("female")} label="Nữ" />
            <Radio name="gender" checked={gender === "other"} onChange={() => setGender("other")} label="Khác" />
          </div>

          <Label>Chiều cao: {height} cm</Label>
          <input type="range" min={140} max={200} value={height} onChange={(e) => setHeight(+e.target.value)} className="mb-4 w-full" />

          <Label>Cân nặng: {weight} kg</Label>
          <input type="range" min={40} max={120} value={weight} onChange={(e) => setWeight(+e.target.value)} className="mb-4 w-full" />

          <Label>Bệnh nền (nếu có)</Label>
          <div className="grid grid-cols-2 gap-2">
            <Checkbox checked={conditions.includes("gout")} onChange={() => toggleCondition("gout")} label="Gout" />
            <Checkbox checked={conditions.includes("lipid")} onChange={() => toggleCondition("lipid")} label="Mỡ máu" />
            <Checkbox checked={conditions.includes("dm")} onChange={() => toggleCondition("dm")} label="Tiểu đường" />
            <Checkbox checked={conditions.includes("bp")} onChange={() => toggleCondition("bp")} label="Huyết áp" />
            <Checkbox checked={conditions.includes("other")} onChange={() => toggleCondition("other")} label="Khác" />
          </div>

          {hasOther && (
            <div className="mt-3">
              <input
                value={conditionOther}
                onChange={(e) => setConditionOther(e.target.value)}
                className="w-full rounded-xl border px-3 py-3"
                placeholder="Nhập bệnh nền khác (bắt buộc khi chọn Khác)"
              />
            </div>
          )}
        </section>
      )}

      {/* --------- STEP 2 --------- */}
      {step === 2 && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Thông tin tiểu đường</h2>

          <SubTitle>Phân loại</SubTitle>
          <div className="mb-3 space-y-2">
            <RadioCard active={dClass === "prediabetes"} onClick={() => setDClass("prediabetes")} title="Tiền tiểu đường" />
            <RadioCard active={dClass === "type1"} onClick={() => setDClass("type1")} title="Tiểu đường tuýp 1" />
            <RadioCard active={dClass === "type2"} onClick={() => setDClass("type2")} title="Tiểu đường tuýp 2" />
            <RadioCard active={dClass === "other"} onClick={() => setDClass("other")} title="Khác" />
          </div>

          <SubTitle>Chỉ số HbA1c gần nhất</SubTitle>
          <div className="mb-3 space-y-2">
            <RadioCard active={hba1cBand === "lte7"} onClick={() => setHba1cBand("lte7")} title="≤ 7.0%" />
            <RadioCard active={hba1cBand === "gt7"} onClick={() => setHba1cBand("gt7")} title="> 7.0%" />
            <RadioCard active={hba1cBand === "unknown"} onClick={() => setHba1cBand("unknown")} title="Không có thông tin" />
          </div>

          <SubTitle>Đang điều trị bằng</SubTitle>
          <div className="mb-3 space-y-2">
            <RadioCard active={therapy === "insulin"} onClick={() => { setTherapy("insulin"); }} title="Insulin" />
            <RadioCard active={therapy === "oral"} onClick={() => { setTherapy("oral"); setInsulinFreq(null); }} title="Thuốc viên" />
            <RadioCard active={therapy === "lifestyle"} onClick={() => { setTherapy("lifestyle"); setInsulinFreq(null); }} title="Chế độ ăn & luyện tập" />
          </div>

          {therapy === "insulin" && (
            <>
              <SubTitle>Số lần tiêm insulin/ngày</SubTitle>
              <div className="mb-3 space-y-2">
                <RadioCard active={insulinFreq === "pump"} onClick={() => setInsulinFreq("pump")} title="Máy bơm tiêm liên tục" />
                <RadioCard active={insulinFreq === "1"} onClick={() => setInsulinFreq("1")} title="1 lần/ngày" />
                <RadioCard active={insulinFreq === "2to3"} onClick={() => setInsulinFreq("2to3")} title="2–3 lần/ngày" />
                <RadioCard active={insulinFreq === "4"} onClick={() => setInsulinFreq("4")} title="4 lần/ngày" />
              </div>
            </>
          )}

          <SubTitle>Đang trong giai đoạn</SubTitle>
          <div className="space-y-2">
            <RadioCard active={stage === "stable"} onClick={() => setStage("stable")} title="Ổn định" />
            <RadioCard active={stage === "titrate"} onClick={() => setStage("titrate")} title="Điều chỉnh liều thuốc" />
          </div>
        </section>
      )}

      {/* --------- STEP 3 --------- */}
      {step === 3 && (
        <section className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 font-semibold">Mục tiêu sức khỏe</h2>
          <p className="mb-2 text-sm text-muted-foreground">Chọn mục tiêu chính để DIABOT cá nhân hóa gợi ý:</p>
          <GoalCard
            active={goal === "glycemic_control"}
            onClick={() => setGoal("glycemic_control")}
            title="Ổn định đường huyết / giảm HbA1c"
            caption="Ưu tiên bữa ăn thấp GI, kiểm soát khẩu phần, nhắc log đường huyết đều."
          />
          <GoalCard
            active={goal === "fat_loss"}
            onClick={() => setGoal("fat_loss")}
            title="Giảm mỡ, giữ cơ / kiểm soát cân nặng"
            caption="Giảm năng lượng nạp vào, tăng đạm, theo dõi cân nặng & vòng eo."
          />
          <GoalCard
            active={goal === "endurance"}
            onClick={() => setGoal("endurance")}
            title="Tăng sức bền & thói quen vận động"
            caption="Kế hoạch vận động nhẹ hàng ngày, đủ nước, ngủ đúng giờ."
          />
        </section>
      )}

      {/* --------- FOOTER STICKY --------- */}
      <footer className="fixed inset-x-0 bottom-0 z-10 border-t bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          {step > 1 ? (
            <button
              onClick={() => setStep((s) => (s === 2 ? 1 : 2))}
              className="w-1/3 rounded-xl border px-4 py-3"
            >
              Quay lại
            </button>
          ) : (
            <div className="w-1/3" />
          )}

          {step < 3 ? (
            <button
              onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
              disabled={(step === 1 && !canNextStep1) || (step === 2 && !canNextStep2)}
              className="w-2/3 rounded-xl bg-primary px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              Tiếp theo
            </button>
          ) : (
            <button onClick={onSubmit} className="w-2/3 rounded-xl bg-primary px-4 py-3 font-medium text-white">
              Hoàn tất
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/** ---------- Small UI helpers ---------- */
function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 mt-2 block text-sm">{children}</label>;
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 mt-4 text-sm font-semibold">{children}</div>;
}
function Radio({
  name,
  checked,
  onChange,
  label,
}: {
  name: string;
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-primary" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input type="checkbox" checked={checked} onChange={onChange} className="h-4 w-4 accent-primary" />
      <span className="text-sm">{label}</span>
    </label>
  );
}
function RadioCard({
  active,
  onClick,
  title,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left ${active ? "border-primary ring-2 ring-primary/30" : ""}`}
    >
      <div className="font-medium">{title}</div>
    </button>
  );
}
function GoalCard({
  active,
  onClick,
  title,
  caption,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  caption: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mb-3 w-full rounded-2xl border p-4 text-left ${active ? "border-primary ring-2 ring-primary/30" : ""}`}
    >
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground">{caption}</div>
    </button>
  );
}
