'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { ActionState } from '@/modules/admin';
import { describeDbError, fail, ok } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { WATCH_SETTING_LIMITS } from '../domain/watch-snapshot';

/** Parámetros del vigilante: configuración del negocio (settings.manage, con MFA). */

const limited = (key: keyof typeof WATCH_SETTING_LIMITS) =>
  z.coerce
    .number()
    .int()
    .min(WATCH_SETTING_LIMITS[key].min)
    .max(WATCH_SETTING_LIMITS[key].max);

const settingsInput = z.object({
  salesWindowDays: limited('salesWindowDays'),
  targetCoverDays: limited('targetCoverDays'),
  safetyDays: limited('safetyDays'),
  deadStockDays: limited('deadStockDays'),
});

export async function saveWatchSettings(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase } = await requirePermission('settings.manage');
  const parsed = settingsInput.safeParse({
    salesWindowDays: formData.get('salesWindowDays'),
    targetCoverDays: formData.get('targetCoverDays'),
    safetyDays: formData.get('safetyDays'),
    deadStockDays: formData.get('deadStockDays'),
  });
  if (!parsed.success) {
    return fail('Revisa los días: alguno está fuera de los límites.');
  }
  const s = parsed.data;
  const { error } = await supabase.rpc('admin_set_stock_watch_settings', {
    p_sales_window_days: s.salesWindowDays,
    p_target_cover_days: s.targetCoverDays,
    p_safety_days: s.safetyDays,
    p_dead_stock_days: s.deadStockDays,
  });
  if (error) return fail(describeDbError(error));
  revalidatePath('/admin/reposicion');
  return ok('Parámetros guardados. Las alertas ya se calculan con ellos.');
}
