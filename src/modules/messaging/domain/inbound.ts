import { z } from 'zod';

/*
 * Correo entrante con Resend Inbound (A6.1, DECISIONS §155). Puro: lee el
 * evento email.received y el correo de su API, encuentra la clave de la
 * dirección de respuesta y deja el texto que escribió el cliente, sin el
 * hilo citado. Nunca se guarda HTML: si el correo no trae texto, se saca
 * del HTML.
 */

/** Dirección de respuesta de una conversación: consulta-<clave>@<subdominio>. */
export function replyAddress(token: string, domain: string): string {
  return `consulta-${token}@${domain}`;
}

const TOKEN_ADDRESS = /^consulta-([0-9a-f]{32})@([^@\s]+)$/;

/** «Nombre <dirección>» o la dirección sola → la dirección en minúsculas. */
export function bareAddress(value: string): string {
  const match = /<([^<>\s]+)>\s*$/.exec(value);
  return (match?.[1] ?? value).trim().toLowerCase();
}

/** El nombre de «Nombre <dirección>», sin comillas; null si no hay. */
export function displayName(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^\s*"?([^"<]*?)"?\s*<[^<>]+>\s*$/.exec(value);
  const name = match?.[1]?.trim();
  return name ? name.slice(0, 120) : null;
}

/** Clave de la primera dirección de respuesta del subdominio (si se conoce). */
export function findReplyToken(
  addresses: readonly string[],
  domain: string | null,
): string | null {
  for (const address of addresses) {
    const match = TOKEN_ADDRESS.exec(bareAddress(address));
    if (match && (!domain || match[2] === domain.toLowerCase()))
      return match[1]!;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Evento y correo de Resend
// ---------------------------------------------------------------------------

const addressList = z.array(z.string()).catch([]);

const receivedEvent = z.object({
  type: z.literal('email.received'),
  data: z.object({
    email_id: z.string().min(1).max(200),
    from: z.string().max(400),
    to: addressList,
    cc: addressList.optional(),
    received_for: addressList.optional(),
  }),
});

export type ReceivedEmailEvent = {
  emailId: string;
  recipients: string[];
};

/**
 * El evento firmado: solo interesa email.received. null si es otro tipo de
 * evento; lanza si no tiene la forma esperada.
 */
export function parseReceivedEvent(json: unknown): ReceivedEmailEvent | null {
  if (
    typeof json === 'object' &&
    json !== null &&
    (json as { type?: unknown }).type !== 'email.received'
  )
    return null;
  const event = receivedEvent.parse(json);
  return {
    emailId: event.data.email_id,
    recipients: [
      ...event.data.to,
      ...(event.data.cc ?? []),
      ...(event.data.received_for ?? []),
    ],
  };
}

const receivedEmail = z.object({
  from: z.string().max(400),
  subject: z.string().nullish(),
  text: z.string().nullish(),
  html: z.string().nullish(),
  message_id: z.string().nullish(),
  headers: z.record(z.string(), z.unknown()).nullish(),
  to: addressList.optional(),
  cc: addressList.optional(),
  received_for: addressList.optional(),
  attachments: z.array(z.unknown()).nullish(),
  authentication: z.object({ dmarc: z.string().nullish() }).nullish(),
});

export type InboundEmail = {
  fromEmail: string;
  fromName: string | null;
  subject: string;
  body: string;
  messageId: string | null;
  attachments: number;
  /** DMARC no falla (sin resultado, se da por bueno: el remitente lo decide la clave). */
  trusted: boolean;
  recipients: string[];
};

export const INBOUND_BODY_MAX = 10_000;

/** El correo leído de la API de Resend, listo para la base. */
export function readReceivedEmail(json: unknown): InboundEmail {
  const email = receivedEmail.parse(json);
  const headerFrom = email.headers?.from;
  const text = email.text?.trim()
    ? email.text
    : email.html
      ? htmlToText(email.html)
      : '';
  return {
    fromEmail: bareAddress(email.from),
    fromName:
      displayName(typeof headerFrom === 'string' ? headerFrom : null) ??
      displayName(email.from),
    subject: (email.subject ?? '').trim().slice(0, 200),
    body: stripQuotedReply(text).slice(0, INBOUND_BODY_MAX),
    messageId: email.message_id?.trim().slice(0, 300) || null,
    attachments: Math.min(email.attachments?.length ?? 0, 100),
    trusted: email.authentication?.dmarc !== 'fail',
    recipients: [
      ...(email.to ?? []),
      ...(email.cc ?? []),
      ...(email.received_for ?? []),
    ],
  };
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

const ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

/** Texto de un correo que solo trae HTML (no se guarda ni se pinta el HTML). */
export function htmlToText(html: string): string {
  return html
    .replace(/<(head|style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] === '#') {
        const point =
          code[1] === 'x' || code[1] === 'X'
            ? Number.parseInt(code.slice(2), 16)
            : Number.parseInt(code.slice(1), 10);
        return Number.isFinite(point) && point > 0 && point <= 0x10ffff
          ? String.fromCodePoint(point)
          : whole;
      }
      return ENTITIES[code.toLowerCase()] ?? whole;
    })
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Cabeceras con las que los programas de correo introducen el mensaje citado.
const QUOTE_HEADERS = [
  /^on .{4,300} wrote:$/i,
  /^el .{4,300} (escribió|va escriure|escribio):$/i,
  /^le .{4,300} a écrit\s?:$/i,
  /^-{2,}\s*(original message|mensaje original|missatge original)\s*-{2,}$/i,
  /^_{10,}$/,
];

/**
 * Lo que escribió el cliente, sin el hilo citado debajo. Si al recortar no
 * quedara nada, se deja el texto entero: nunca se pierde un mensaje.
 */
export function stripQuotedReply(input: string): string {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  let cut = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]!.trim();
    // Gmail parte a veces la cabecera en dos líneas («… <email>» / «wrote:»).
    const joined = `${line} ${lines[i + 1]?.trim() ?? ''}`.trim();
    if (QUOTE_HEADERS.some((re) => re.test(line) || re.test(joined))) {
      cut = i;
      break;
    }
  }
  let kept = lines.slice(0, cut);
  // Bloque final de líneas citadas con «>».
  let end = kept.length;
  while (end > 0 && /^\s*(>.*)?$/.test(kept[end - 1]!)) end -= 1;
  if (
    end < kept.length &&
    kept.slice(end).some((l) => l.trim().startsWith('>'))
  )
    kept = kept.slice(0, end);
  const text = kept
    .join('\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  return text || input.replace(/\r\n?/g, '\n').trim();
}
