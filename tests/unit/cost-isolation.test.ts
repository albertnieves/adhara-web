import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Aislamiento de costes en el código (complementa supabase/tests/database/
 * 03_costs.test.sql): la tienda no toca costes y solo el panel los pide.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const COST_PATTERN =
  /cost_net|costNet|variant_cost|admin_variant_costs|admin_record_variant_cost|getVariantCosts|pricing\.view_cost|pricing\.edit_cost/;

function files(path: string): string[] {
  const absolute = join(ROOT, path);
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute).flatMap((entry) => files(join(path, entry)));
}

function read(path: string) {
  return readFileSync(join(ROOT, path), 'utf8');
}

/** Todo lo que se renderiza o se consulta para el público. */
const STOREFRONT = [
  'src/app/[locale]',
  'src/modules/storefront',
  'src/modules/unboxing',
  'src/modules/brand',
  'src/modules/catalog/domain',
  'src/modules/catalog/index.ts',
  'src/modules/catalog/server/storefront.ts',
  'src/lib/supabase/public.ts',
  'messages',
];

describe('aislamiento de costes', () => {
  it('la tienda no referencia costes', () => {
    const leaks = STOREFRONT.flatMap(files).filter((path) =>
      COST_PATTERN.test(read(path)),
    );
    expect(leaks).toEqual([]);
  });

  it('solo el servidor del panel llama a las funciones de costes', () => {
    const callers = files('src')
      .filter((path) =>
        /admin_(variant_costs|record_variant_cost)/.test(read(path)),
      )
      .map((path) => relative('src', path))
      .sort();
    expect(callers).toEqual([
      'lib/supabase/database.types.ts',
      'modules/catalog/server/actions.ts',
      'modules/catalog/server/admin.ts',
    ]);
    expect(read('src/modules/catalog/server/admin.ts')).toMatch(
      /^import 'server-only';/,
    );
    expect(read('src/modules/catalog/server/actions.ts')).toMatch(
      /^'use server';/,
    );
  });

  it('solo las páginas del panel cargan costes', () => {
    const loaders = files('src/app')
      .filter((path) => read(path).includes('getVariantCosts'))
      .map((path) => relative('src/app', path));
    expect(loaders.length).toBeGreaterThan(0);
    for (const path of loaders) expect(path).toMatch(/^admin\//);
  });
});
