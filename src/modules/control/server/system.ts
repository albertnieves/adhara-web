import 'server-only';
import { z } from 'zod';
import { fetchAll } from '@/lib/supabase/paginate';
import type { StaffContext } from '@/modules/auth/server';
import type { IsoDate } from '../domain/months';

/*
 * Estado del sistema, uso del asistente, calidad de datos y registro de
 * copias, con las funciones admin_control_* del titular.
 */

type Supabase = StaffContext['supabase'];

const count = z.coerce.number().int().nonnegative();

const statusSchema = z.object({
  generated_at: z.string(),
  database: z.object({ size_bytes: count }),
  tables: z.array(
    z.object({
      schema: z.string(),
      name: z.string(),
      rows: count,
      total_bytes: count,
    }),
  ),
  migrations: z
    .array(z.object({ version: z.string(), name: z.string().nullable() }))
    .nullable(),
  auth: z.object({ users: count, confirmed: count, with_totp: count }),
  storage: z.array(
    z.object({ bucket: z.string(), objects: count, bytes: count }),
  ),
  daily_report: z
    .object({
      report_date: z.string(),
      generated_at: z.string(),
      by_cron: z.boolean(),
      has_summary: z.boolean(),
    })
    .nullable(),
  newsletter: z.object({
    active: count,
    unsubscribed: count,
    pending_sender: count,
  }),
  last_backup: z
    .object({
      created_at: z.string(),
      kind: z.string(),
      status: z.string(),
      size_bytes: count.nullable(),
    })
    .nullable(),
  attention_30d: count.nullable(),
});

export type SystemStatus = z.infer<typeof statusSchema>;

export async function getSystemStatus(
  supabase: Supabase,
): Promise<SystemStatus> {
  const { data, error } = await supabase.rpc('admin_control_system_status');
  if (error) throw new Error(error.message);
  return statusSchema.parse(data);
}

export type AssistantUsageRow = {
  day: IsoDate;
  userId: string | null;
  person: string;
  kind: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
};

/** Consultas y tokens del asistente por día, persona, tipo y modelo en [from, to). */
export async function listAssistantUsage(
  supabase: Supabase,
  from: IsoDate,
  to: IsoDate,
): Promise<AssistantUsageRow[]> {
  const rows = await fetchAll((start, end) =>
    supabase
      .rpc('admin_control_assistant_usage', { p_from: from, p_to: to })
      .order('day')
      .order('person')
      .order('kind')
      .order('model')
      .range(start, end),
  );
  return rows.map((r) => ({
    day: r.day,
    userId: r.user_id,
    person: r.person,
    kind: r.kind,
    model: r.model,
    calls: r.calls,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    cacheReadTokens: r.cache_read_tokens,
  }));
}

export type QualitySeverity = 'alta' | 'media' | 'baja';

export type QualityIssue = {
  check: string;
  severity: QualitySeverity;
  productId: string | null;
  variantId: string | null;
  label: string;
  detail: string;
};

const SEVERITIES: Readonly<Record<string, QualitySeverity>> = {
  high: 'alta',
  medium: 'media',
  low: 'baja',
};

/** Incidencias de calidad del catálogo y del stock. */
export async function listDataQuality(
  supabase: Supabase,
): Promise<QualityIssue[]> {
  const rows = await fetchAll((start, end) =>
    supabase
      .rpc('admin_control_data_quality')
      .order('check_key')
      .order('label')
      .order('variant_id')
      .range(start, end),
  );
  return rows.map((r) => ({
    check: r.check_key,
    severity: SEVERITIES[r.severity] ?? 'baja',
    productId: r.product_id,
    variantId: r.variant_id,
    label: r.label,
    detail: r.detail,
  }));
}

export type BackupRecord = {
  id: number;
  createdAt: string;
  kind: 'scheduled' | 'manual';
  path: string | null;
  sizeBytes: number | null;
  sha256: string | null;
  tableRows: Record<string, number>;
  status: 'ok' | 'error';
  error: string | null;
};

const tableRowsSchema = z.record(z.string(), z.coerce.number()).catch({});

/** Copias registradas, de la más reciente a la más antigua. */
export async function listBackups(
  supabase: Supabase,
  limit = 90,
): Promise<BackupRecord[]> {
  const { data, error } = await supabase.rpc('admin_control_backups', {
    p_limit: limit,
  });
  if (error) throw new Error(error.message);
  return data.map((b) => ({
    id: b.id,
    createdAt: b.created_at,
    kind: b.kind === 'manual' ? 'manual' : 'scheduled',
    path: b.path,
    sizeBytes: b.size_bytes,
    sha256: b.sha256,
    tableRows: tableRowsSchema.parse(b.table_rows),
    status: b.status === 'ok' ? 'ok' : 'error',
    error: b.error,
  }));
}
