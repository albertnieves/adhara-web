import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { formatEuros } from '@/lib/money';
import { requirePermission } from '@/modules/auth/server';
import { getAdminProduct } from '@/modules/catalog/server/admin';
import { ProductStage, PurchasePanel } from '@/modules/storefront';
import { findSceneSlug } from '@/modules/unboxing';

export const metadata: Metadata = { title: 'Vista previa' };

/**
 * Ficha tal como se verá en la tienda, también para borradores (solo personal).
 * Usa los mismos componentes que la tienda con los textos en español.
 */
export default async function ProductPreview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { supabase } = await requirePermission('catalog.edit');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const product = await getAdminProduct(supabase, id);
  if (!product) notFound();
  const messages = await getMessages({ locale: 'es' });
  const text = product.translations.find((t) => t.locale === 'es');
  const variants = product.variants
    .filter((v) => v.active)
    .map((v) => ({
      id: v.id,
      label: v.label,
      sizeMl: v.size_ml,
      priceCents: v.retail_price_cents,
      compareAtCents: v.compare_at_price_cents,
      position: v.position,
    }));
  const media = product.media.map((m) => ({
    url: m.url,
    alt: m.alt,
    role: m.role as 'hero' | 'gallery' | 'box',
    origin: m.origin as 'own_photo',
    provisional: m.provisional,
    position: m.position,
  }));

  return (
    <NextIntlClientProvider locale="es" messages={messages}>
      <main className="-mx-5 -my-10 sm:-mx-10">
        <div className="bg-gold/15 flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-xs sm:px-10">
          <span>
            Vista previa ·{' '}
            {product.status === 'published' ? 'publicado' : 'no publicado'}
            {variants.some((v) => v.priceCents === null) && ' · falta PVP'}
          </span>
          <Link
            href={`/admin/catalogo/${product.id}`}
            className="link-underline"
          >
            Volver a editar
          </Link>
        </div>
        <div className="grid xl:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <ProductStage
            scene={findSceneSlug(product.unboxing_scene)}
            media={media}
            name={product.name}
            brand={product.brand.name}
          />
          <div className="px-5 py-12 sm:px-10">
            <p className="eyebrow">{product.brand.name}</p>
            <h1 className="mt-3 text-6xl leading-[0.95] font-light">
              {product.name}
            </h1>
            {text?.tagline && (
              <p className="text-smoke mt-6 max-w-md leading-relaxed">
                {text.tagline}
              </p>
            )}
            <div className="border-line mt-10 border-t pt-8">
              <PurchasePanel variants={variants} availability={{}} />
            </div>
            {text?.description && (
              <p className="border-line mt-10 border-t pt-8 leading-relaxed whitespace-pre-line">
                {text.description}
              </p>
            )}
            {variants.length > 0 && (
              <p className="text-mist mt-8 text-xs">
                PVP:{' '}
                {variants
                  .map((v) =>
                    v.priceCents === null
                      ? 'pendiente'
                      : formatEuros(v.priceCents, 'es'),
                  )
                  .join(' · ')}
              </p>
            )}
          </div>
        </div>
      </main>
    </NextIntlClientProvider>
  );
}
