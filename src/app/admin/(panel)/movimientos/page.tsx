import type { Metadata } from 'next';
import { PageHeader } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { MOVEMENT_LABELS } from '@/modules/inventory';
import type { MovementType } from '@/modules/inventory';
import { listMovements } from '@/modules/inventory/server';

export const metadata: Metadata = { title: 'Movimientos' };

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

export default async function Movements() {
  const { supabase } = await requirePermission('inventory.view');
  const movements = await listMovements(supabase, { limit: 200 });
  return (
    <main>
      <PageHeader eyebrow="Inventario" title="Movimientos" />
      <p className="text-smoke mb-8 max-w-2xl text-sm leading-relaxed">
        Registro de solo lectura: los movimientos no se editan ni se borran. Un
        error se corrige con un ajuste que queda también registrado.
      </p>
      {movements.length === 0 ? (
        <p className="text-smoke py-16 text-center">Aún no hay movimientos.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table min-w-[48rem]">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Movimiento</th>
                <th>Perfume</th>
                <th className="text-right">Cambio</th>
                <th className="text-right">Queda</th>
                <th>Motivo / referencia</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td className="text-smoke text-xs whitespace-nowrap">
                    {DATE.format(new Date(m.createdAt))}
                  </td>
                  <td className="text-sm">
                    {MOVEMENT_LABELS[m.type as MovementType] ?? m.type}
                  </td>
                  <td className="text-sm">
                    {m.productName}{' '}
                    <span className="text-smoke">
                      · {m.brandName} · {m.variantLabel}
                    </span>
                  </td>
                  <td
                    className={`text-right tabular-nums ${m.deltaOnHand < 0 ? 'text-danger' : m.deltaOnHand > 0 ? 'text-success' : 'text-smoke'}`}
                  >
                    {m.deltaOnHand > 0 ? '+' : ''}
                    {m.deltaOnHand}
                  </td>
                  <td className="text-right tabular-nums">{m.onHandAfter}</td>
                  <td className="text-smoke text-xs">
                    {[m.reason, m.reference].filter(Boolean).join(' · ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
