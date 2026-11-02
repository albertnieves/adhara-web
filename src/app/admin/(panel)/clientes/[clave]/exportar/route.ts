import { requirePermission } from '@/modules/auth/server';
import { exportFileName } from '@/modules/customers';
import { exportCustomer } from '@/modules/customers/server';

/**
 * Todos los datos de un cliente en JSON, para el derecho de acceso (A7,
 * DECISIONS §184). Exige customers.manage con MFA y queda en la auditoría
 * (lo apunta la base, sin el email).
 */
export async function GET(
  _: Request,
  { params }: { params: Promise<{ clave: string }> },
) {
  const { supabase } = await requirePermission('customers.manage');
  const { clave } = await params;
  const data = await exportCustomer(supabase, clave);
  if (data === null)
    return new Response('Not Found', {
      status: 404,
      headers: { 'Cache-Control': 'private, no-store' },
    });
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${exportFileName(clave, new Date())}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
