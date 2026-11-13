import type { Metadata } from 'next';
import { Eyebrow, Heading } from '@/components/ui';
import { getTranslations } from 'next-intl/server';
import { listStorefrontProducts } from '@/modules/catalog/server';
import {
  CatalogBrowser,
  CollectionDeck,
  Reveal,
  RisingWords,
  deckCards,
} from '@/modules/storefront';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { NewsletterSection } from '@/modules/newsletter/server';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'catalog' });
  return { title: t('title'), ...alternatesMetadata('/catalogo', locale) };
}

export default async function Catalog({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const [t, products] = await Promise.all([
    getTranslations('catalog'),
    listStorefrontProducts(locale),
  ]);
  const cards = deckCards(products);
  const brands = new Set(products.map((product) => product.brand.slug)).size;
  return (
    <>
      <main className="mx-auto max-w-[90rem] overflow-x-clip px-5 pt-36 pb-32 sm:px-10 sm:pt-44">
        <div className="mb-14 grid items-center gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(0,36rem)]">
          <div className="max-w-3xl">
            <Eyebrow>{t('eyebrow')}</Eyebrow>
            <Heading level={1} size="display" className="mt-4">
              <RisingWords text={t('title')} delay={0.1} />
            </Heading>
            {products.length > 0 && (
              <Reveal delay={0.5}>
                <p className="text-fg-muted mt-8 text-lg leading-relaxed">
                  {t('summary', { count: products.length, brands })}
                </p>
              </Reveal>
            )}
          </div>
          <CollectionDeck cards={cards} label={t('deckLabel')} />
        </div>
        <CatalogBrowser products={products} />
      </main>
      <NewsletterSection />
    </>
  );
}
