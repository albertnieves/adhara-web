import Link from 'next/link';
import { MOVEMENT_LABELS } from '../domain/labels';
import type { MovementType } from '../domain/movements';
import type { MovementRow, StockRow } from '../server/admin';
import { StockActions } from './StockActions';

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'Europe/Madrid',
});

/** Stock de un perfume en la tienda, con sus acciones y últimos movimientos. */
export function ProductStock({
  productId,
  locationId,
  rows,
  movements,
  movementTypes,
  canStocktake,
  canAdjust,
}: {
  productId: string;
  locationId: string;
  rows: StockRow[];
  movements: MovementRow[];
  movementTypes: MovementType[];
  canStocktake: boolean;
  canAdjust: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="text-smoke text-sm">
        Añade un formato para poder registrar stock.
      </p>
    );
  }
  const total = rows.reduce((sum, row) => sum + row.onHand, 0);
  return (
    <div className="space-y-10">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[40rem]">
          <thead>
            <tr>
              <th>Formato</th>
              <th className="text-right">En tienda</th>
              <th className="text-right">Reservado</th>
              <th className="text-right">Disponible</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const available = row.onHand - row.reserved;
              const low =
                available <= 0 ||
                (row.reorderPoint !== null && available <= row.reorderPoint);
              return (
                <tr key={row.variantId} className="align-top">
                  <td className="text-sm">
                    {row.variantLabel}
                    {row.sku && <p className="text-mist text-xs">{row.sku}</p>}
                    {!row.active && (
                      <p className="text-mist text-xs">inactivo</p>
                    )}
                  </td>
                  <td className="text-right tabular-nums">{row.onHand}</td>
                  <td className="text-smoke text-right tabular-nums">
                    {row.reserved}
                  </td>
                  <td
                    className={`text-right font-semibold tabular-nums ${low ? 'text-danger' : ''}`}
                  >
                    {available}
                    {row.reorderPoint !== null && (
                      <p className="text-mist text-[0.6875rem] font-normal">
                        aviso ≤ {row.reorderPoint}
                      </p>
                    )}
                  </td>
                  <td>
                    <StockActions
                      variantId={row.variantId}
                      locationId={locationId}
                      onHand={row.onHand}
                      reserved={row.reserved}
                      reorderPoint={row.reorderPoint}
                      movementTypes={movementTypes}
                      canStocktake={canStocktake}
                      canAdjust={canAdjust}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-smoke mt-3 text-xs tracking-[0.14em] uppercase">
          {total} {total === 1 ? 'unidad' : 'unidades'} en tienda
        </p>
      </div>

      <div>
        <div className="mb-3 flex items-end justify-between gap-4">
          <h3 className="eyebrow">Últimos movimientos</h3>
          {movements.length > 0 && (
            <Link
              href={`/admin/movimientos?perfume=${productId}`}
              className="link-underline text-xs tracking-[0.16em] uppercase"
            >
              Ver todos
            </Link>
          )}
        </div>
        {movements.length === 0 ? (
          <p className="text-smoke text-sm">
            Sin movimientos todavía. Registra la primera recepción desde
            «Movimiento».
          </p>
        ) : (
          <ul className="divide-line border-line divide-y border-y text-sm">
            {movements.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[auto_1fr_auto] items-baseline gap-x-4 py-2.5"
              >
                <span className="text-smoke text-xs whitespace-nowrap tabular-nums">
                  {DATE.format(new Date(m.createdAt))}
                </span>
                <span className="min-w-0">
                  {MOVEMENT_LABELS[m.type as MovementType] ?? m.type}
                  <span className="text-smoke"> · {m.variantLabel}</span>
                  {(m.reason || m.reference) && (
                    <span className="text-mist block truncate text-xs">
                      {[m.reason, m.reference].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </span>
                <span
                  className={`text-right tabular-nums ${m.deltaOnHand < 0 ? 'text-danger' : m.deltaOnHand > 0 ? 'text-success' : 'text-smoke'}`}
                >
                  {m.deltaOnHand > 0 ? '+' : ''}
                  {m.deltaOnHand}
                  <span className="text-mist text-xs"> → {m.onHandAfter}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
