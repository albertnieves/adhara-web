import { useLocale, useTranslations } from 'next-intl';
import { Eyebrow, Heading, Price } from '@/components/ui';
import type { StorefrontProduct } from '@/modules/catalog';
import { heroMedia, lowestPrice, variantLabel } from '@/modules/catalog';
import { Link } from '@/modules/i18n';
import { findSceneSlug } from '@/modules/unboxing';
import { CardStage } from './CardStage';

/**
 * Tarjeta de la colección: la foto va en una vitrina que se inclina hacia el
 * cursor (`CardStage`) y, si hay una segunda imagen (la caja), aparece con un
 * fundido. Los perfumes con escena llevan la marca «Vista 3D». `compact` es la
 * de la cuadrícula de dos columnas del móvil; desde 640 px es igual que la
 * normal.
 */
export function ProductCard({
  product,
  priority = false,
  compact = false,
}: {
  product: StorefrontProduct;
  priority?: boolean;
  compact?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const price = lowestPrice(product);
  const priced = product.variants.filter((v) => v.priceCents !== null);
  const media = heroMedia(product);
  const alternate = product.media.find((m) => m.url !== media?.url) ?? null;
  const sizes = product.variants.map(variantLabel).join(' · ');
  const inset = compact ? 'inset-3 sm:inset-6' : 'inset-6';
  const imageSizes = `(min-width: 1024px) 25vw, (min-width: 640px) 45vw, ${compact ? '45vw' : '90vw'}`;

  return (
    <Link
      href={{ pathname: '/perfume/[slug]', params: { slug: product.slug } }}
      className="group block min-w-0"
    >
      <CardStage
        media={media}
        alternate={alternate}
        alt={`${product.brand.name} ${product.name}`}
        brand={product.brand.name}
        sizes={imageSizes}
        priority={priority}
        inset={inset}
      >
        {findSceneSlug(product.unboxingScene) && (
          <span className="bg-surface-raised text-fg text-2xs tracking-caps absolute top-3 left-3 px-2 py-1 font-sans font-semibold uppercase">
            {t('product.scene3d')}
          </span>
        )}
      </CardStage>
      <div className={`min-w-0 ${compact ? 'mt-3 sm:mt-5' : 'mt-5'}`}>
        <Eyebrow>{product.brand.name}</Eyebrow>
        <Heading level={3} size="h3" className="mt-1.5 line-clamp-2">
          {product.name}
        </Heading>
        <p className="text-fg-muted mt-1 text-xs">
          {[
            product.concentration
              ? t(`concentration.${product.concentration}`)
              : null,
            sizes !== '—' ? sizes : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className={`text-sm ${compact ? 'mt-2 sm:mt-3' : 'mt-3'}`}>
          {price === null ? (
            t('product.pricePending')
          ) : (
            <Price
              cents={price}
              from={priced.length > 1}
              locale={locale}
              labels={{ from: t('product.from'), before: t('product.before') }}
              size="sm"
            />
          )}
        </p>
      </div>
    </Link>
  );
}
