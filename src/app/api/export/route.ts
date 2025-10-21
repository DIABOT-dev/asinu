import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/getUserId';
import { supabaseAdmin } from '@/lib/supabase/admin';
export const dynamic = 'force-dynamic';

type MetricRow = {
  day: string;
  avg_bg_mgdl: number | null;
  count_bg: number | null;
  total_water_ml: number | null;
  weight_kg: number | null;
  avg_systolic: number | null;
  avg_diastolic: number | null;
};

function toCSV(rows: Record<string, any>[]) {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const r of rows) lines.push(headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
  return lines.join('\n');
}

export async function GET(req: NextRequest) {
  try {
    const uid = await requireAuth(req);
    const sb = supabaseAdmin();

    // Get date range (last 7 days)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 7);

    // Fetch metrics_day (aggregated daily data)
    const { data: metricsData, error: metricsError } = await sb
      .from('metrics_day')
      .select('day, avg_bg_mgdl, count_bg, total_water_ml, weight_kg, avg_systolic, avg_diastolic')
      .eq('user_id', uid)
      .gte('day', startDate.toISOString().slice(0, 10))
      .lte('day', endDate.toISOString().slice(0, 10))
      .order('day', { ascending: true });

    if (metricsError) {
      console.error('Export error (metrics):', metricsError);
      throw new Error('Failed to fetch metrics data');
    }

    // If no metrics, fetch raw glucose logs as fallback
    let rows: MetricRow[] = metricsData ?? [];

    if (!rows.length) {
      const { data: bgLogs, error: bgError } = await sb
        .from('glucose_logs')
        .select('taken_at, value_mgdl')
        .eq('user_id', uid)
        .gte('taken_at', startDate.toISOString())
        .lte('taken_at', endDate.toISOString())
        .order('taken_at', { ascending: true });

      if (!bgError && bgLogs) {
        rows = bgLogs.map((log) => ({
          day: log.taken_at.slice(0, 10),
          avg_bg_mgdl: log.value_mgdl ?? null,
          count_bg: 1,
          total_water_ml: 0,
          weight_kg: null,
          avg_systolic: null,
          avg_diastolic: null,
        }));
      }
    }

    // Format data for CSV
    const csvRows = rows.map((r) => ({
      date: r.day ?? '',
      avg_bg: r.avg_bg_mgdl ?? '',
      bg_count: r.count_bg ?? '',
      water_ml: r.total_water_ml ?? '',
      weight_kg: r.weight_kg ?? '',
      systolic: r.avg_systolic ?? '',
      diastolic: r.avg_diastolic ?? '',
    }));

    if (!csvRows.length) {
      return NextResponse.json({ error: 'No data found for export' }, { status: 404 });
    }

    const csv = toCSV(csvRows);
    const filename = `anora_export_${uid.slice(0, 8)}_${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    if (error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Export error:', error);
    return NextResponse.json({ error: error?.message || 'Export failed' }, { status: 500 });
  }
}
