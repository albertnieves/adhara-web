import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import {
  Badge,
  buttonClass,
  EmptyState,
  Eyebrow,
  Heading,
} from '@/components/ui';
import { formatEuros } from '@/lib/money';
import { MAX_LINE_QUANTITY } from '@/modules/checkout';
import {
  checkoutEnabled,
  quoteCart,
  readCart,
} from '@/modules/checkout/server';
import { updateCartLine } from '@/modules/checkout/server/actions';
import { Link } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';
import { ProductImage } from '@/modules/storefront/ui/ProductImage';

/**
 * Cesta (P03): se lee de la cookie en cada visita y los precios salen del
 * catálogo publicado. Cada botón es un formulario: funciona sin JavaScript.
 */
export const dynamic = 'force-dynamic';

type Params = Promise<{ locale: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({
    locale: requireLocale(locale),
    namespace: 'cart',
  });
  return { title: t('title') };
}

function QuantityButton({
  variantId,
  quantity,
  label,
  children,
}: {
  variantId: string;
  quantity: number;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <form action={updateCartLine}>
      <input type="hidden" name="variantId" value={variantId} />
      <input type="hidden" name="quantity" value={quantity} />
      <button
        type="submit"
        aria-label={label}
        className="border-border-strong hover:border-fg inline-flex size-11 items-center justify-center border text-lg"
      >
        {children}
      </button>
    </form>
  );
}

export default async function CartPage({ params }: { params: Params }) {
  const { locale } = await params;
  const lang = requireLocale(locale);
  if (!checkoutEnabled()) notFound();
  const [t, lines] = await Promise.all([getTranslations('cart'), readCart()]);
  const quote = await quoteCart(lines);
  const euros = (cents: number) => formatEuros(cents, lang);

  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-32 pb-20 sm:px-10">
      <Heading level={1} size="h1">
        {t('title')}
      </Heading>

      {quote.lines.length === 0 ? (
        <EmptyState
          className="mt-12"
          title={t('empty')}
          description={t('emptyLead')}
          action={
            <Link href="/catalogo" className={buttonClass('primary')}>
              {t('browse')}
            </Link>
          }
        />
      ) : (
        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start">
          <ul className="divide-border border-border divide-y border-y">
            {quote.lines.map((line) => {
              const p = line.product;
              const name = p ? `${p.name} ${p.variantLabel}`.trim() : '';
              return (
                <li
                  key={line.variantId}
                  className="grid grid-cols-[5rem_1fr] gap-4 py-6 sm:grid-cols-[6rem_1fr_auto] sm:gap-6"
                >
                  <div className="bg-surface-sunken relative aspect-[3/4] overflow-hidden">
                    {p && (
                      <ProductImage
                        media={p.media}
                        alt={p.name}
                        brand={p.brandName}
                        sizes="6rem"
                      />
                    )}
                  </div>
                  <div className="min-w-0 space-y-2">
                    {p ? (
                      <>
                        <Eyebrow>{p.brandName}</Eyebrow>
                        <Link
                          href={{
                            pathname: '/perfume/[slug]',
                            params: { slug: p.slug },
                          }}
                          className="font-display link-underline block text-xl"
                        >
                          {p.name}
                        </Link>
                        <p className="text-fg-muted text-sm">
                          {p.variantLabel} · {euros(p.unitPriceCents)}
                        </p>
                        {p.availability === 'out_of_stock' && (
                          <Badge tone="danger">{t('outOfStock')}</Badge>
                        )}
                      </>
                    ) : (
                      <p className="text-fg-muted text-sm">
                        {t('unavailable')}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-2">
                      {p && (
                        <>
                          <QuantityButton
                            variantId={line.variantId}
                            quantity={line.quantity - 1}
                            label={t('decrease', { name })}
                          >
                            −
                          </QuantityButton>
                          <span
                            className="min-w-8 text-center tabular-nums"
                            aria-label={t('quantity')}
                          >
                            {line.quantity}
                          </span>
                          <QuantityButton
                            variantId={line.variantId}
                            quantity={Math.min(
                              line.quantity + 1,
                              MAX_LINE_QUANTITY,
                            )}
                            label={t('increase', { name })}
                          >
                            +
                          </QuantityButton>
                        </>
                      )}
                      <form action={updateCartLine}>
                        <input
                          type="hidden"
                          name="variantId"
                          value={line.variantId}
                        />
                        <input type="hidden" name="quantity" value={0} />
                        <button
                          type="submit"
                          aria-label={
                            name ? t('removeLabel', { name }) : t('remove')
                          }
                          className="link-underline text-fg-muted text-2xs tracking-caps ml-2 inline-flex min-h-11 items-center uppercase"
                        >
                          {t('remove')}
                        </button>
                      </form>
                    </div>
                  </div>
                  <p className="col-start-2 text-right tabular-nums sm:col-start-auto">
                    {p ? euros(p.lineTotalCents) : '—'}
                  </p>
                </li>
              );
            })}
          </ul>

          <aside className="border-border space-y-5 border p-6 sm:p-8">
            <dl className="font-display grid grid-cols-[1fr_auto] gap-x-6 text-xl">
              <dt>{t('subtotal')}</dt>
              <dd className="tabular-nums">{euros(quote.itemsCents)}</dd>
            </dl>
            <p className="text-fg-muted text-xs">
              {t('vat')} · {t('maxNote', { max: MAX_LINE_QUANTITY })}
            </p>
            <p className="text-fg-muted text-sm leading-relaxed">
              {t('shippingNext')}
            </p>
            {quote.purchasable ? (
              <Link
                href="/finalizar-compra"
                className={buttonClass('primary', 'lg', 'w-full')}
              >
                {t('checkout')}
              </Link>
            ) : (
              <p role="status" className="text-danger text-sm">
                {t('blocked')}
              </p>
            )}
            <Link href="/catalogo" className="link-underline block text-sm">
              {t('continue')}
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
