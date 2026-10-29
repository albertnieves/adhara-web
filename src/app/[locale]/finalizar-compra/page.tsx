import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Heading } from '@/components/ui';
import { accountsEnabled, getCheckoutPrefill } from '@/modules/account/server';
import {
  checkoutEnabled,
  quoteCart,
  readCart,
} from '@/modules/checkout/server';
import { CheckoutForm } from '@/modules/checkout/ui';
import { STORE_DEFAULTS, storeContent } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { Link, routing } from '@/modules/i18n';
import { requireLocale } from '@/modules/i18n/server';
import { TrackCommerce } from '@/modules/tracking';

/**
 * Finalizar compra (P03): la cesta sale de la cookie y los importes del
 * catálogo y de los servicios de envío para el peso de la cesta (§172); el
 * pedido lo crea la base con web_order_create. El pago, con P04.
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
    namespace: 'checkout',
  });
  return { title: t('title'), robots: { index: false, follow: false } };
}

export default async function CheckoutPage({ params }: { params: Params }) {
  const { locale } = await params;
  const lang = requireLocale(locale);
  if (!checkoutEnabled()) notFound();
  const [t, lines, storeData, account] = await Promise.all([
    getTranslations('checkout'),
    readCart(),
    readStoreContent('store', 'es'),
    getCheckoutPrefill(),
  ]);
  // Sin sesión y con la cuenta encendida: entrar y volver aquí.
  const signInNext =
    !account && accountsEnabled()
      ? `/${lang}${routing.pathnames['/finalizar-compra'][lang]}`
      : null;
  const quote = await quoteCart(lines);
  const store = storeData
    ? storeContent.parse(storeData.payload)
    : STORE_DEFAULTS;
  // Analítica y publicidad aceptadas (§179): lo que hay en la cesta, sin datos
  // de quien compra.
  const items = quote.lines.flatMap((line) =>
    line.product
      ? [
          {
            id: line.variantId,
            name: line.product.name,
            brand: line.product.brandName,
            variant: line.product.variantLabel || null,
            priceCents: line.product.unitPriceCents,
            quantity: line.quantity,
          },
        ]
      : [],
  );

  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-32 pb-20 sm:px-10">
      {items.length > 0 && (
        <TrackCommerce
          event={{
            type: 'begin_checkout',
            items,
            valueCents: quote.itemsCents,
          }}
        />
      )}
      <Link
        href="/cesta"
        className="link-underline text-fg-muted text-2xs tracking-caps-lg uppercase"
      >
        ← {t('back')}
      </Link>
      <Heading level={1} size="h1" className="mt-6 mb-12">
        {t('title')}
      </Heading>
      <CheckoutForm
        locale={lang}
        lines={quote.lines.flatMap((line) =>
          line.product
            ? [
                {
                  variantId: line.variantId,
                  label:
                    `${line.product.name} ${line.product.variantLabel}`.trim(),
                  quantity: line.quantity,
                  lineTotalCents: line.product.lineTotalCents,
                },
              ]
            : [],
        )}
        itemsCents={quote.itemsCents}
        purchasable={quote.purchasable}
        shipping={quote.shipping}
        store={{ address: store.address, city: store.city }}
        account={account}
        signInNext={signInNext}
      />
    </main>
  );
}
