import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Badge, Eyebrow } from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { accountPath } from '@/modules/account';
import { getAccountOrder, requireCustomer } from '@/modules/account/server';
import { AccountNav, AccountShell, STATUS_TONE } from '@/modules/account/ui';
import { STORE_DEFAULTS, storeContent } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { Link } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';
import { LEGAL_CONTACT_EMAIL } from '@/modules/legal';

/**
 * Ficha de un pedido de la cuenta (C04). customer_order devuelve null si el
 * pedido no existe o no es de esta cuenta: en ambos casos, 404.
 */
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string; number: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, number } = await params;
  const t = await getTranslations({
    locale: requireLocale(locale),
    namespace: 'account',
  });
  return {
    title: t('order.title', { number }),
    robots: { index: false, follow: false },
  };
}

export default async function AccountOrderPage({ params }: { params: Params }) {
  const { locale, number } = await params;
  const lang = requireLocale(locale);
  const session = await requireCustomer(lang, accountPath(lang, '/cuenta'));
  if (!/^[1-9][0-9]{0,11}$/.test(number)) notFound();
  const [t, tc, order, storeData] = await Promise.all([
    getTranslations('account'),
    getTranslations('checkout'),
    getAccountOrder(session, Number(number)),
    readStoreContent('store', 'es'),
  ]);
  if (!order) notFound();
  const store = storeData
    ? storeContent.parse(storeData.payload)
    : STORE_DEFAULTS;
  const euros = (cents: number) => formatEuros(cents, lang);
  const date = new Intl.DateTimeFormat(lang, {
    dateStyle: 'long',
    timeZone: 'Europe/Madrid',
  }).format(new Date(order.createdAt));
  const address = order.address;

  return (
    <AccountShell
      eyebrow={t('order.placedOn', { date })}
      title={t('order.title', { number: order.number })}
      nav={<AccountNav locale={lang} />}
    >
      <Link
        href="/cuenta"
        className="link-underline text-fg-muted text-2xs tracking-caps-lg uppercase"
      >
        ← {t('order.back')}
      </Link>
      <dl className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <dt>
            <Eyebrow as="span">{t('order.status')}</Eyebrow>
          </dt>
          <dd>
            <Badge tone={STATUS_TONE[order.status]}>
              {t(`status.${order.status}`)}
            </Badge>
          </dd>
        </div>
        <div className="space-y-2">
          <dt>
            <Eyebrow as="span">{t('order.delivery')}</Eyebrow>
          </dt>
          <dd className="space-y-1 text-sm leading-relaxed">
            <p>
              {order.fulfillment === 'shipping'
                ? t('orders.shipping')
                : `${t('orders.pickup')} · ${store.address}, ${store.city}`}
            </p>
            {order.carrierName && (
              <p>{t('order.carrier', { carrier: order.carrierName })}</p>
            )}
            {order.trackingReference && (
              <p>
                {t('order.tracking', { reference: order.trackingReference })}
              </p>
            )}
            {order.trackingUrl && (
              <p>
                <a
                  href={order.trackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link-underline font-semibold"
                >
                  {t('order.trackingLink')}
                </a>
              </p>
            )}
          </dd>
        </div>
        <div className="space-y-2">
          <dt>
            <Eyebrow as="span">{t('order.contact')}</Eyebrow>
          </dt>
          <dd className="text-sm leading-relaxed">
            <p>{order.contact.fullName}</p>
            <p>{order.contact.email}</p>
            {order.contact.phone && <p>{order.contact.phone}</p>}
          </dd>
        </div>
        {address && (
          <div className="space-y-2">
            <dt>
              <Eyebrow as="span">{t('order.address')}</Eyebrow>
            </dt>
            <dd className="text-sm leading-relaxed">
              <p>{address.addressLine1}</p>
              {address.addressLine2 && <p>{address.addressLine2}</p>}
              <p>
                {address.postalCode} {address.city}
                {address.province ? ` (${address.province})` : ''}
              </p>
            </dd>
          </div>
        )}
      </dl>

      <section className="space-y-4">
        <Eyebrow as="h2">{t('order.items')}</Eyebrow>
        <ul className="divide-border border-border divide-y border-y text-sm">
          {order.lines.map((line, index) => (
            <li
              key={`${line.productName}-${index}`}
              className="flex justify-between gap-4 py-3"
            >
              <span>
                <span className="text-fg-muted">{line.brandName} · </span>
                {line.productName}
                {line.variantLabel || line.sizeMl
                  ? ` ${line.variantLabel ?? `${line.sizeMl} ml`}`
                  : ''}
                <span className="text-fg-muted block tabular-nums">
                  {t('order.quantity', {
                    count: line.quantity,
                    price: euros(line.unitPriceCents),
                  })}
                </span>
              </span>
              <span className="tabular-nums">{euros(line.lineTotalCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-sm">
          <dt className="text-fg-muted">{t('order.subtotal')}</dt>
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
          <dt className="text-fg-muted">{t('order.shippingCost')}</dt>
          <dd className="text-right tabular-nums">
            {order.shippingCents === 0
              ? t('order.free')
              : euros(order.shippingCents)}
          </dd>
          <dt className="font-display text-xl">{t('order.total')}</dt>
          <dd className="font-display text-right text-xl tabular-nums">
            {euros(order.totalCents)}
          </dd>
          {order.refundedCents > 0 && (
            <>
              <dt className="text-fg-muted">{t('order.refunded')}</dt>
              <dd className="text-right tabular-nums">
                −{euros(order.refundedCents)}
              </dd>
            </>
          )}
        </dl>
        <p className="text-fg-muted text-right text-xs">{t('order.vat')}</p>
      </section>
      <p className="text-fg-muted text-sm leading-relaxed">
        {t('order.help', { email: store.email || LEGAL_CONTACT_EMAIL })}
      </p>
    </AccountShell>
  );
}
