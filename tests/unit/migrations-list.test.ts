import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { REPO_MIGRATIONS, migrationDiff } from '@/modules/control';

const files = readdirSync(
  new URL('../../supabase/migrations/', import.meta.url),
)
  .filter((name) => name.endsWith('.sql'))
  .sort();

describe('lista de migraciones de la consola', () => {
  it('coincide exactamente con supabase/migrations', () => {
    expect(
      REPO_MIGRATIONS.map(([version, name]) => `${version}_${name}.sql`),
    ).toEqual(files);
  });

  it('separa las pendientes y las que no están en el repositorio', () => {
    const diff = migrationDiff(
      [
        ['20260101000000', 'uno'],
        ['20260102000000', 'dos'],
      ],
      [
        { version: '20260101000000', name: 'uno' },
        { version: '20251231000000', name: null },
      ],
    );
    expect(diff).toEqual({
      pending: [{ version: '20260102000000', name: 'dos' }],
      unknown: [{ version: '20251231000000', name: null }],
      applied: 2,
    });
  });
});
