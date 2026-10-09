import 'server-only';

/*
 * Sender (sender.net), el servicio de email marketing con el que se envían
 * las promociones. Solo servidor: SENDER_API_TOKEN (token de la API, en
 * Sender → Settings → API access tokens) y, opcional, SENDER_GROUP_ID (grupo
 * al que se añaden los suscriptores de la web). Sin token, la web guarda la
 * lista igualmente y el panel la exporta en CSV para importarla en Sender.
 */
const ENDPOINT = 'https://api.sender.net/v2/subscribers';

export function senderConfigured(): boolean {
  return Boolean(process.env.SENDER_API_TOKEN?.trim());
}

async function call(
  method: 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body: object,
): Promise<boolean> {
  const token = process.env.SENDER_API_TOKEN?.trim();
  if (!token) return false;
  try {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
      cache: 'no-store',
    });
    if (!response.ok) {
      // Sin el email ni el token en el registro.
      console.error('[newsletter] Sender respondió', response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      '[newsletter] no se pudo contactar con Sender',
      error instanceof Error ? error.name : 'error',
    );
    return false;
  }
}

/** Alta o actualización en Sender. Devuelve si Sender la aceptó. */
export function addToSender(email: string): Promise<boolean> {
  const group = process.env.SENDER_GROUP_ID?.trim();
  return call('POST', ENDPOINT, {
    email,
    ...(group ? { groups: [group] } : {}),
    trigger_automation: true,
  });
}

/** Baja en Sender: deja de recibir campañas, pero conserva su historial. */
export function unsubscribeInSender(email: string): Promise<boolean> {
  return call('PATCH', `${ENDPOINT}/${encodeURIComponent(email)}`, {
    subscriber_status: 'UNSUBSCRIBED',
    trigger_automation: false,
  });
}

/** Borrado en Sender (derecho de supresión). */
export function deleteFromSender(email: string): Promise<boolean> {
  return call('DELETE', ENDPOINT, { subscribers: [email] });
}
