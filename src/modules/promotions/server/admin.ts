import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import type {
  DiscountBatch,
  DiscountBatchAudience,
  DiscountBatchCode,
  DiscountCode,
  DiscountKind,
  Promotion,
  ShippingPromotion,
  ShippingPromotionZone,
} from '../domain';
import { SHIPPING_PROMOTION_ZONES } from '../domain';

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

/**
 * Promociones automáticas con sus usos (admin_list_promotions:
 * promotions.manage con MFA), las más recientes primero. Sin datos de
 * clientes.
 */
export async function listPromotions(supabase: Supabase): Promise<Promotion[]> {
  const { data, error } = await supabase.rpc('admin_list_promotions');
  if (error) {
    console.error(
      '[promociones] no se pudo leer las promociones',
      error.message,
    );
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as DiscountKind,
    percentBp: row.percent_bp,
    amountCents: row.amount_cents,
    minItemsCents: row.min_items_cents,
    brandId: row.brand_id,
    brandName: row.brand_name,
    excludeSaleItems: row.exclude_sale_items,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    active: row.active,
    createdAt: row.created_at,
    uses: row.uses,
    paidUses: row.paid_uses,
    paidDiscountCents: Number(row.paid_discount_cents),
  }));
}

/** Una promoción con sus usos, o null si no existe o no hay permiso. */
export async function getPromotion(
  supabase: Supabase,
  id: string,
): Promise<Promotion | null> {
  const promotions = await listPromotions(supabase);
  return promotions.find((promotion) => promotion.id === id) ?? null;
}

/** Casas para limitar una promoción, por nombre. */
export async function listPromotionBrands(
  supabase: Supabase,
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from('brands')
    .select('id, name')
    .order('name')
    .order('id')
    .limit(1000);
  if (error) {
    console.error('[promociones] no se pudo leer las casas', error.message);
    return [];
  }
  return data;
}

/**
 * Envío gratis temporal con sus usos (admin_list_shipping_promotions:
 * promotions.manage con MFA, DECISIONS §189), lo más reciente primero. Sin
 * datos de clientes.
 */
export async function listShippingPromotions(
  supabase: Supabase,
): Promise<ShippingPromotion[]> {
  const { data, error } = await supabase.rpc('admin_list_shipping_promotions');
  if (error) {
    console.error(
      '[promociones] no se pudo leer el envío gratis',
      error.message,
    );
    return [];
  }
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    minItemsCents: row.min_items_cents,
    zones: row.zones.filter((zone): zone is ShippingPromotionZone =>
      (SHIPPING_PROMOTION_ZONES as readonly string[]).includes(zone),
    ),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    active: row.active,
    createdAt: row.created_at,
    uses: row.uses,
    paidUses: row.paid_uses,
    paidWaivedCents: Number(row.paid_waived_cents),
  }));
}

/** Una promoción de envío gratis con sus usos, o null si no existe o no hay permiso. */
export async function getShippingPromotion(
  supabase: Supabase,
  id: string,
): Promise<ShippingPromotion | null> {
  const promotions = await listShippingPromotions(supabase);
  return promotions.find((promotion) => promotion.id === id) ?? null;
}
