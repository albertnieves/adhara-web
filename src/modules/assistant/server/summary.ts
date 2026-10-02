import 'server-only';
import type Anthropic from '@anthropic-ai/sdk';
import type { DailyReport } from '../domain/daily-report';
import { DAILY_SUMMARY_SYSTEM } from '../domain/prompts';
import { ASSISTANT_MODEL, FALLBACK_PARAMS } from './claude';

export type SummaryResult = {
  /** null si el modelo declina o no devuelve texto. */
  text: string | null;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    stopReason: string | null;
  };
};

/**
 * Resumen del informe diario redactado por Claude. Una sola llamada, sin
 * herramientas: el informe ya trae todos los datos.
 */
export async function summarizeDailyReport(
  client: Anthropic,
  report: DailyReport,
): Promise<SummaryResult> {
  const response = await client.beta.messages.create({
    ...FALLBACK_PARAMS,
    betas: [...FALLBACK_PARAMS.betas],
    model: ASSISTANT_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium' },
    system: DAILY_SUMMARY_SYSTEM,
    messages: [
      {
        role: 'user',
        content: `Informe del día ${report.day} (${report.location}):\n${JSON.stringify(report)}`,
      },
    ],
  });
  const usage = {
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
    cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    stopReason: response.stop_reason,
  };
  const text =
    response.stop_reason === 'refusal'
      ? ''
      : response.content
          .flatMap((block) => (block.type === 'text' ? [block.text] : []))
          .join('\n')
          .trim();
  return {
    text: text ? text.slice(0, 8000) : null,
    model: response.model,
    usage,
  };
}
