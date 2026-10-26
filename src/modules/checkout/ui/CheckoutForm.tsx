'use client';

import { useTranslations } from 'next-intl';
import type { FormEvent, KeyboardEvent } from 'react';
import {
  startTransition,
  useActionState,
  useState,
  useTransition,
} from 'react';
import {
  Button,
  Checkbox,
  Eyebrow,
  Field,
  Fieldset,
  Heading,
  Input,
  Radio,
} from '@/components/ui';
import type { FieldControlProps } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { Link } from '@/modules/i18n';
import type { AppliedDiscount, DiscountError } from '@/modules/promotions';
import type { ShippingQuote } from '@/modules/shipping';
import { optionCost, zoneOptions } from '@/modules/shipping';
import type { CheckoutField, CheckoutState } from '../domain/input';
import { isPostalCode, shippingZone } from '../domain/shipping';
import { applyDiscountCode, placeOrder } from '../server/actions';
import { PaymentRedirectForm } from './PaymentRedirectForm';

const IDLE: CheckoutState = { status: 'idle' };

/** Datos de la cuenta con la sesión iniciada (CUSTOMER_ACCOUNTS). */
export type CheckoutAccount = {
  email: string;
  fullName: string;
  phone: string;
  address: {
    addressLine1: string;
    addressLine2: string;
    postalCode: string;
    city: string;
    province: string;
  } | null;
};

type DiscountProblem = { error: DiscountError; minimumCents?: number };

/** Campo del código con su botón: `Field` le pone id, ayuda y error. */
function DiscountControl({
  id,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  value,
  onChange,
  onApply,
  applying,
  labels,
}: FieldControlProps & {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  applying: boolean;
  labels: { apply: string; applying: string };
}) {
  return (
    <div className="flex gap-2">
      <Input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        // Intro aplica el código: nunca envía el pedido.
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          onApply();
        }}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={30}
        className="min-w-0 flex-1 uppercase"
      />
      <Button
        type="button"
        variant="outline"
        onClick={onApply}
        loading={applying}
        loadingLabel={labels.applying}
        disabled={!value.trim()}
      >
        {labels.apply}
      </Button>
    </div>
  );
}

export type CheckoutLine = {
  variantId: string;
  label: string;
  quantity: number;
  lineTotalCents: number;
};

/**
 * «Finalizar compra»: datos, entrega (recogida gratis o envío a la península
 * y Baleares con el transportista que elija el cliente, al precio de su peso,
 * DECISIONS §172) y resumen. Los importes que se ven aquí
 * son orientativos; los que cuentan los calcula la base al crear el pedido.
 * Se mantiene montado tras el pedido (la cesta queda vacía): con el TPV
 * configurado lleva al banco a pagar (P04); sin él, enseña la confirmación.
 * Con la cuenta de cliente encendida, `account` rellena los datos guardados
 * (y el pedido queda en la cuenta) o, sin sesión, invita a entrar y volver a
 * `signInNext` (esta página con su idioma).
 */
