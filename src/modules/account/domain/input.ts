import { z } from 'zod';

/*
 * Formularios de la cuenta de cliente. Se validan aquí, en la acción del
 * servidor y otra vez en Supabase Auth o en customer_save_account. Las claves
 * de error son las de messages/*.json → account.errors.
 */

/** Igual que minimum_password_length de Supabase Auth (supabase/config.toml). */
export const MIN_PASSWORD_LENGTH = 12;

export const ACCOUNT_ERRORS = [
  'nameRequired',
  'emailInvalid',
  'passwordShort',
  'passwordMismatch',
  'passwordWeak',
  'credentials',
  'notConfirmed',
  'signupDisabled',
  'rateLimited',
  'phoneInvalid',
  'addressIncomplete',
  'postalCodeInvalid',
  'confirmRequired',
  'staff',
  'google',
  'link',
  'disabled',
  'generic',
] as const;
export type AccountError = (typeof ACCOUNT_ERRORS)[number];

const PHONE = /^[0-9 +().-]{6,30}$/;
const text = (max: number) => z.string().trim().max(max);
const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'emailInvalid')
  .pipe(z.email('emailInvalid'));
const newPassword = z
  .string()
  .min(MIN_PASSWORD_LENGTH, 'passwordShort')
  .max(200, 'passwordShort');

export const signUpInput = z.object({
  fullName: text(120).min(1, 'nameRequired'),
  email,
  password: newPassword,
});

export const signInInput = z.object({
  email,
  password: z.string().min(1, 'credentials').max(200, 'credentials'),
});

export const recoveryInput = z.object({ email });

export const newPasswordInput = z
  .object({ password: newPassword, confirmation: z.string().max(200) })
  .refine((value) => value.password === value.confirmation, {
    path: ['confirmation'],
    message: 'passwordMismatch',
  });

/** Datos de la cuenta: la dirección de envío va completa o vacía. */
export const accountInput = z
  .object({
    locale: z.enum(['es', 'ca', 'en']),
    fullName: text(120),
    phone: text(30).refine((v) => !v || PHONE.test(v), 'phoneInvalid'),
    addressLine1: text(200),
    addressLine2: text(200),
    postalCode: text(5),
    city: text(120),
    province: text(120),
  })
  .superRefine((input, ctx) => {
    const any =
      input.addressLine1 ||
      input.addressLine2 ||
      input.postalCode ||
      input.city ||
      input.province;
    if (!any) return;
    const issue = (path: string, message: AccountError) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (!input.addressLine1) issue('addressLine1', 'addressIncomplete');
    if (!/^[0-9]{5}$/.test(input.postalCode))
      issue('postalCode', 'postalCodeInvalid');
    if (!input.city) issue('city', 'addressIncomplete');
  });
export type AccountInput = z.infer<typeof accountInput>;

export type AccountField =
  | 'fullName'
  | 'email'
  | 'password'
  | 'confirmation'
  | 'phone'
  | 'addressLine1'
  | 'postalCode'
  | 'city'
  | 'confirm';

export type AccountFormState =
  | { status: 'idle' }
  | {
      status: 'error';
      error: AccountError;
      fields?: Partial<Record<AccountField, AccountError>>;
    }
  /** Correo enviado (alta o recuperación): no dice si la cuenta existe. */
  | { status: 'sent' }
  | { status: 'saved' };

/** Primer error de cada campo, con su clave de mensaje. */
export function accountFieldErrors(
  issues: readonly { path: PropertyKey[]; message: string }[],
): Partial<Record<AccountField, AccountError>> {
  const errors: Partial<Record<AccountField, AccountError>> = {};
  for (const issue of issues) {
    const field = issue.path[0] as AccountField | undefined;
    const message = (ACCOUNT_ERRORS as readonly string[]).includes(
      issue.message,
    )
      ? (issue.message as AccountError)
      : 'generic';
    if (field && !errors[field]) errors[field] = message;
  }
  return errors;
}

/** Estado de error a partir de un zod fallido: el primer error es el general. */
export function invalid(
  issues: readonly { path: PropertyKey[]; message: string }[],
): AccountFormState {
  const fields = accountFieldErrors(issues);
  return {
    status: 'error',
    error: Object.values(fields)[0] ?? 'generic',
    fields,
  };
}

/**
 * Error de Supabase Auth → clave de mensaje. Nunca revela si un email tiene
 * cuenta: «credenciales» sirve para ambos casos.
 */
export function authErrorKey(code: string | undefined): AccountError {
  switch (code) {
    case 'invalid_credentials':
    case 'user_not_found':
      return 'credentials';
    case 'email_not_confirmed':
      return 'notConfirmed';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'signupDisabled';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'rateLimited';
    case 'weak_password':
      return 'passwordWeak';
    case 'same_password':
      return 'passwordWeak';
    default:
      return 'generic';
  }
}
