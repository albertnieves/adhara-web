import 'server-only';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import type { Json } from '@/lib/supabase/database.types';
import type { BackupDocument } from '../domain/backup';
import {
  BACKUP_FORMAT,
  BACKUP_PAGE_SIZE,
  BACKUP_VERSION,
  supabaseRefOf,
} from '../domain/backup';
import { LATEST_MIGRATION } from '../domain/migrations';

/*
 * Copia lógica de los datos del negocio: recorre la lista blanca de
 * admin_control_export_catalog y pagina admin_control_export por tabla. La
 * usan la tarea diaria (cliente de servicio, tras CRON_SECRET) y la descarga
 * al momento (sesión del titular). Las dos funciones SQL lo vuelven a
 * comprobar: titular con MFA o rol de servicio.
 */

export type ExportTable = { schema: string; table: string };

/** Acceso a la base que necesita la copia; cada llamante lo crea con su cliente. */
export type BackupSource = {
  catalog(): Promise<ExportTable[]>;
  page(table: ExportTable, offset: number, limit: number): Promise<Json>;
};

export type BuiltBackup = {
  gzip: Buffer;
  sha256: string;
  sizeBytes: number;
  rowCounts: Record<string, number>;
};

type Rpc = {
  rpc(fn: 'admin_control_export_catalog'): PromiseLike<{
    data: { schema_name: string; table_name: string }[] | null;
    error: { message: string } | null;
  }>;
  rpc(
    fn: 'admin_control_export',
    args: {
      p_schema: string;
      p_table: string;
      p_offset: number;
      p_limit: number;
    },
  ): PromiseLike<{ data: Json | null; error: { message: string } | null }>;
};

/** Fuente de datos con un cliente de Supabase tipado (sesión o servicio). */
export function backupSourceFrom(client: Rpc): BackupSource {
  return {
    async catalog() {
      const { data, error } = await client.rpc('admin_control_export_catalog');
      if (error) throw new Error(error.message);
      return (data ?? []).map((t) => ({
        schema: t.schema_name,
        table: t.table_name,
      }));
    },
    async page(table, offset, limit) {
      const { data, error } = await client.rpc('admin_control_export', {
        p_schema: table.schema,
        p_table: table.table,
        p_offset: offset,
        p_limit: limit,
      });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  };
}

/** Todas las filas de todas las tablas, comprimidas y con su huella. */
export async function buildBackup(
  source: BackupSource,
  now: Date = new Date(),
): Promise<BuiltBackup> {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const rowCounts: Record<string, number> = {};
  for (const table of await source.catalog()) {
    const key = `${table.schema}.${table.table}`;
    const rows: Record<string, unknown>[] = [];
    for (let offset = 0; ; offset += BACKUP_PAGE_SIZE) {
      const page = await source.page(table, offset, BACKUP_PAGE_SIZE);
      if (!Array.isArray(page)) throw new Error(`Página no válida de ${key}`);
      for (const row of page) {
        if (row && typeof row === 'object' && !Array.isArray(row))
          rows.push(row);
      }
      if (page.length < BACKUP_PAGE_SIZE) break;
    }
    tables[key] = rows;
    rowCounts[key] = rows.length;
  }
  const document: BackupDocument = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    generated_at: now.toISOString(),
    source: {
      supabase_ref: supabaseRefOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
      app_migration: LATEST_MIGRATION,
    },
    row_counts: rowCounts,
    tables,
  };
  const gzip = gzipSync(Buffer.from(JSON.stringify(document), 'utf8'));
  return {
    gzip,
    sha256: createHash('sha256').update(gzip).digest('hex'),
    sizeBytes: gzip.byteLength,
    rowCounts,
  };
}
