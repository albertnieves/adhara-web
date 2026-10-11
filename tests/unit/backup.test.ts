import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';
import type { Json } from '@/lib/supabase/database.types';
import {
  BACKUP_PATH_PATTERN,
  backupDayOf,
  backupDocumentSchema,
  backupFileName,
  backupStoragePath,
  expiredBackups,
  formatBytes,
  supabaseRefOf,
} from '@/modules/control';

vi.mock('server-only', () => ({}));
const { buildBackup } = await import('@/modules/control/server/backup');

describe('nombres y rutas de las copias', () => {
  // 23:30 UTC del 31 de octubre son las 00:30 del 1 de noviembre en Madrid
  // (UTC+1 en invierno).
  const now = new Date('2026-10-31T23:30:00Z');

  it('usa la fecha y la hora de Madrid', () => {
    expect(backupFileName(now)).toBe('latelier-copia-2026-11-01-0030.json.gz');
    expect(backupStoragePath(now)).toBe('db/2026/11/2026-11-01.json.gz');
    expect(backupStoragePath(now, true)).toBe(
      'db/2026/11/2026-11-01-0030.json.gz',
    );
  });

  it('solo reconoce rutas de copias', () => {
    expect(BACKUP_PATH_PATTERN.test('db/2026/11/2026-11-01.json.gz')).toBe(
      true,
    );
    expect(BACKUP_PATH_PATTERN.test('../db/2026/11/x.json.gz')).toBe(false);
    expect(BACKUP_PATH_PATTERN.test('db/2026/11/2026-11-01.json')).toBe(false);
    expect(backupDayOf('db/2026/11/2026-11-01-0030.json.gz')).toBe(
      '2026-11-01',
    );
    expect(backupDayOf('otra/cosa')).toBeNull();
  });

  it('caducan las de más de 30 días', () => {
    expect(
      expiredBackups(
        [
          'db/2026/09/2026-09-10.json.gz',
          'db/2026/09/2026-09-11.json.gz',
          'db/2026/10/2026-10-10.json.gz',
          'no-es-copia.txt',
        ],
        '2026-10-11',
      ),
    ).toEqual(['db/2026/09/2026-09-10.json.gz']);
  });

  it('referencia del proyecto y tamaños', () => {
    expect(supabaseRefOf('https://xgpsislololgbakzcmad.supabase.co')).toBe(
      'xgpsislololgbakzcmad',
    );
    expect(supabaseRefOf('http://127.0.0.1:54321')).toBeNull();
    expect(formatBytes(1_234_567)).toBe('1,2 MB');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(null)).toBe('—');
  });
});

describe('construcción de la copia', () => {
  it('pagina cada tabla, comprime y firma con sha256', async () => {
    const rows = (n: number, from = 0) =>
      Array.from({ length: n }, (_, i) => ({ id: from + i }));
    const pages: Record<string, Json[]> = {
      'public.brands': [rows(5000), rows(2, 5000)],
      'internal.control_tasks': [[]],
    };
    const calls: string[] = [];
    const backup = await buildBackup(
      {
        async catalog() {
          return [
            { schema: 'public', table: 'brands' },
            { schema: 'internal', table: 'control_tasks' },
          ];
        },
        async page(table, offset) {
          const key = `${table.schema}.${table.table}`;
          calls.push(`${key}@${offset}`);
          return pages[key]![offset / 5000] ?? [];
        },
      },
      new Date('2026-10-11T08:00:00Z'),
    );
    expect(calls).toEqual([
      'public.brands@0',
      'public.brands@5000',
      'internal.control_tasks@0',
    ]);
    expect(backup.rowCounts).toEqual({
      'public.brands': 5002,
      'internal.control_tasks': 0,
    });
    expect(backup.sha256).toBe(
      createHash('sha256').update(backup.gzip).digest('hex'),
    );
    const document = backupDocumentSchema.parse(
      JSON.parse(gunzipSync(backup.gzip).toString('utf8')),
    );
    expect(document.tables['public.brands']).toHaveLength(5002);
    expect(document.generated_at).toBe('2026-10-11T08:00:00.000Z');
  });
});
