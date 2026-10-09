import { z } from 'zod';

/*
 * Suscripción a las promociones de la tienda (sección antes del pie). La
 * base de datos guarda la lista y la versión del texto aceptado; los correos
 * se envían desde Sender (sender.net). Cambiar el texto del consentimiento en
 * messages/ exige subir esta versión para poder demostrar qué se aceptó.
 */
export const CONSENT_VERSION = 'promos-2026-10';

export const subscribeInput = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  consent: z.literal('on'),
  locale: z.enum(['es', 'ca', 'en']),
});

export type SubscribeStatus =
  'idle' | 'success' | 'invalidEmail' | 'consentRequired' | 'busy' | 'error';

export type SubscribeState = { status: SubscribeStatus };

export type Subscriber = {
  id: string;
  email: string;
  locale: string;
  source: string;
  consentVersion: string;
  consentedAt: string;
  unsubscribedAt: string | null;
  senderSyncedAt: string | null;
};

export const LOCALE_NAMES: Record<string, string> = {
  es: 'Español',
  ca: 'Català',
  en: 'English',
};

/** Estado que ve el personal: baja, pendiente de enviar a Sender o en Sender. */
export function subscriberStatus(
  subscriber: Pick<Subscriber, 'unsubscribedAt' | 'senderSyncedAt'>,
): 'unsubscribed' | 'pending' | 'synced' {
  if (subscriber.unsubscribedAt) return 'unsubscribed';
  return subscriber.senderSyncedAt ? 'synced' : 'pending';
}
