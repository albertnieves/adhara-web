import { formatEuros } from '@/lib/money';
import { escapeHtml, fill } from './text';

/*
 * Correos de los pedidos web (P06, DECISIONS §138): confirmación del pago
 * (con las condiciones de venta adjuntas, en soporte duradero), aviso de
 * «listo para recoger» y de «enviado». Puro: recibe lo que da la cola de la
 * base (web_order_emails_claim) y los textos del idioma del pedido.
 */

export const ORDER_EMAIL_KINDS = [
  'order_paid',
  'ready_for_pickup',
  'shipped',
] as const;
export type OrderEmailKind = (typeof ORDER_EMAIL_KINDS)[number];

/** Una fila de web_order_emails_claim. */
export type OrderEmailJob = {
  id: number;
  kind: OrderEmailKind;
  number: number;
  locale: 'es' | 'ca' | 'en';
  fulfillment: 'click_collect' | 'shipping';
  items_cents: number;
  shipping_cents: number;
  total_cents: number;
  tracking_reference: string | null;
  full_name: string;
  email: string;
  address: {
    line1: string | null;
    line2: string | null;
    postal_code: string | null;
    city: string | null;
    province: string | null;
  } | null;
  lines: {
    brand: string;
    name: string;
    size_ml: number | null;
    label: string | null;
    quantity: number;
    line_total_cents: number;
  }[];
};

/** Textos del espacio `email` de messages/{es,ca,en}.json. */
export type EmailCopy = Readonly<Record<string, string>>;

/**
 * Colores del correo: los clientes de correo no leen variables CSS, así que
 * van los valores de marfil, papel, tinta, línea y humo de globals.css
 * (tests/unit/order-email.test.ts comprueba que siguen siendo esos).
 */
export const EMAIL_COLORS = {
  ivory: '#f5f1ea',
  paper: '#fdfcf9',
  ink: '#151311',
  line: '#ddd5c8',
  smoke: '#6b645b',
} as const;

export type OrderEmailContext = {
  copy: EmailCopy;
  store: { address: string; hours: string; email: string };
  seller: { holder: string; taxId: string; address: string } | null;
  /** URL de «Envíos y devoluciones» en el idioma del pedido. */
  returnsUrl: string;
  /** Condiciones de venta en texto plano (solo para la confirmación). */
  terms: string | null;
};

export type RenderedEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments: { filename: string; content: string }[];
};

function shippingAddress(job: OrderEmailJob) {
  const a = job.address;
  if (!a) return '';
  return [
    a.line1,
    a.line2,
    [a.postal_code, a.city].filter(Boolean).join(' '),
    a.province,
  ]
    .filter((part) => part && part.trim())
    .join(', ');
}

export function renderOrderEmail(
  job: OrderEmailJob,
  ctx: OrderEmailContext,
): RenderedEmail {
  const t = (key: string, values: Record<string, string> = {}) =>
    fill(ctx.copy[key], values);
  const money = (cents: number) => formatEuros(cents, job.locale);
  const number = String(job.number);
  const address =
    job.fulfillment === 'shipping' ? shippingAddress(job) : ctx.store.address;

  const subject = {
    order_paid: t('subjectPaid', { number }),
    ready_for_pickup: t('subjectReady', { number }),
    shipped: t('subjectShipped', { number }),
  }[job.kind];

  // Párrafos del cuerpo, en texto; el resumen va aparte.
  const intro: string[] = [];
  if (job.kind === 'order_paid') {
    intro.push(t('paidLead', { number }));
    intro.push(
      job.fulfillment === 'shipping'
        ? t('shippingNext', { address })
        : t('pickupNext', { address }),
    );
  } else if (job.kind === 'ready_for_pickup') {
    intro.push(t('readyLead', { number, address }));
    if (ctx.store.hours.trim())
      intro.push(t('readyHours', { hours: ctx.store.hours.trim() }));
    intro.push(t('readyBring'));
  } else {
    intro.push(t('shippedLead', { number, address }));
    if (job.tracking_reference)
      intro.push(t('tracking', { tracking: job.tracking_reference }));
  }

  const rows: [string, string][] = [
    ...job.lines.map((line): [string, string] => [
      `${line.brand} · ${line.name}${line.label ? ` ${line.label}` : line.size_ml ? ` ${line.size_ml} ml` : ''} × ${line.quantity}`,
      money(line.line_total_cents),
    ]),
    [t('items'), money(job.items_cents)],
    [
      job.fulfillment === 'shipping' ? t('shipping') : t('pickup'),
      job.shipping_cents === 0 ? t('free') : money(job.shipping_cents),
    ],
    [t('total'), money(job.total_cents)],
  ];

  const legal: string[] = [];
  if (job.kind === 'order_paid') {
    legal.push(t('withdrawal', { url: ctx.returnsUrl }));
    if (ctx.seller)
      legal.push(
        t('seller', {
          holder: ctx.seller.holder,
          taxId: ctx.seller.taxId,
          address: ctx.seller.address,
        }),
      );
  }
  const contact = t('contact', { email: ctx.store.email });
  const greeting = t('greeting', { name: job.full_name });

  const text = [
    greeting,
    ...intro,
    `${t('summary')} (${number})\n${rows.map(([a, b]) => `${a}: ${b}`).join('\n')}`,
    ...legal,
    contact,
    t('signature'),
  ].join('\n\n');

  const p = (s: string) =>
    `<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(s)}</p>`;
  const html = `<!doctype html><html lang="${job.locale}"><body style="margin:0;padding:24px;background:${EMAIL_COLORS.ivory};color:${EMAIL_COLORS.ink};font-family:Helvetica,Arial,sans-serif;font-size:15px"><div style="max-width:560px;margin:0 auto;background:${EMAIL_COLORS.paper};padding:32px"><p style="margin:0 0 24px;font-family:Georgia,serif;font-size:22px">L’Atelier du Désert</p>${p(greeting)}${intro.map(p).join('')}<table role="presentation" style="width:100%;border-collapse:collapse;margin:8px 0 24px">${rows
    .map(
      ([a, b], i) =>
        `<tr><td style="padding:6px 0;border-top:1px solid ${EMAIL_COLORS.line}${i === rows.length - 1 ? ';font-weight:bold' : ''}">${escapeHtml(a)}</td><td style="padding:6px 0;border-top:1px solid ${EMAIL_COLORS.line};text-align:right;white-space:nowrap${i === rows.length - 1 ? ';font-weight:bold' : ''}">${escapeHtml(b)}</td></tr>`,
    )
    .join(
      '',
    )}</table>${legal.map(p).join('')}${p(contact)}<p style="margin:24px 0 0;color:${EMAIL_COLORS.smoke};font-size:13px">${escapeHtml(t('signature'))}</p></div></body></html>`;

  return {
    to: job.email,
    subject,
    text,
    html,
    attachments:
      job.kind === 'order_paid' && ctx.terms
        ? [{ filename: t('attachment'), content: ctx.terms }]
        : [],
  };
}
