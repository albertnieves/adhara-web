import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Eyebrow, Heading, buttonClass } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { orderPhase, readReturnResult } from '@/modules/checkout';
import {
  checkoutEnabled,
  getOrderStatus,
  paymentsEnabled,
  rememberedOrderId,
} from '@/modules/checkout/server';
import {
  AwaitingConfirmation,
  RetryPaymentButton,
} from '@/modules/checkout/ui';
import { STORE_DEFAULTS, storeContent } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { Link } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';
import { LEGAL_CONTACT_EMAIL } from '@/modules/legal';
import { SHIPMENT_STATUSES } from '@/modules/shipping';
import { TrackCommerce } from '@/modules/tracking';

const SHIPMENT_STATUS_KEYS: ReadonlySet<string> = new Set(SHIPMENT_STATUSES);

/**
 * La compra se mide al verla pagada por primera vez, en las 24 horas
 * siguientes al pago: volver a la página días después no cuenta otra venta
 * (el navegador, además, recuerda las ya medidas; §179).
 */
const PURCHASE_WINDOW_MS = 24 * 60 * 60 * 1000;
function recentlyPaid(paidAt: string | null): boolean {
  if (!paidAt) return false;
  const age = Date.now() - new Date(paidAt).getTime();
  return age >= 0 && age < PURCHASE_WINDOW_MS;
}

/**
 * Vuelta del banco (P04): enseña el estado del pedido de este navegador
 * (cookie httpOnly con su identificador) sin datos personales. Lo que diga la
 * URL (resultado=ok/ko) solo cambia el mensaje: el estado sale de la base,
 * que solo cambia con la notificación firmada del banco.
 */
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;
type Search = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: requireLocale(locale),
    namespace: 'order',
  });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const [{ locale }, search] = await Promise.all([params, searchParams]);
  const lang = requireLocale(locale);
  if (!checkoutEnabled()) notFound();
  const orderId = await rememberedOrderId();
  const [t, tc, order, storeData] = await Promise.all([
    getTranslations('order'),
    getTranslations('checkout'),
    orderId ? getOrderStatus(orderId) : null,
    readStoreContent('store', 'es'),
  ]);
  const store = storeData
    ? storeContent.parse(storeData.payload)
    : STORE_DEFAULTS;
  const email = store.email || LEGAL_CONTACT_EMAIL;
  const euros = (cents: number) => formatEuros(cents, lang);

  if (!order) {
    return (
      <Shell eyebrow={t('title')} title={t('notFoundTitle')}>
        <p className="leading-relaxed">{t('notFoundText', { email })}</p>
        <Link href="/catalogo" className={buttonClass('outline')}>
          {t('backToCatalog')}
        </Link>
      </Shell>
    );
  }

  const phase = orderPhase(order, readReturnResult(search.resultado));
  const time = new Intl.DateTimeFormat(lang, {
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(order.reservedUntil));
  const canPay = paymentsEnabled();
  const number = t('number', { number: order.number });

  const summary = (
    <dl className="border-border grid max-w-md grid-cols-[1fr_auto] gap-x-6 gap-y-2 border-t pt-6 text-sm">
      <dt className="text-fg-muted">{tc('items')}</dt>
      <dd className="text-right tabular-nums">{euros(order.itemsCents)}</dd>
      {order.discountCents > 0 && (
        <>
          <dt className="text-fg-muted">
            {tc('discount.line', { code: order.discountCode ?? '' })}
          </dt>
          <dd className="text-right tabular-nums">
            −{euros(order.discountCents)}
          </dd>
        </>
      )}
      <dt className="text-fg-muted">
        {order.fulfillment === 'shipping' ? tc('shippingCost') : tc('pickup')}
      </dt>
      <dd className="text-right tabular-nums">
        {order.shippingCents === 0 ? tc('free') : euros(order.shippingCents)}
      </dd>
      <dt className="font-display text-xl">{tc('total')}</dt>
      <dd className="font-display text-right text-xl tabular-nums">
        {euros(order.totalCents)}
      </dd>
    </dl>
  );

  switch (phase) {
    case 'paid':
      return (
        <Shell eyebrow={number} title={t('paidTitle')}>
          {recentlyPaid(order.paidAt) && (
            <TrackCommerce
              event={{
                type: 'purchase',
                orderNumber: order.number,
                valueCents: order.itemsCents - order.discountCents,
                shippingCents: order.shippingCents,
                coupon: order.discountCode,
              }}
            />
          )}
          <p className="leading-relaxed">
            {order.fulfillment === 'shipping'
              ? t('paidShipping')
              : t('paidPickup', {
                  address: `${store.address}, ${store.city}`,
                })}
          </p>
          {order.shipment && (
            <section
              aria-labelledby="seguimiento"
              className="border-border space-y-2 border-t pt-6"
            >
              <h2 id="seguimiento" className="text-lg">
                {t('shipmentTitle')}
              </h2>
              <p className="font-semibold">
                {t(
                  `shipmentStatus.${SHIPMENT_STATUS_KEYS.has(order.shipment.status) ? order.shipment.status : 'in_transit'}`,
                )}
              </p>
              <p className="text-fg-muted text-sm leading-relaxed">
                {t('shipmentCarrier', { carrier: order.shipment.carrierName })}
                {order.shipment.trackingNumber && (
                  <>
                    {' '}
                    {t('shipmentTracking', {
                      tracking: order.shipment.trackingNumber,
                    })}
                  </>
                )}
              </p>
              {order.shipment.trackingUrl && (
                <a
                  href={order.shipment.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass('outline')}
                >
                  {t('shipmentLink')}
                </a>
              )}
            </section>
          )}
          {summary}
        </Shell>
      );
    case 'confirming':
      return (
        <Shell eyebrow={number} title={t('confirmingTitle')}>
          <AwaitingConfirmation />
          {summary}
        </Shell>
      );
    case 'payment_failed':
    case 'awaiting_payment':
      return (
        <Shell
          eyebrow={number}
          title={
            phase === 'payment_failed' ? t('failedTitle') : t('awaitingTitle')
          }
        >
          <p className="leading-relaxed">
            {phase === 'payment_failed' ? `${t('failedText')} ` : ''}
            {t('reservedUntil', { time })}
          </p>
          {canPay ? (
            <RetryPaymentButton
              locale={lang}
              label={phase === 'payment_failed' ? t('retry') : t('pay')}
            />
          ) : (
            <p className="text-fg-muted text-sm leading-relaxed">
              {tc('placedPayment')}
            </p>
          )}
          {summary}
        </Shell>
      );
    case 'expired':
      return (
        <Shell eyebrow={number} title={t('expiredTitle')}>
          <p className="leading-relaxed">{t('expiredText')}</p>
          <Link href="/catalogo" className={buttonClass('outline')}>
            {t('backToCatalog')}
          </Link>
        </Shell>
      );
    case 'review':
      return (
        <Shell eyebrow={number} title={t('reviewTitle')}>
          <p className="leading-relaxed">{t('reviewText', { email })}</p>
          {summary}
        </Shell>
      );
    case 'cancelled':
      return (
        <Shell eyebrow={number} title={t('cancelledTitle')}>
          <p className="leading-relaxed">{t('cancelledText', { email })}</p>
        </Shell>
      );
  }
}

function Shell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-32 pb-20 sm:px-10">
      <section className="max-w-2xl space-y-6">
        <Eyebrow>{eyebrow}</Eyebrow>
        <Heading level={1} size="h1">
          {title}
        </Heading>
        {children}
      </section>
    </main>
  );
}
