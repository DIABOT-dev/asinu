import { MetricsRepo } from "@/infrastructure/repositories/MetricsRepo";
import { GlucoseLogsRepo } from "@/infrastructure/repositories/GlucoseLogsRepo";
import { format, subDays } from "date-fns";

export class GetChartMetric {
  constructor(
    private metricsRepo: MetricsRepo,
    private glucoseRepo: GlucoseLogsRepo
  ) {}

  async execute(userId: string, metric: string, range: "7d" | "30d"): Promise<{
    labels: string[];
    series: number[];
  }> {
    const days = range === "7d" ? 7 : 30;
    const endDate = new Date();
    const startDate = subDays(endDate, days - 1);

    const fromDay = format(startDate, "yyyy-MM-dd");
    const toDay = format(endDate, "yyyy-MM-dd");

    try {
      // Try to get from metrics_day first
      const metrics = await this.metricsRepo.getDailyMetrics(userId, fromDay, toDay, metric);

      if (metrics.length > 0) {
        const labels = metrics.map((m) => format(new Date(m.day), "MM/dd"));
        const series = metrics.map((m) => m.value.avg || 0);
        return { labels, series };
      }

      // Fallback: calculate from raw logs (for bg_avg)
      if (metric === "bg_avg") {
        return await this.calculateBGAvgFromLogs(userId, fromDay, toDay, days);
      }

      // Return empty data for other metrics
      return { labels: [], series: [] };
    } catch (error) {
      console.error("Error getting chart metric:", error);
      return { labels: [], series: [] };
    }
  }

  private async calculateBGAvgFromLogs(userId: string, fromDay: string, toDay: string, rangeDays: number) {
    const logs = await this.glucoseRepo.listByRange(
      userId,
      `${fromDay}T00:00:00.000Z`,
      `${toDay}T23:59:59.999Z`
    );

    // Group by day and calculate averages
    const dailyAvgs: Record<string, number[]> = {};

    logs.forEach((log) => {
      const day = format(new Date(log.noted_at), "yyyy-MM-dd");
      if (!dailyAvgs[day]) dailyAvgs[day] = [];
      dailyAvgs[day].push(log.value_mgdl);
    });

    const labels: string[] = [];
    const series: number[] = [];

    // Fill in all days in range
    for (let i = 0; i < rangeDays; i += 1) {
      const date = subDays(new Date(toDay), rangeDays - 1 - i);
      const day = format(date, "yyyy-MM-dd");
      const dayLabel = format(date, "MM/dd");

      labels.push(dayLabel);

      if (dailyAvgs[day] && dailyAvgs[day].length > 0) {
        const avg = dailyAvgs[day].reduce((a, b) => a + b, 0) / dailyAvgs[day].length;
        series.push(Math.round(avg));
      } else {
        series.push(0);
      }
    }

    return { labels, series };
  }
}
