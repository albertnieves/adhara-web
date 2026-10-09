import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Eyebrow, Heading, Tag } from '@/components/ui';
import type { ScentProfile } from '@/modules/catalog';
import { allNotes, hasNotes } from '@/modules/catalog';
import {
  getScentProfile,
  getStorefrontProduct,
  listScentProfiles,
  listStorefrontProducts,
} from '@/modules/catalog/server';
import { Link } from '@/modules/i18n';
import { alternatesMetadata } from '@/modules/i18n/metadata';
import { requireLocale } from '@/modules/i18n/server';
import { findSceneSlug } from '@/modules/unboxing';
import {
  ProductStage,
  Reveal,
  ScentCard,
  ScentFootprint,
  ScentPyramid,
  ScentSectionTitle,
  SeasonWheel,
  TimeOfDayView,
} from '@/modules/storefront';

export const revalidate = 300;

/** Las fichas se generan en la primera visita y se revalidan (ISR). */
export function generateStaticParams() {
  return [];
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  requireLocale(locale);
  const product = await getStorefrontProduct(slug, locale);
  if (!product) return {};
  const t = await getTranslations({ locale, namespace: 'scent' });
  return {
    title: `${product.name} · ${t('eyebrow')}`,
    description: product.tagline ?? undefined,
    ...alternatesMetadata(
      { pathname: '/catalogo-olfativo/[slug]', params: { slug } },
      locale,
      ['es', ...product.translatedLocales],
    ),
  };
}

/** Notas y familias en común: lo más parecido primero. */
function affinity(a: ScentProfile, b: ScentProfile) {
  const notes = new Set(allNotes(a));
  const shared = allNotes(b).filter((key) => notes.has(key)).length;
  const families = b.families.filter((f) => a.families.includes(f)).length;
  return shared * 2 + families;
}

export default async function ScentProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  requireLocale(locale);
  const product = await getStorefrontProduct(slug, locale);
  if (!product) notFound();

  const [t, profile, products, profiles] = await Promise.all([
    getTranslations(),
    getScentProfile(product.id),
    listStorefrontProducts(locale),
    listScentProfiles(),
  ]);
  const similar = profile
    ? products
        .filter((p) => p.id !== product.id && profiles[p.id])
        .map((p) => ({
          product: p,
          profile: profiles[p.id]!,
          score: affinity(profile, profiles[p.id]!),
        }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
    : [];
  const moments =
    profile && (profile.seasons.length > 0 || profile.times.length > 0);

  return (
    <main className="pt-18">
      <div className="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="lg:sticky lg:top-18 lg:self-start">
          <ProductStage
            scene={findSceneSlug(product.unboxingScene)}
            media={product.media}
            name={product.name}
            brand={product.brand.name}
          />
        </div>
        <div className="px-5 py-14 sm:px-10 lg:px-16 lg:py-24">
          <Reveal>
            <Link
              href="/catalogo-olfativo"
              className="link-underline text-fg-muted text-2xs tracking-caps-lg uppercase"
            >
              ← {t('scent.back')}
            </Link>
            <Eyebrow className="mt-12">{product.brand.name}</Eyebrow>
            <Heading level={1} size="h1" className="mt-3">
              {product.name}
            </Heading>
            {product.concentration && (
              <p className="text-fg-muted font-display mt-4 text-xl italic">
                {t(`concentration.${product.concentration}`)}
              </p>
            )}
            {profile && profile.families.length > 0 && (
              <p className="font-display text-accent-fg mt-8 text-3xl font-light">
                {profile.families.map((f) => t(`family.${f}`)).join(' · ')}
              </p>
            )}
            {product.audience && (
              <div className="mt-6 flex flex-wrap gap-2">
                <Tag>{t(`audience.${product.audience}`)}</Tag>
              </div>
            )}
            {product.tagline && (
              <p className="text-fg-muted mt-8 max-w-md leading-relaxed">
                {product.tagline}
              </p>
            )}
          </Reveal>

          {product.description && (
            <Reveal delay={0.1} className="border-border mt-12 border-t pt-10">
              <Eyebrow as="h2" className="mb-4">
                {t('product.description')}
              </Eyebrow>
              <p className="leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </Reveal>
          )}

          {profile && hasNotes(profile) && (
            <Reveal delay={0.15} className="border-border mt-12 border-t pt-10">
              <ScentFootprint profile={profile} />
            </Reveal>
          )}

          <Reveal delay={0.2} className="border-border mt-12 border-t pt-10">
            <p className="text-fg-muted text-sm leading-relaxed">
              {t('scent.visit')}
            </p>
          </Reveal>
        </div>
      </div>

      {profile && hasNotes(profile) && (
        <section
          data-tone="oud"
          className="bg-surface text-fg grain relative overflow-hidden"
          aria-labelledby="piramide"
        >
          <div className="relative mx-auto max-w-[90rem] px-5 py-28 sm:px-10 sm:py-36">
            <Reveal className="mb-16 text-center">
              <Eyebrow tone="accent">{t('scent.pyramidEyebrow')}</Eyebrow>
              <Heading id="piramide" level={2} size="h1" className="mt-4">
                {t('scent.pyramidTitle')}
              </Heading>
            </Reveal>
            <Reveal delay={0.1}>
              <ScentPyramid profile={profile} />
            </Reveal>
          </div>
        </section>
      )}

      {profile && moments && (
        <section className="bg-surface-sunken">
          <div className="mx-auto grid max-w-[90rem] gap-16 px-5 py-28 sm:px-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,5fr)_minmax(0,3fr)] lg:items-center">
            <Reveal>
              <ScentSectionTitle
                eyebrow={t('scent.whenEyebrow')}
                title={t('scent.whenTitle')}
              />
            </Reveal>
            {profile.seasons.length > 0 && (
              <Reveal delay={0.1}>
                <Eyebrow as="h3" className="mb-6">
                  {t('scent.seasonFilter')}
                </Eyebrow>
                <SeasonWheel seasons={profile.seasons} />
              </Reveal>
            )}
            {profile.times.length > 0 && (
              <Reveal delay={0.2}>
                <Eyebrow as="h3" className="mb-6">
                  {t('scent.timeFilter')}
                </Eyebrow>
                <TimeOfDayView times={profile.times} />
              </Reveal>
            )}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="border-border mx-auto max-w-[90rem] border-t px-5 py-28 sm:px-10">
          <Reveal className="mb-14">
            <ScentSectionTitle
              eyebrow={t('scent.similarEyebrow')}
              title={t('scent.similarTitle', { name: product.name })}
            />
          </Reveal>
          <ul className="grid gap-x-6 gap-y-16 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((entry, index) => (
              <Reveal
                as="li"
                key={entry.product.id}
                delay={index * 0.1}
                className="min-w-0"
              >
                <ScentCard entry={entry} priority={false} />
              </Reveal>
            ))}
          </ul>
        </section>
      )}

      <p className="text-fg-muted mx-auto max-w-[90rem] px-5 pb-16 text-xs sm:px-10">
        {t('scent.sourceNote')}
      </p>
    </main>
  );
}
