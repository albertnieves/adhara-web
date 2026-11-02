import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import type {
  DiscountBatch,
  DiscountBatchAudience,
  DiscountBatchCode,
  DiscountCode,
  DiscountKind,
} from '../domain';

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

/**
 * Lotes de códigos únicos con sus usos (admin_list_discount_batches:
 * promotions.manage con MFA), los más recientes primero. Sin emails.
 */
export async function listDiscountBatches(
  supabase: Supabase,
): Promise<DiscountBatch[]> {
  const { data, error } = await supabase.rpc('admin_list_discount_batches');
  if (error) {
    console.error('[promociones] no se pudo leer los lotes', error.message);
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    audience: row.audience as DiscountBatchAudience,
    createdAt: row.created_at,
    kind: row.kind as DiscountKind,
    percentBp: row.percent_bp,
    amountCents: row.amount_cents,
    minItemsCents: row.min_items_cents,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    excludeSaleItems: row.exclude_sale_items,
    codes: row.codes,
    activeCodes: row.active_codes,
    usedCodes: row.used_codes,
    paidUses: row.paid_uses,
    paidDiscountCents: Number(row.paid_discount_cents),
  }));
}

/** Un lote con sus usos, o null si no existe o no hay permiso. */
export async function getDiscountBatch(
  supabase: Supabase,
  id: string,
): Promise<DiscountBatch | null> {
  const batches = await listDiscountBatches(supabase);
  return batches.find((batch) => batch.id === id) ?? null;
}

/**
 * Los códigos de un lote para el CSV (con su destinatario solo si además hay
 * customers.view). La base deja la descarga en la auditoría. null si el lote
 * no existe.
 */
export async function discountBatchCodes(
  supabase: Supabase,
  id: string,
): Promise<DiscountBatchCode[] | null> {
  const { data, error } = await supabase.rpc('admin_discount_batch_codes', {
    p_batch_id: id,
  });
  if (error) {
    if (error.message === 'not_found') return null;
    throw new Error(`No se pudo leer el lote: ${error.message}`);
  }
  return data.map((row) => ({
    code: row.code,
    email: row.email,
    active: row.active,
    used: row.used,
  }));
}
