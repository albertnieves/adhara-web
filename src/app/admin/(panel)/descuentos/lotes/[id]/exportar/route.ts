import { z } from 'zod';
import { toCsv } from '@/lib/csv';
import { requirePermission } from '@/modules/auth/server';
import {
  discountBatchCsvRows,
  discountBatchFileName,
} from '@/modules/promotions';
import {
  discountBatchCodes,
  getDiscountBatch,
} from '@/modules/promotions/server';

/**
 * CSV de un lote de códigos únicos (DECISIONS §185) para importarlo en Sender:
 * email y código de cada suscriptor (el email, solo con permiso de clientes).
 * La base deja cada descarga en la auditoría.
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { supabase } = await requirePermission('promotions.manage');
  const { id } = await params;
  const notFound = new Response('Not Found', {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
  if (!z.uuid().safeParse(id).success) return notFound;
  const batch = await getDiscountBatch(supabase, id);
  if (!batch) return notFound;
  const codes = await discountBatchCodes(supabase, id);
  if (!codes) return notFound;
  return new Response(toCsv(discountBatchCsvRows(codes)), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${discountBatchFileName(batch.prefix, new Date())}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
