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

// Permisos añadidos después, con su asignación (control del negocio, DECISIONS §113).
const later = readFileSync(
  new URL(
    '../../supabase/migrations/20261010120000_business_control.sql',
    import.meta.url,
  ),
  'utf8',
);

const guards = readFileSync(
  new URL(
    '../../supabase/migrations/20260930220818_admin_mfa_guards.sql',
    import.meta.url,
  ),
  'utf8',
);
const allowedAal1 = [
  ...(guards.match(/where code not in \(([^)]+)\)/)?.[1] ?? '').matchAll(
    /'([^']+)'/g,
  ),
].map((match) => match[1]);

function valuesIn(source: string, table: string): string[][] {
  const block = source.split(`insert into public.${table}`)[1]?.split(';')[0];
  if (!block) throw new Error(`Sin datos para ${table}`);
  return [...block.matchAll(/\(([^()]+)\)/g)]
    .slice(1)
    .map((row) =>
      (row[1] ?? '').split(',').map((cell) => cell.trim().replace(/'/g, '')),
    );
}

/** Filas de la siembra inicial seguidas de las de migraciones posteriores. */
function valuesOf(table: string): string[][] {
  return [...valuesIn(sql, table), ...valuesIn(later, table)];
}

describe('la migración refleja la matriz de permisos del código', () => {
  it('mismo catálogo de permisos y mismos que exigen aal2', () => {
    const rows = valuesOf('permissions');
    expect(rows.map(([code]) => code)).toEqual([...PERMISSIONS]);
    expect(
      rows
        .filter(([code]) => !allowedAal1.includes(code!))
        .map(([code]) => code),
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
