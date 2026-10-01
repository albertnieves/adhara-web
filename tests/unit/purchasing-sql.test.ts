import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { WATCH_SETTING_LIMITS } from '@/modules/inventory';
import {
  ORDER_TRANSITIONS,
  PURCHASE_ORDER_STATUSES,
} from '@/modules/purchasing';

const sql = readFileSync(
  new URL(
    '../../supabase/migrations/20260930224000_purchasing_counter_replenishment.sql',
    import.meta.url,
  ),
  'utf8',
);

function between(start: string, end: string): string {
  const block = sql.split(start)[1]?.split(end)[0];
  if (!block) throw new Error(`Bloque no encontrado: ${start}`);
  return block;
}

describe('la migración de compras repite las reglas del dominio', () => {
  it('mismos estados del pedido en el CHECK', () => {
    const block = between(
      "status text not null default 'draft' check (status in (",
      '))',
    );
    expect([...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])).toEqual([
      ...PURCHASE_ORDER_STATUSES,
    ]);
  });

  it('mismas transiciones manuales', () => {
    const block = between('from (values', ') as t(status, action, next)');
    const rows = [
      ...block.matchAll(/\('([a-z_]+)', '([a-z_]+)', '([a-z_]+)'\)/g),
    ]
      .map(([, status, action, next]) => [status, action, next])
      .sort();
    const expected = Object.entries(ORDER_TRANSITIONS)
      .flatMap(([status, actions]) =>
        Object.entries(actions).map(([action, next]) => [status, action, next]),
      )
      .sort();
    expect(rows).toEqual(expected);
  });

  it('mismos límites de los parámetros del vigilante', () => {
    const columns = {
      salesWindowDays: 'sales_window_days',
      targetCoverDays: 'target_cover_days',
      safetyDays: 'safety_days',
      deadStockDays: 'dead_stock_days',
    } as const;
    for (const [key, column] of Object.entries(columns)) {
      const limits = WATCH_SETTING_LIMITS[key as keyof typeof columns];
      expect(sql).toContain(
        `check (${column} between ${limits.min} and ${limits.max})`,
      );
    }
  });

  it('toda función nueva se retira a anon y se concede solo a authenticated', () => {
    const created = [
      ...sql.matchAll(/create function public\.([a-z_]+)\(/g),
    ].map((m) => m[1]);
    const revoked = between('revoke execute on function', 'from public, anon;');
    const granted = between('grant execute on function', 'to authenticated;');
    for (const name of created) {
      expect(revoked).toContain(`public.${name}(`);
      expect(granted).toContain(`public.${name}(`);
    }
  });

  it('las escrituras del mostrador exigen MFA aunque el permiso no la exija', () => {
    const sale = between(
      'create function public.admin_record_store_sale(',
      '$$;',
    );
    expect(sale).toContain("private.has_permission('inventory.sell_in_store')");
    expect(sale).toContain("private.current_aal() = 'aal2'");
  });
});
