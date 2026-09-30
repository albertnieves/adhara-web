import { toCsv } from '@/lib/csv';
import { requirePermission } from '@/modules/auth/server';
import { MOVEMENT_LABELS, parseMovementFilter } from '@/modules/inventory';
import type { MovementType } from '@/modules/inventory';
import { listMovements } from '@/modules/inventory/server';

const DATE = new Intl.DateTimeFormat('es-ES', {
  dateStyle: 'short',
  timeStyle: 'medium',
  timeZone: 'Europe/Madrid',
});

/** Hasta 20 000 movimientos por exportación (filtra por fechas si hay más). */
const MAX_ROWS = 20_000;

export async function GET(request: Request) {
  const { supabase } = await requirePermission('inventory.view');
  const url = new URL(request.url);
  const filter = parseMovementFilter(Object.fromEntries(url.searchParams));
  const movements = await listMovements(supabase, {
    ...filter,
    limit: MAX_ROWS,
  });
  const csv = toCsv([
    [
      'Fecha',
      'Movimiento',
      'Marca',
      'Perfume',
      'Formato',
      'SKU',
      'Cantidad',
      'Cambio en tienda',
      'Queda',
      'Motivo',
      'Referencia',
    ],
    ...movements.map((m) => [
      DATE.format(new Date(m.createdAt)),
      MOVEMENT_LABELS[m.type as MovementType] ?? m.type,
      m.brandName,
      m.productName,
      m.variantLabel,
      m.sku,
      m.quantity,
      m.deltaOnHand,
      m.onHandAfter,
      m.reason,
      m.reference,
    ]),
  ]);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="movimientos-${day}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
