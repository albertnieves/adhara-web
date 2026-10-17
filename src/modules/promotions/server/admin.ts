import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import type { DiscountCode, DiscountKind } from '../domain';

type Supabase = StaffContext['supabase'];

type Row = {
  id: string;
  code: string;
  description: string | null;
  kind: string;
  percent_bp: number | null;
  amount_cents: number | null;
  min_items_cents: number | null;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  once_per_email: boolean;
  exclude_sale_items: boolean;
  active: boolean;
  created_at: string;
};

function toCode(
  row: Row,
  usage: { uses: number; paidUses: number; paidDiscountCents: number },
): DiscountCode {
  return {
    id: row.id,
    code: row.code,
    description: row.description,
    kind: row.kind as DiscountKind,
    percentBp: row.percent_bp,
    amountCents: row.amount_cents,
    minItemsCents: row.min_items_cents,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    maxUses: row.max_uses,
    oncePerEmail: row.once_per_email,
    excludeSaleItems: row.exclude_sale_items,
    active: row.active,
    createdAt: row.created_at,
    ...usage,
  };
}

/**
 * Códigos con sus usos (admin_list_discount_codes: promotions.manage con
 * MFA), los más recientes primero. Sin datos de clientes.
 */
export async function listDiscountCodes(
  supabase: Supabase,
): Promise<DiscountCode[]> {
  const { data, error } = await supabase.rpc('admin_list_discount_codes');
  if (error) {
    console.error('[promociones] no se pudo leer la lista', error.message);
    return [];
  }
  return data.map((row) =>
    toCode(row, {
      uses: row.uses,
      paidUses: row.paid_uses,
      paidDiscountCents: Number(row.paid_discount_cents),
    }),
  );
}

/** Un código con sus usos, o null si no existe o no hay permiso. */
export async function getDiscountCode(
  supabase: Supabase,
  id: string,
): Promise<DiscountCode | null> {
  const codes = await listDiscountCodes(supabase);
  return codes.find((code) => code.id === id) ?? null;
}
