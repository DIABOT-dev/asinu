import { LineChart, BarChart, DonutChart } from "@/components/charts";
import { chartColors } from "@/components/charts/chart-colors";
import type { ChartVM } from "../domain/types";
import type { ChartData } from "chart.js";
import { format, parseISO } from "date-fns";
import { ChartCard } from "./components/ChartCard";

type Props = { vm: ChartVM };

export default function TrendChart({ vm }: Props) {
  const labels = vm.days.map((day) => {
    try {
      return format(parseISO(day.date), "dd/MM");
    } catch {
      return day.date;
    }
  });

  const bgData = buildLineData(labels, "Đường huyết", "#0ea5e9", vm.days.map((d) => d.bg_avg ?? null));
  const weightData = buildLineData(labels, "Cân nặng", "#f97316", vm.days.map((d) => d.weight_kg ?? null));
  const bpData = buildMultiLineData(labels, [
    { label: "Huyết áp tâm thu", color: "#6366f1", values: vm.days.map((d) => d.bp_sys_avg ?? null) },
    { label: "Huyết áp tâm trương", color: "#a855f7", values: vm.days.map((d) => d.bp_dia_avg ?? null) },
  ]);
  const waterData = buildBarData(labels, "Nước (ml)", "#0ea5e9", vm.days.map((d) => d.water_ml ?? 0));
  const insulinData = buildBarData(labels, "Insulin (U)", "#6366f1", vm.days.map((d) => d.insulin_units ?? 0));
  const mealData = buildBarData(labels, "Bữa ăn", "#14b8a6", vm.days.map((d) => d.meals_count ?? 0));

  const totals = {
    water: sum(vm.days.map((d) => d.water_ml ?? 0)),
    insulin: sum(vm.days.map((d) => d.insulin_units ?? 0)),
    meals: sum(vm.days.map((d) => d.meals_count ?? 0)),
  };

  const donutData: ChartData<"doughnut"> = {
    labels: ["Nước (ml)", "Insulin (U)", "Bữa ăn"],
    datasets: [
      {
        data: [totals.water, totals.insulin, totals.meals],
        backgroundColor: chartColors.accentPalette.slice(0, 3),
      },
    ],
  };

  const sections = [
    {
      key: "bg",
      title: "Xu hướng đường huyết",
      subtitle: "mg/dL",
      content: <LineChart data={bgData} height={280} />,
      footer: "Trung bình 7 ngày gần nhất dựa trên log BG.",
    },
    {
      key: "bp",
      title: "Huyết áp gần đây",
      subtitle: "mmHg",
      content: <LineChart data={bpData} height={280} />,
      footer: "Theo dõi cả hai chỉ số tâm thu/tâm trương.",
    },
    {
      key: "weight",
      title: "Cân nặng",
      subtitle: "kg",
      content: <LineChart data={weightData} height={280} />,
      footer: "Dựa trên log cân nặng theo ngày.",
    },
    {
      key: "water",
      title: "Nước uống",
      subtitle: "ml mỗi ngày",
      content: <BarChart data={waterData} height={280} />,
      footer: "So sánh theo ngày trong giai đoạn chọn.",
    },
    {
      key: "insulin",
      title: "Insulin",
      subtitle: "Đơn vị",
      content: <BarChart data={insulinData} height={280} />,
      footer: "Tổng liều insulin mỗi ngày.",
    },
    {
      key: "meal",
      title: "Bữa ăn ghi nhận",
      subtitle: "số lần",
      content: <BarChart data={mealData} height={280} />,
      footer: "Đếm số log bữa ăn từng ngày.",
    },
    {
      key: "composition",
      title: "Phân bổ log sức khỏe",
      subtitle: "7 ngày gần nhất",
      content: <DonutChart data={donutData} height={260} />,
      footer: "Cho thấy tỷ trọng hành động bạn ghi lại.",
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {sections.map((section) => (
        <ChartCard
          key={section.key}
          title={section.title}
          subtitle={section.subtitle}
          footer={section.footer}
        >
          {section.content}
        </ChartCard>
      ))}
    </div>
  );
}

function buildLineData(labels: string[], label: string, color: string, values: (number | null)[]): ChartData<"line"> {
  return {
    labels,
    datasets: [
      {
        label,
        data: values,
        borderColor: color,
        backgroundColor: `${color}20`,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        borderWidth: 3,
      },
    ],
  };
}

function buildMultiLineData(labels: string[], configs: { label: string; color: string; values: (number | null)[] }[]): ChartData<"line"> {
  return {
    labels,
    datasets: configs.map((cfg) => ({
      label: cfg.label,
      data: cfg.values,
      borderColor: cfg.color,
      backgroundColor: `${cfg.color}1a`,
      fill: false,
      tension: 0.4,
      borderWidth: 3,
      pointRadius: 0,
    })),
  };
}

function buildBarData(labels: string[], label: string, color: string, values: number[]): ChartData<"bar"> {
  return {
    labels,
    datasets: [
      {
        label,
        data: values,
        backgroundColor: color,
        borderRadius: 8,
      },
    ],
  };
}

function sum(values: number[]) {
  return values.reduce((acc, value) => acc + value, 0);
}
