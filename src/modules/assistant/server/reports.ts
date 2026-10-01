import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import type { DailyReport } from '../domain/daily-report';
import { DAILY_REPORT_VERSION } from '../domain/daily-report';

type Supabase = StaffContext['supabase'];

export type StoredDailyReport = {
  report: DailyReport;
  summary: string | null;
  summaryAt: string | null;
  generatedAt: string;
  /** null: tarea programada. */
  generatedBy: string | null;
};

function parse(row: {
  facts: unknown;
  summary: string | null;
  summary_at: string | null;
  generated_at: string;
  generated_by: string | null;
}): StoredDailyReport | null {
  const facts = row.facts as Partial<DailyReport> | null;
  // Un informe de otra versión no se interpreta a ciegas: se vuelve a generar.
  if (!facts || facts.version !== DAILY_REPORT_VERSION) return null;
  return {
    report: facts as DailyReport,
    summary: row.summary,
    summaryAt: row.summary_at,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
  };
}

const COLUMNS =
  'report_date, facts, summary, summary_at, generated_at, generated_by';

/** Informe guardado de un día (RLS: agent.use). */
export async function getStoredReport(
  supabase: Supabase,
  day: string,
): Promise<StoredDailyReport | null> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select(COLUMNS)
    .eq('report_date', day)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? parse(data) : null;
}

/** El último informe guardado, para el inicio del panel. */
export async function getLatestReport(
  supabase: Supabase,
): Promise<StoredDailyReport | null> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select(COLUMNS)
    .order('report_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? parse(data) : null;
}

/** Días con informe guardado, del más reciente al más antiguo. */
export async function listReportDays(
  supabase: Supabase,
  limit = 14,
): Promise<{ day: string; hasSummary: boolean }[]> {
  const { data, error } = await supabase
    .from('daily_reports')
    .select('report_date, summary')
    .order('report_date', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    day: row.report_date,
    hasSummary: row.summary !== null,
  }));
}
