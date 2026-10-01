import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOVEMENT_REPORT_BUCKET } from '@/modules/reports';

const sql = readFileSync(
  new URL(
    '../../supabase/migrations/20261001090000_reports.sql',
    import.meta.url,
  ),
  'utf8',
);

describe('la migración de informes repite las categorías del dominio', () => {
  it('misma categoría para cada tipo de movimiento', () => {
    const block = sql.split('select case p_type')[1]?.split('end;')[0] ?? '';
    const mapped = Object.fromEntries(
      [...block.matchAll(/when '([A-Z_]+)' then '([a-z]+)'/g)].map(
        ([, type, bucket]) => [type, bucket],
      ),
    );
    const expected = Object.fromEntries(
      Object.entries(MOVEMENT_REPORT_BUCKET).filter(([, b]) => b !== null),
    );
    expect(mapped).toEqual(expected);
  });

  it('las funciones de informes solo leen y no son ejecutables por anon', () => {
    const created = [
      ...sql.matchAll(/create function public\.([a-z_]+)\(/g),
    ].map((m) => m[1]);
    expect(created).toEqual([
      'admin_report_inventory_period',
      'admin_report_purchases',
    ]);
    expect(sql).not.toMatch(
      /\b(insert|update|delete)\s+(into|from)?\s*(public|internal)\./i,
    );
    for (const name of created) {
      expect(sql).toMatch(
        new RegExp(`revoke execute on function[^;]*public\\.${name}\\(`),
      );
    }
  });
});
