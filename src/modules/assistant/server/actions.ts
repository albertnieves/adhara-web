'use server';

import { revalidatePath } from 'next/cache';
import { createJobClient } from '@/lib/supabase/privileged';
import type { ActionState } from '@/modules/admin';
import { fail, ok } from '@/modules/admin';
import { requirePermission } from '@/modules/auth/server';
import { madridMidnight } from '@/modules/inventory';
import { madridDay } from '@/modules/reports';
import { isReportDay } from '../domain/daily-report';
import { generateAndStoreDailyReport } from './store';

/** Resúmenes bajo demanda por persona y día (cada uno es una llamada a Claude). */
const MAX_MANUAL_PER_DAY = 10;

/**
 * Genera, resume y guarda el informe de un día desde el panel. Requiere
 * reports.view con MFA (administradores; cada resumen es una llamada a
 * Claude); los datos se calculan en el servidor.
 */
export async function generateDailyReportNow(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const staff = await requirePermission('reports.view');
  const day = formData.get('day');
  const today = madridDay(new Date());
  if (!isReportDay(day) || day > today) return fail('Elige un día válido.');

  const job = createJobClient();
  if (job) {
    const { count } = await job
      .from('assistant_usage')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', staff.userId)
      .eq('kind', 'daily_summary')
      .gte('created_at', madridMidnight(today));
    if ((count ?? 0) >= MAX_MANUAL_PER_DAY)
      return fail(
        `Ya has generado ${MAX_MANUAL_PER_DAY} informes hoy. El de mañana llegará solo.`,
      );
  }

  try {
    const result = await generateAndStoreDailyReport({
      day,
      generatedBy: staff.userId,
    });
    if (!result.ok) return fail(result.message);
    revalidatePath('/admin/asistente');
    revalidatePath('/admin');
    return ok(result.note ?? 'Informe guardado con el resumen del asistente.');
  } catch (error) {
    console.error('[asistente] generar informe', error);
    return fail('No se pudo generar el informe. Prueba de nuevo.');
  }
}
