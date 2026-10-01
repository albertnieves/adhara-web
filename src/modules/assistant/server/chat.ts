import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { ROLE_LABELS } from '@/modules/auth';
import type { StaffContext } from '@/modules/auth/server';
import { madridMidnight } from '@/modules/inventory';
import { madridDay } from '@/modules/reports';
import { CHAT_SYSTEM, chatContext } from '../domain/prompts';
import {
  ASSISTANT_MODEL,
  FALLBACK_PARAMS,
  createAnthropic,
  describeAssistantError,
} from './claude';
import { assistantTools } from './tools';

/** Conversación que envía el navegador: solo texto, acotada. */
export const chatRequest = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().trim().min(1).max(4000),
      }),
    )
    .min(1)
    .max(20)
    .refine(
      (list) => list[0]?.role === 'user' && list.at(-1)?.role === 'user',
      'La conversación empieza y termina con una pregunta',
    ),
});
export type ChatRequest = z.infer<typeof chatRequest>;

/** Eventos de la respuesta, una línea JSON por evento. */
export type ChatEvent =
  | { t: 'tool'; label: string }
  | { t: 'text'; d: string }
  | { t: 'done' }
  | { t: 'error'; m: string };

const MAX_ITERATIONS = 8;

function dailyLimit() {
  const value = Number(process.env.ASSISTANT_DAILY_LIMIT);
  return Number.isInteger(value) && value > 0 ? value : 40;
}

class TruncatedToolInput extends Error {}

/**
 * Responde a una pregunta con las herramientas de solo lectura de la sesión.
 * Emite el texto a medida que llega y registra el uso al terminar.
 */
export async function* runChat(
  staff: StaffContext,
  request: ChatRequest,
  now = new Date(),
): AsyncGenerator<ChatEvent> {
  const client = createAnthropic();
  if (!client) {
    yield {
      t: 'error',
      m: 'El asistente no está configurado: falta ANTHROPIC_API_KEY en el servidor.',
    };
    return;
  }

  const today = madridDay(now);
  const { count } = await staff.supabase
    .from('assistant_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', staff.userId)
    .eq('kind', 'chat')
    .gte('created_at', madridMidnight(today));
  if ((count ?? 0) >= dailyLimit()) {
    yield {
      t: 'error',
      m: `Has llegado al tope de ${dailyLimit()} consultas de hoy. Mañana se reinicia.`,
    };
    return;
  }

  const { tools, labels } = assistantTools(staff, now);
  const history = request.messages.slice(0, -1);
  const question = request.messages.at(-1)!.content;
  const usage = { input: 0, output: 0, cacheRead: 0 };
  const used: string[] = [];
  let stopReason: string | null = null;

  let runner = client.beta.messages.toolRunner({
    ...FALLBACK_PARAMS,
    betas: [...FALLBACK_PARAMS.betas],
    model: ASSISTANT_MODEL,
    max_tokens: 64000,
    max_iterations: MAX_ITERATIONS,
    output_config: { effort: 'medium' },
    // Caché automática: el system y las herramientas se repiten en cada vuelta.
    cache_control: { type: 'ephemeral' },
    system: CHAT_SYSTEM,
    tools,
    messages: [
      ...history.map((m) => ({ role: m.role, content: m.content })),
      {
        role: 'user' as const,
        content: [
          {
            type: 'text' as const,
            text: chatContext({
              today,
              roleLabel: ROLE_LABELS[staff.role],
              tools: Object.keys(labels),
            }),
          },
          { type: 'text' as const, text: question },
        ],
      },
    ],
    stream: true,
  });

  try {
    for (let attempt = 0; ; attempt++) {
      try {
        for await (const stream of runner) {
          for await (const event of stream) {
            if (
              event.type === 'content_block_start' &&
              event.content_block.type === 'tool_use'
            ) {
              used.push(event.content_block.name);
              yield {
                t: 'tool',
                label: labels[event.content_block.name] ?? 'Consultando datos',
              };
            } else if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              yield { t: 'text', d: event.delta.text };
            }
          }
          const message = await stream.finalMessage();
          attempt = 0;
          usage.input += message.usage.input_tokens;
          usage.output += message.usage.output_tokens;
          usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;
          stopReason = message.stop_reason;
          const hasToolUse = message.content.some((b) => b.type === 'tool_use');
          if (message.stop_reason === 'max_tokens' && hasToolUse)
            throw new TruncatedToolInput();
          if (message.stop_reason === 'refusal') {
            yield {
              t: 'error',
              m: 'El asistente no puede responder a esta pregunta.',
            };
            break;
          }
        }
        break;
      } catch (error) {
        // Solo se repite la vuelta cuando la entrada de una herramienta no
        // llegó como JSON válido; los errores de la API se informan.
        if (
          error instanceof Anthropic.APIError ||
          error instanceof TruncatedToolInput ||
          attempt >= 2
        )
          throw error;
        runner = client.beta.messages.toolRunner({ ...runner.params });
      }
    }
    yield { t: 'done' };
  } catch (error) {
    console.error('[asistente] chat', error);
    yield {
      t: 'error',
      m:
        error instanceof TruncatedToolInput
          ? 'La respuesta se cortó. Prueba con una pregunta más concreta.'
          : describeAssistantError(error),
    };
  } finally {
    const { error } = await staff.supabase.from('assistant_usage').insert({
      user_id: staff.userId,
      kind: 'chat',
      model: ASSISTANT_MODEL,
      input_tokens: usage.input,
      output_tokens: usage.output,
      cache_read_tokens: usage.cacheRead,
      tools: used.slice(0, 50),
      stop_reason: stopReason,
    });
    if (error) console.error('[asistente] uso', error.message);
  }
}
