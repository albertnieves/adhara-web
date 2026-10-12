import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ORDER_STATUSES, ORDER_TRANSITIONS } from '@/modules/orders';

const sql = readFileSync(
  new URL(
    '../../supabase/migrations/20261011230000_web_orders.sql',
    import.meta.url,
  ),
  'utf8',
);

function between(start: string, end: string): string {
  const block = sql.split(start)[1]?.split(end)[0];
  if (!block) throw new Error(`Bloque no encontrado: ${start}`);
  return block;
}

describe('la migración de pedidos web repite las reglas del dominio', () => {
  it('mismos estados en el CHECK', () => {
    const block = between(
      "status text not null default 'pending_payment' check (status in (",
      '))',
    );
    const statuses = [...block.matchAll(/'([a-z_]+)'/g)].map(
      (match) => match[1],
    );
    expect(statuses).toEqual([...ORDER_STATUSES]);
  });

  it('mismo cuadro de transiciones, en el mismo orden', () => {
    const block = between('from (values', ') as t(from_status');
    const rows = [
      ...block.matchAll(
        /\('([a-z_]+)', '([a-z_]+)', '([a-z_.]+)', '([a-z_]+)', (true|false), (null|'[a-z_]+')\)/g,
      ),
    ].map(([, from, to, by, inventory, refund, only]) => ({
      from,
      to,
      by,
      inventory,
      ...(refund === 'true' ? { refund: true } : {}),
      ...(only && only !== 'null' ? { only: only.slice(1, -1) } : {}),
    }));
    expect(rows).toEqual(ORDER_TRANSITIONS);
  });
});
