import 'server-only';
import { createJobClient } from '@/lib/supabase/privileged';
import type { DailyReport } from '../domain/daily-report';
import { collectDailyReport } from './daily-report';
import { createAnthropic, describeAssistantError } from './claude';
import { summarizeDailyReport } from './summary';

export type GenerateResult =
  | {
      ok: true;
      report: DailyReport;
      summary: string | null;
      /** Por qué no hay resumen, si no lo hay. */
      note: string | null;
    }
  | { ok: false; message: string };

/**
 * Genera, resume y guarda el informe de un día. Solo se llama desde la tarea
 * programada (tras CRON_SECRET) o desde una acción que ya autorizó agent.use
 * con MFA; los datos se leen y se escriben en el servidor, nunca llegan del
 * navegador.
 */
export async function generateAndStoreDailyReport({
  day,
  generatedBy,
  now = new Date(),
}: {
  day: string;
  generatedBy: string | null;
  now?: Date;
}): Promise<GenerateResult> {
  const job = createJobClient();
  if (!job)
    return {
      ok: false,
      message:
        'Falta SUPABASE_SECRET_KEY en el servidor: el informe se ve en directo, pero no se puede guardar.',
    };
  const collected = await collectDailyReport(job, day, now);
  if (!collected)
    return { ok: false, message: 'No hay ninguna ubicación activa.' };
  const { report, locationId } = collected;

  let summary: string | null = null;
  let model: string | null = null;
  let note: string | null = null;
  const claude = createAnthropic();
  if (!claude) {
    note =
      'Sin ANTHROPIC_API_KEY en el servidor: el informe se guarda sin resumen del asistente.';
  } else {
    try {
      const result = await summarizeDailyReport(claude, report);
      summary = result.text;
      model = result.model;
      if (!summary)
        note = 'El asistente no pudo redactar el resumen de este informe.';
      const usage = await job.from('assistant_usage').insert({
        user_id: generatedBy,
        kind: 'daily_summary',
        model: result.model,
        input_tokens: result.usage.inputTokens,
        output_tokens: result.usage.outputTokens,
        cache_read_tokens: result.usage.cacheReadTokens,
        stop_reason: result.usage.stopReason,
      });
      if (usage.error) console.error('[asistente] uso', usage.error.message);
    } catch (error) {
      console.error('[asistente] resumen diario', error);
      note = describeAssistantError(error);
    }
  }

  const { error } = await job.from('daily_reports').upsert(
    {
      location_id: locationId,
      report_date: report.day,
      facts: report,
      summary,
      summary_model: summary ? model : null,
      summary_at: summary ? new Date().toISOString() : null,
      generated_at: report.generatedAt,
      generated_by: generatedBy,
    },
    { onConflict: 'location_id,report_date' },
  );
  if (error) throw new Error(error.message);
  return { ok: true, report, summary, note };
}
