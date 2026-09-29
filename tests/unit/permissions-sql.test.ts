import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  AAL2_PERMISSIONS,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  STAFF_ROLES,
} from '@/modules/auth';

const sql = readFileSync(
  new URL(
    '../../supabase/migrations/20260929170455_staff_and_permissions.sql',
    import.meta.url,
  ),
  'utf8',
);

function valuesOf(table: string): string[][] {
  const block = sql.split(`insert into public.${table}`)[1]?.split(';')[0];
  if (!block) throw new Error(`Sin datos para ${table}`);
  return [...block.matchAll(/\(([^()]+)\)/g)]
    .slice(1)
    .map((row) =>
      (row[1] ?? '').split(',').map((cell) => cell.trim().replace(/'/g, '')),
    );
}

describe('la migración refleja la matriz de permisos del código', () => {
  it('mismo catálogo de permisos y mismos que exigen aal2', () => {
    const rows = valuesOf('permissions');
    expect(rows.map(([code]) => code)).toEqual([...PERMISSIONS]);
    expect(
      rows.filter(([, aal2]) => aal2 === 'true').map(([code]) => code),
    ).toEqual(PERMISSIONS.filter((code) => AAL2_PERMISSIONS.has(code)));
  });

  it('misma asignación rol → permiso', () => {
    const rows = valuesOf('role_permissions');
    for (const role of STAFF_ROLES) {
      expect(
        rows.filter(([r]) => r === role).map(([, permission]) => permission),
      ).toEqual([...ROLE_PERMISSIONS[role]]);
    }
    expect(sql).toContain(`check (role in ('${STAFF_ROLES.join("', '")}'))`);
  });
});
