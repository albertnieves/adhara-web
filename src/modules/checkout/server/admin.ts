import 'server-only';
import type { StaffContext } from '@/modules/auth/server';
import type { ShippingZone } from '../domain/shipping';
import { SHIPPING_ZONES } from '../domain/shipping';

export type AdminShippingRate = {
  zone: ShippingZone;
  priceCents: number;
  freeFromCents: number | null;
  active: boolean;
  updatedAt: string;
};

/** Tarifas de envío para el panel (el personal ve también las apagadas). */
export async function listShippingRates(
  supabase: StaffContext['supabase'],
): Promise<AdminShippingRate[]> {
  const { data, error } = await supabase
    .from('shipping_rates')
    .select('zone, price_cents, free_from_cents, active, updated_at');
  if (error) throw new Error(error.message);
  return data
    .filter((row): row is typeof row & { zone: ShippingZone } =>
      (SHIPPING_ZONES as readonly string[]).includes(row.zone),
    )
    .map((row) => ({
      zone: row.zone,
      priceCents: row.price_cents,
      freeFromCents: row.free_from_cents,
      active: row.active,
      updatedAt: row.updated_at,
    }));
}
