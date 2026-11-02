import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Eyebrow, Heading } from '@/components/ui';
import {
  listScentProfiles,
  listStorefrontProducts,
} from '@/modules/catalog/server';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { Reveal, SiteSearch } from '@/modules/storefront';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'search' });
  return {
    title: t('eyebrow'),
    description: t('metaDescription'),
    // Una página de resultados no aporta nada a un buscador.
    robots: { index: false, follow: true },
    ...alternatesMetadata('/buscar', locale),
  };
}

/**
 * Búsqueda de la tienda (roadmap 5, DECISIONS §181): la página es estática y
 * trae los perfumes publicados con su perfil olfativo; se busca en el
 * navegador mientras se escribe (`?q=`).
 */
export default async function SearchPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const [t, products, profiles] = await Promise.all([
    getTranslations('search'),
    listStorefrontProducts(locale),
    listScentProfiles(),
  ]);
  const documents = products.map((product) => ({
    product,
    profile: profiles[product.id] ?? null,
  }));
  return (
    <main className="mx-auto max-w-[90rem] px-5 pt-36 pb-32 sm:px-10 sm:pt-44">
      <Reveal className="mb-10 max-w-3xl">
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <Heading level={1} size="display" className="mt-4">
          {t('title')}
        </Heading>
      </Reveal>
      <SiteSearch documents={documents} />
    </main>
  );
}
