import { z } from 'zod';
import type { DiscountError } from '@/modules/promotions/domain';
import { normalizeDiscountCode } from '@/modules/promotions/domain';
import { isPostalCode, shippingZone } from './shipping';

/*
 * Datos del formulario de «Finalizar compra». Los artículos no van aquí:
 * salen de la cesta (cookie) en el servidor. Las claves de error son las de
 * messages/*.json → checkout.errors.
 */

export const CHECKOUT_ERRORS = [
  'nameRequired',
  'emailInvalid',
  'phoneInvalid',
  'phoneRequired',
  'addressRequired',
  'postalCodeInvalid',
  'zoneUnavailable',
  'cityRequired',
  'termsRequired',
  'emptyCart',
  'cartChanged',
  'outOfStock',
  'shippingUnavailable',
  'unavailable',
  'discount',
  'disabled',
  'generic',
] as const;
export type CheckoutError = (typeof CHECKOUT_ERRORS)[number];

const PHONE = /^[0-9 +().-]{6,30}$/;

const text = (max: number) => z.string().trim().max(max);

export const checkoutInput = z
  .object({
    requestId: z.uuid(),
    locale: z.enum(['es', 'ca', 'en']),
    fulfillment: z.enum(['click_collect', 'shipping']),
    fullName: text(120).min(1, 'nameRequired'),
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(254, 'emailInvalid')
      .pipe(z.email('emailInvalid')),
    phone: text(30).refine((v) => !v || PHONE.test(v), 'phoneInvalid'),
    addressLine1: text(200),
    addressLine2: text(200),
    postalCode: text(5),
    city: text(120),
    province: text(120),
    acceptTerms: z.literal('on', { message: 'termsRequired' }),
    // Código ya aplicado en el resumen; la base lo vuelve a comprobar todo.
    discountCode: z
      .string()
      .trim()
      .max(60)
      .optional()
      .transform((value, ctx) => {
        if (!value) return null;
        const code = normalizeDiscountCode(value);
        if (!code) {
          ctx.addIssue({ code: 'custom', message: 'discount' });
          return z.NEVER;
        }
        return code;
      }),
  })
  .superRefine((input, ctx) => {
    if (input.fulfillment !== 'shipping') return;
    const issue = (path: string, message: CheckoutError) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (!input.phone) issue('phone', 'phoneRequired');
    if (!input.addressLine1) issue('addressLine1', 'addressRequired');
    if (!input.city) issue('city', 'cityRequired');
    if (!isPostalCode(input.postalCode))
      issue('postalCode', 'postalCodeInvalid');
    else if (!shippingZone(input.postalCode))
      issue('postalCode', 'zoneUnavailable');
  });
export type CheckoutInput = z.infer<typeof checkoutInput>;

export type CheckoutField = keyof CheckoutInput;

/** Formulario firmado que el navegador envía al banco (P04). */
export type PaymentRedirect = {
  url: string;
  fields: Readonly<Record<string, string>>;
};

export type CheckoutState =
  | { status: 'idle' }
  | {
      status: 'error';
      error: CheckoutError;
      fields?: Partial<Record<CheckoutField, CheckoutError>>;
      /** Perfume que falta en outOfStock, si se sabe. */
      product?: string;
      /** Motivo en `discount`: el código ya no vale (usado, agotado…). */
      discount?: DiscountError;
      /** Compra mínima del código en `discount` → minimum. */
      minimumCents?: number;
    }
  /** Pedido creado: el navegador va al banco a pagarlo. */
  | { status: 'redirect'; number: number; form: PaymentRedirect }
  /** Pedido creado sin TPV configurado: queda pendiente de pago. */
  | {
      status: 'placed';
      number: number;
      fulfillment: 'click_collect' | 'shipping';
      itemsCents: number;
      discountCents: number;
      shippingCents: number;
      totalCents: number;
      reservedUntil: string;
    };

/** Primer mensaje de cada campo, para el formulario. */
export function fieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Partial<Record<CheckoutField, CheckoutError>> {
  const errors: Partial<Record<CheckoutField, CheckoutError>> = {};
  for (const issue of issues) {
    const field = issue.path[0] as CheckoutField | undefined;
    const message = (CHECKOUT_ERRORS as readonly string[]).includes(
      issue.message,
    )
      ? (issue.message as CheckoutError)
      : 'generic';
    if (field && !errors[field]) errors[field] = message;
  }
  return errors;
}
