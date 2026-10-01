import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

/*
 * Cliente de Claude para el asistente. La clave (ANTHROPIC_API_KEY) solo está
 * en el servidor; sin ella el informe diario sigue funcionando sin resumen y
 * el chat se muestra como «no configurado».
 */

export const ASSISTANT_MODEL = 'claude-opus-5-5';

/**
 * Si el modelo rechaza una petición por sus salvaguardas, la API la repite con
 * el modelo de respaldo que corresponda (beta de respaldo en servidor).
 */
export const FALLBACK_PARAMS = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
} as const;

/** Guardar informes necesita la clave privilegiada del servidor. */
export function canStoreReports(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

export function isAssistantConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function createAnthropic(): Anthropic | null {
  if (!isAssistantConfigured()) return null;
  return new Anthropic({ maxRetries: 2, timeout: 120_000 });
}

/** Mensaje para el personal ante un fallo de la API, sin detalles internos. */
export function describeAssistantError(error: unknown): string {
  if (error instanceof Anthropic.RateLimitError)
    return 'El asistente está saturado ahora mismo. Prueba de nuevo en un minuto.';
  if (error instanceof Anthropic.AuthenticationError)
    return 'La clave del asistente no es válida. Revisa ANTHROPIC_API_KEY en el servidor.';
  if (error instanceof Anthropic.APIConnectionError)
    return 'No se pudo conectar con el asistente. Revisa la conexión y prueba de nuevo.';
  if (error instanceof Anthropic.APIError)
    return `El asistente no pudo responder (error ${error.status ?? 'desconocido'}).`;
  return 'El asistente no pudo responder.';
}