export function CheckoutForm({
  locale,
  lines,
  itemsCents,
  purchasable,
  shipping,
  store,
  account = null,
  signInNext = null,
}: {
  locale: 'es' | 'ca' | 'en';
  lines: CheckoutLine[];
  itemsCents: number;
  purchasable: boolean;
  shipping: ShippingQuote;
  store: { address: string; city: string };
  account?: CheckoutAccount | null;
  signInNext?: string | null;
}) {
  const t = useTranslations('checkout');
  // Código aplicado en el resumen (DECISIONS §150): lo calcula la base y se
  // vuelve a comprobar al crear el pedido.
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [problem, setProblem] = useState<DiscountProblem | null>(null);
  const [applying, startApplying] = useTransition();
  const [state, dispatch, pending] = useActionState(
    async (previous: CheckoutState, form: FormData) => {
      const result = await placeOrder(previous, form);
      // El código dejó de valer entre «Aplicar» y el pedido: se quita.
      if (result.status === 'error' && result.error === 'discount') {
        setDiscount(null);
        setProblem({
          error: result.discount ?? 'invalid',
          minimumCents: result.minimumCents,
        });
      }
      return result;
    },
    IDLE,
  );
  // Una clave por visita al formulario: repetir el envío no duplica el pedido.
  const [requestId] = useState(() => crypto.randomUUID());
  const [fulfillment, setFulfillment] = useState<'click_collect' | 'shipping'>(
    'click_collect',
  );
  const saved = account?.address;
  const [postalCode, setPostalCode] = useState(saved?.postalCode ?? '');
  // Servicio elegido; sin elegir, el más barato de la zona.
  const [serviceId, setServiceId] = useState<string | null>(null);
  const euros = (cents: number) => formatEuros(cents, locale);

  function applyCode() {
    if (!codeInput.trim() || applying) return;
    startApplying(async () => {
      const result = await applyDiscountCode(codeInput);
      if (result.status === 'applied') {
        setDiscount(result);
        setProblem(null);
      } else {
        setProblem({ error: result.error, minimumCents: result.minimumCents });
      }
    });
  }

  function removeCode() {
    setDiscount(null);
    setProblem(null);
    setCodeInput('');
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  }

  if (state.status === 'redirect') {
    return (
      <section className="max-w-2xl space-y-6">
        <Heading level={2} size="h2">
          {t('placedTitle', { number: state.number })}
        </Heading>
        <PaymentRedirectForm form={state.form} />
      </section>
    );
  }

  if (state.status === 'placed') {
    const time = new Intl.DateTimeFormat(locale, {
      timeStyle: 'short',
      timeZone: 'Europe/Madrid',
    }).format(new Date(state.reservedUntil));
    return (
      <section role="status" className="max-w-2xl space-y-6">
        <Heading level={2} size="h2">
          {t('placedTitle', { number: state.number })}
        </Heading>
        <p className="leading-relaxed">
          {t('placedLead', { time, amount: euros(state.totalCents) })}
        </p>
        <p className="text-fg-muted text-sm leading-relaxed">
          {t('placedPayment')}
        </p>
        <Link href="/catalogo" className="link-underline font-semibold">
          {t('continue')}
        </Link>
      </section>
    );
  }

  if (lines.length === 0) {
    return (
      <p className="text-fg-muted">
        {t('errors.emptyCart')}{' '}
        <Link href="/catalogo" className="link-underline">
          {t('continue')}
        </Link>
      </p>
    );
  }

  const errors = state.status === 'error' ? (state.fields ?? {}) : {};
  const fieldError = (field: CheckoutField) =>
    errors[field] ? t(`errors.${errors[field]}`) : undefined;
  const zone = shippingZone(postalCode);
  const zoneData = zoneOptions(shipping, zone);
  const options = zoneData?.options ?? [];
  const selected =
    options.find((o) => o.serviceId === serviceId) ?? options[0] ?? null;
  const discountCents = discount?.discountCents ?? 0;
  // Envío gratis según lo que se paga por los artículos (con el descuento),
  // en los servicios que cuentan para él.
  const costOf = (option: (typeof options)[number]) =>
    optionCost(
      option,
      itemsCents - discountCents,
      zoneData?.freeFromCents ?? null,
    );
  const shippingCents =
    fulfillment === 'click_collect' ? 0 : selected ? costOf(selected) : null;
  const problemMessage = problem
    ? problem.error === 'minimum' && problem.minimumCents
      ? t('discount.errors.minimumAmount', {
          amount: euros(problem.minimumCents),
        })
      : t(`discount.errors.${problem.error}`)
    : fieldError('discountCode') && t('discount.errors.invalid');
  // Hay zonas con envío; sin peso de algún formato, ningún servicio lo lleva.
  const weightMissing = shipping.zones.length > 0 && shipping.weightG === null;
  const shippingOffered =
    !weightMissing && shipping.zones.some((z) => z.options.length > 0);
  const zoneProblem =
    fulfillment === 'shipping' && isPostalCode(postalCode) && !selected;

  return (
    <form
      action={dispatch}
      onSubmit={onSubmit}
      noValidate
      className="grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start"
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="discountCode" value={discount?.code ?? ''} />
      <input
        type="hidden"
        name="shippingServiceId"
        value={fulfillment === 'shipping' ? (selected?.serviceId ?? '') : ''}
      />
      <div
        aria-hidden
        className="absolute -left-[9999px] h-px w-px overflow-hidden"
      >
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <div className="space-y-10">
        <section className="space-y-4">
          <Eyebrow as="h2">{t('contact')}</Eyebrow>
          {account ? (
            <p className="text-fg-muted text-sm leading-relaxed">
              {t('accountSignedIn', { email: account.email })}
            </p>
          ) : (
            signInNext && (
              <p className="text-fg-muted text-sm leading-relaxed">
                {t.rich('accountSignIn', {
                  link: (chunks) => (
                    <Link
                      href={{
                        pathname: '/cuenta/acceso',
                        query: { next: signInNext },
                      }}
                      className="link-underline font-semibold"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </p>
            )
          )}
          <Field label={t('fullName')} error={fieldError('fullName')}>
            <Input
              name="fullName"
              required
              autoComplete="name"
              maxLength={120}
              defaultValue={account?.fullName}
            />
          </Field>
          <Field label={t('email')} error={fieldError('email')}>
            <Input
              type="email"
              name="email"
              required
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              defaultValue={account?.email}
            />
          </Field>
          <Field
            label={t('phone')}
            hint={t('phoneHint')}
            error={fieldError('phone')}
          >
            <Input
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="tel"
              maxLength={30}
              defaultValue={account?.phone}
            />
          </Field>
        </section>

        <Fieldset legend={t('delivery')}>
          <Radio
            name="fulfillment"
            value="click_collect"
            checked={fulfillment === 'click_collect'}
            onChange={() => setFulfillment('click_collect')}
            label={t('pickup')}
            hint={t('pickupHint', store)}
          />
          <Radio
            name="fulfillment"
            value="shipping"
            checked={fulfillment === 'shipping'}
            onChange={() => setFulfillment('shipping')}
            disabled={!shippingOffered}
            label={t('shipping')}
            hint={
              shippingOffered
                ? t('shippingHint')
                : weightMissing
                  ? t('shippingWeightMissing')
                  : t('shippingSoon')
            }
          />
        </Fieldset>

        {fulfillment === 'shipping' && (
          <section className="space-y-4">
            <Eyebrow as="h2">{t('address')}</Eyebrow>
            <Field label={t('addressLine1')} error={fieldError('addressLine1')}>
              <Input
                name="addressLine1"
                required
                autoComplete="address-line1"
                maxLength={200}
                defaultValue={saved?.addressLine1}
              />
            </Field>
            <Field label={t('addressLine2')}>
              <Input
                name="addressLine2"
                autoComplete="address-line2"
                maxLength={200}
                defaultValue={saved?.addressLine2}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
              <Field
                label={t('postalCode')}
                error={
                  fieldError('postalCode') ??
                  (zoneProblem ? t('zoneUnavailableNote') : undefined)
                }
              >
                <Input
                  name="postalCode"
                  required
                  autoComplete="postal-code"
                  inputMode="numeric"
                  maxLength={5}
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value)}
                />
              </Field>
              <Field label={t('city')} error={fieldError('city')}>
                <Input
                  name="city"
                  required
                  autoComplete="address-level2"
                  maxLength={120}
                  defaultValue={saved?.city}
                />
              </Field>
            </div>
            <Field label={t('province')}>
              <Input
                name="province"
                autoComplete="address-level1"
                maxLength={120}
                defaultValue={saved?.province}
              />
            </Field>
          </section>
        )}

        {fulfillment === 'shipping' &&
          (options.length > 0 ? (
            <Fieldset
              legend={t('carrier')}
              hint={t('carrierHint')}
              error={fieldError('shippingServiceId')}
            >
              {options.map((option) => {
                const cost = costOf(option);
                return (
                  <Radio
                    key={option.serviceId}
                    name="carrierChoice"
                    value={option.serviceId}
                    checked={selected?.serviceId === option.serviceId}
                    onChange={() => setServiceId(option.serviceId)}
                    label={`${option.label} · ${cost === 0 ? t('free') : euros(cost)}`}
                    hint={
                      [
                        option.transitDays
                          ? t('transitDays', { days: option.transitDays })
                          : null,
                        cost === 0 && option.priceCents > 0
                          ? t('carrierFree')
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                  />
                );
              })}
            </Fieldset>
          ) : (
            !isPostalCode(postalCode) && (
              <p className="text-fg-muted text-sm leading-relaxed">
                {t('carrierPostalFirst')}
              </p>
            )
          ))}
      </div>

      <aside className="border-border space-y-6 border p-6 sm:p-8 lg:sticky lg:top-24">
        <Eyebrow as="h2">{t('summary')}</Eyebrow>
        <ul className="divide-border divide-y text-sm">
          {lines.map((line) => (
            <li
              key={line.variantId}
              className="flex justify-between gap-4 py-3"
            >
              <span>
                {line.label}
                <span className="text-fg-muted tabular-nums">
                  {' '}
                  × {line.quantity}
                </span>
              </span>
              <span className="tabular-nums">{euros(line.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        {discount ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 text-sm">
              <p role="status">
                {t('discount.applied', { code: discount.code })}
              </p>
              <Button
                type="button"
                variant="subtle"
                size="sm"
                onClick={removeCode}
              >
                {t('discount.remove')}
              </Button>
            </div>
            {discount.excludesSaleItems && (
              <p className="text-fg-muted text-xs">
                {t('discount.excludesSale')}
              </p>
            )}
          </div>
        ) : (
          <Field label={t('discount.label')} error={problemMessage}>
            <DiscountControl
              value={codeInput}
              onChange={(value) => {
                setCodeInput(value);
                setProblem(null);
              }}
              onApply={applyCode}
              applying={applying}
              labels={{
                apply: t('discount.apply'),
                applying: t('discount.applying'),
              }}
            />
          </Field>
        )}
        <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
          <dt className="text-fg-muted">{t('items')}</dt>
          <dd className="text-right tabular-nums">{euros(itemsCents)}</dd>
          {discount && (
            <>
              <dt className="text-fg-muted">
                {t('discount.line', { code: discount.code })}
              </dt>
              <dd className="text-right tabular-nums">
                −{euros(discount.discountCents)}
              </dd>
            </>
          )}
          <dt className="text-fg-muted">{t('shippingCost')}</dt>
          <dd className="text-right tabular-nums">
            {shippingCents === null
              ? zoneProblem
                ? '—'
                : t('pending')
              : shippingCents === 0
                ? t('free')
                : euros(shippingCents)}
          </dd>
          <dt className="font-display text-xl">{t('total')}</dt>
          <dd className="font-display text-right text-xl tabular-nums">
            {euros(itemsCents - discountCents + (shippingCents ?? 0))}
          </dd>
        </dl>
        <p className="text-fg-muted text-xs">
          {t('vat')}
          {fulfillment === 'shipping' &&
          zoneData?.freeFromCents &&
          selected?.freeEligible
            ? ` · ${t('freeFrom', { amount: euros(zoneData.freeFromCents) })}`
            : ''}
        </p>

        <Checkbox
          name="acceptTerms"
          required
          label={t.rich('terms', {
            link: (chunks) => (
              <Link href="/condiciones-de-venta" className="link-underline">
                {chunks}
              </Link>
            ),
          })}
          error={fieldError('acceptTerms')}
        />
        <p className="text-fg-muted text-xs leading-relaxed">
          {t.rich('privacy', {
            link: (chunks) => (
              <Link href="/privacidad" className="link-underline">
                {chunks}
              </Link>
            ),
          })}{' '}
          {t.rich('withdrawal', {
            link: (chunks) => (
              <Link href="/envios-y-devoluciones" className="link-underline">
                {chunks}
              </Link>
            ),
          })}
        </p>

        {state.status === 'error' && (
          <p role="alert" className="text-danger text-sm">
            {state.error === 'discount'
              ? t('errors.discount')
              : Object.keys(errors).length > 0
                ? t('errors.review')
                : state.error === 'outOfStock'
                  ? state.product
                    ? t('errors.outOfStock', { product: state.product })
                    : t('errors.outOfStockAny')
                  : t(`errors.${state.error}`)}
            {['cartChanged', 'outOfStock', 'unavailable'].includes(
              state.error,
            ) && (
              <>
                {' '}
                <Link href="/cesta" className="link-underline font-semibold">
                  {t('back')}
                </Link>
              </>
            )}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={pending}
          loadingLabel={t('submitting')}
          disabled={!purchasable || zoneProblem}
        >
          {t('submit')}
        </Button>
      </aside>
    </form>
  );
}
