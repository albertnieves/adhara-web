import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/*
 * Proveedores y pedidos de compra son datos internos (AGENTS.md): la tienda
 * no los toca y solo el servidor del panel llama a sus funciones. Complementa
 * supabase/tests/database/04_purchasing_counter.test.sql.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

function files(path: string): string[] {
  const absolute = join(ROOT, path);
  if (statSync(absolute).isFile()) return [path];
  return readdirSync(absolute).flatMap((entry) => files(join(path, entry)));
}

function read(path: string) {
  return readFileSync(join(ROOT, path), 'utf8');
}

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

/** Llamadas (el nombre como texto en `rpc('…')`), no menciones en comentarios. */
const INTERNAL_CALLS =
  /['"]admin_(list_suppliers|save_supplier|supplier_terms|remove_supplier_variant|assign_supplier_brand|create_purchase_order|list_purchase_orders|purchase_order_lines|purchase_order_receipts|update_purchase_order|set_purchase_order_lines|transition_purchase_order|delete_purchase_order|receive_purchase_order|record_store_sale|stock_watch_facts|set_stock_watch_settings)['"]/;

describe('aislamiento de compras', () => {
  it('la tienda no referencia compras, proveedores ni el mostrador', () => {
    const leaks = STOREFRONT.flatMap(files).filter(
      (path) =>
        /modules\/purchasing|supplier|purchase_order|store_sale/.test(
          read(path),
        ) || INTERNAL_CALLS.test(read(path)),
    );
    expect(leaks).toEqual([]);
  });

  it('solo el servidor del panel llama a las funciones internas', () => {
    const callers = files('src')
      .filter((path) => INTERNAL_CALLS.test(read(path)))
      .map((path) => relative('src', path))
      .sort();
    expect(callers).toEqual([
      'modules/inventory/server/counter.ts',
      'modules/inventory/server/watch-actions.ts',
      'modules/inventory/server/watch.ts',
      'modules/purchasing/server/actions.ts',
      'modules/purchasing/server/admin.ts',
    ]);
    for (const path of callers.filter((p) => p.startsWith('modules/'))) {
      expect(read(`src/${path}`)).toMatch(
        /^(import 'server-only';|'use server';)/,
      );
    }
  });

  it('solo las páginas del panel cargan datos de compras', () => {
    const loaders = files('src/app')
      .filter((path) => /@\/modules\/purchasing\/server/.test(read(path)))
      .map((path) => relative('src/app', path));
    expect(loaders.length).toBeGreaterThan(0);
    for (const path of loaders) expect(path).toMatch(/^admin\//);
  });
});
