import { useLocale, useTranslations } from 'next-intl';
import { formatEuros } from '@/lib/money';
import type { StorefrontProduct } from '@/modules/catalog';
import { heroMedia, lowestPrice, variantLabel } from '@/modules/catalog';
import { Link } from '@/modules/i18n';
import { ProductImage } from './ProductImage';

/**
 * Tarjeta de la colección: la imagen respira al pasar el cursor y, si hay una
 * segunda imagen (la caja), aparece con un fundido.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: StorefrontProduct;
  priority?: boolean;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const price = lowestPrice(product);
  const priced = product.variants.filter((v) => v.priceCents !== null);
  const media = heroMedia(product);
  const alternate = product.media.find((m) => m.url !== media?.url) ?? null;
  const sizes = product.variants.map(variantLabel).join(' · ');

  return (
    <Link
      href={{ pathname: '/perfume/[slug]', params: { slug: product.slug } }}
      className="group block min-w-0"
    >
      <div className="bg-stage relative aspect-[4/5] overflow-hidden">
        <div
          // Fondo propio: al escalar, la capa se aísla y multiply necesita un fondo dentro.
          className={`bg-stage absolute inset-6 transition-[transform,opacity] duration-[1.6s] ease-(--ease-luxe) group-hover:scale-[1.05] ${alternate ? 'group-hover:opacity-0' : ''}`}
        >
          <ProductImage
            media={media}
            alt={`${product.brand.name} ${product.name}`}
            brand={product.brand.name}
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw"
            priority={priority}
          />
        </div>
        {alternate && (
          <div
            aria-hidden
            className="bg-stage absolute inset-6 scale-[0.97] opacity-0 transition-[transform,opacity] duration-[1.6s] ease-(--ease-luxe) group-hover:scale-100 group-hover:opacity-100"
          >
            <ProductImage
              media={alternate}
              alt=""
              brand={product.brand.name}
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw"
            />
          </div>
        )}
        {media?.provisional && (
          <span className="text-fg-muted text-2xs tracking-caps absolute top-3 left-3 uppercase">
            {t('product.provisionalImage')}
          </span>
        )}
        <span
          aria-hidden
          className="bg-gold absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-700 ease-(--ease-luxe) group-hover:scale-x-100"
        />
      </div>
      <div className="mt-5 min-w-0">
        <p className="eyebrow">{product.brand.name}</p>
        <h3 className="font-display mt-1.5 line-clamp-2 text-2xl leading-tight">
          {product.name}
        </h3>
        <p className="text-smoke mt-1 text-xs">
          {[
            product.concentration
              ? t(`concentration.${product.concentration}`)
              : null,
            sizes !== '—' ? sizes : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <p className="mt-3 text-sm tabular-nums">
          {price === null
            ? t('product.pricePending')
            : priced.length > 1
              ? t('product.from', { price: formatEuros(price, locale) })
              : formatEuros(price, locale)}
        </p>
      </div>
    </Link>
  );
}
