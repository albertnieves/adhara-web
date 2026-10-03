import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { listStorefrontProducts } from '@/modules/catalog/server';
import { CatalogBrowser, Reveal } from '@/modules/storefront';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';

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
  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-36 pb-32 sm:px-10 sm:pt-44">
      <Reveal className="mb-14 max-w-3xl">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="mt-4 text-6xl leading-none font-light sm:text-8xl">
          {t('title')}
        </h1>
      </Reveal>
      <CatalogBrowser products={products} />
    </main>
  );
}
