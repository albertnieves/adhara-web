import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Eyebrow, Heading } from '@/components/ui';
import { Star } from '@/modules/brand';
import {
  listScentProfiles,
  listStorefrontProducts,
} from '@/modules/catalog/server';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { Reveal, ScentCatalogBrowser } from '@/modules/storefront';

export const revalidate = 300;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'scent' });
  return {
    title: t('eyebrow'),
    description: t('lead'),
    ...alternatesMetadata('/catalogo-olfativo', locale),
  };
}

/**
 * Catálogo olfativo: solo para descubrir y comparar, sin precio ni compra.
 * Notas, familias, estaciones y momento del día vienen de la fuente citada
 * en cada perfil (product_scent_profiles.source_url).
 */
export default async function ScentCatalog({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  requireLocale(locale);
  const [t, products, profiles] = await Promise.all([
    getTranslations('scent'),
    listStorefrontProducts(locale),
    listScentProfiles(),
  ]);
  const entries = products.map((product) => ({
    product,
    profile: profiles[product.id] ?? null,
  }));
  return (
    <main>
      <section
        data-tone="oud"
        className="bg-surface text-fg grain relative overflow-hidden"
      >
        <div className="relative mx-auto max-w-[90rem] px-5 pt-40 pb-20 sm:px-10 sm:pt-48 sm:pb-28">
          <Reveal className="max-w-4xl">
            <Star className="text-accent-fg size-4" />
            <Eyebrow tone="accent" className="mt-8">
              {t('eyebrow')}
            </Eyebrow>
            <Heading level={1} size="display" className="mt-4">
              {t('title')}
            </Heading>
            <p className="text-fg-muted mt-8 max-w-2xl text-lg leading-relaxed">
              {t('lead')}
            </p>
          </Reveal>
          <Reveal delay={0.15}>
            <ol className="border-border mt-16 grid gap-8 border-t pt-10 sm:grid-cols-3">
              {(['top', 'heart', 'base'] as const).map((tier, index) => (
                <li key={tier} className="flex gap-5">
                  <span
                    aria-hidden
                    className="font-display text-accent-fg text-4xl font-light"
                  >
                    {['I', 'II', 'III'][index]}
                  </span>
                  <div>
                    <Eyebrow as="h2">{t(tier)}</Eyebrow>
                    <p className="text-fg-muted mt-2 text-sm leading-relaxed">
                      {t(`${tier}Hint`)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>
      <div className="mx-auto max-w-[90rem] px-5 pt-16 pb-32 sm:px-10">
        <ScentCatalogBrowser entries={entries} />
        <p className="text-fg-muted mt-24 max-w-2xl text-xs leading-relaxed">
          {t('sourceNote')}
        </p>
      </div>
    </main>
  );
}
