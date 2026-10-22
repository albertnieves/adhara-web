import { z } from 'zod';
import { TOPICS } from './conversations';

/*
 * Formulario de contacto de la tienda (A6.1). Las claves de error son las de
 * messages/*.json → contact.errors. La base vuelve a validarlo todo
 * (web_contact_submit) y aplica los límites por email y globales.
 */

export const CONTACT_ERRORS = [
  'nameRequired',
  'emailInvalid',
  'messageRequired',
  'messageTooLong',
  'orderNumberInvalid',
  'busy',
  'disabled',
  'generic',
] as const;
export type ContactError = (typeof CONTACT_ERRORS)[number];

export const CONTACT_MESSAGE_MAX = 5000;

const text = (max: number) => z.string().trim().max(max);

export const contactInput = z.object({
  requestId: z.uuid(),
  locale: z.enum(['es', 'ca', 'en']),
  topic: z.enum(TOPICS),
  fullName: text(120).min(1, 'nameRequired'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, 'emailInvalid')
    .pipe(z.email('emailInvalid')),
  // Opcional: «1001», «Nº 1001» o «#1001».
  orderNumber: z
    .string()
    .trim()
    .transform((value) => value.replace(/^(n[º°o.]*|#)\s*/i, ''))
    .refine((value) => value === '' || /^[0-9]{1,12}$/.test(value), {
      message: 'orderNumberInvalid',
    })
    .transform((value) => (value === '' ? null : Number(value))),
  subject: text(200),
  message: z
    .string()
    .trim()
    .min(1, 'messageRequired')
    .max(CONTACT_MESSAGE_MAX, 'messageTooLong'),
});
export type ContactInput = z.infer<typeof contactInput>;
export type ContactField = keyof ContactInput;

export type ContactState =
  | { status: 'idle' }
  | { status: 'sent'; number: number | null }
  | {
      status: 'error';
      error: ContactError;
      fields?: Partial<Record<ContactField, ContactError>>;
    };

/** Primer error de cada campo, con la clave de messages/*.json. */
export function contactFieldErrors(
  issues: readonly { path: readonly PropertyKey[]; message: string }[],
): Partial<Record<ContactField, ContactError>> {
  const fields: Partial<Record<ContactField, ContactError>> = {};
  for (const issue of issues) {
    const field = issue.path[0] as ContactField | undefined;
    if (!field || fields[field]) continue;
    fields[field] = (CONTACT_ERRORS as readonly string[]).includes(
      issue.message,
    )
      ? (issue.message as ContactError)
      : 'generic';
  }
  return fields;
}
