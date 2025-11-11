import { apiFetch, ApiError } from "@/lib/http";
import type { ChartVM, Metric, RangeOption } from "../../domain/types";
import { buildDemoChartVM } from "../../infrastructure/adapters/DemoData";
import { getFeatureFlag } from "../../../../../config/feature-flags";

type ChartApiResponse = {
  range: RangeOption;
  days: ChartVM["days"];
  kpi: ChartVM["kpi"];
};

export async function FetchChartData(range: RangeOption, _metrics?: Metric[]): Promise<ChartVM> {
  if (getFeatureFlag("CHART_USE_DEMO_DATA")) {
    return buildDemoChartVM(range);
  }
  try {
    const response = await apiFetch<ChartApiResponse>(`/api/chart/metrics?range=${range}`);
    return { days: response.days, kpi: response.kpi };
  } catch (error) {
    if (error instanceof ApiError) {
      console.warn("[Chart] API error", error.code, error.message);
    } else {
      console.warn("[Chart] unexpected error", error);
    }
    return buildDemoChartVM(range);
  }
}
