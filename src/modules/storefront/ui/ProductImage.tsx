import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { ProductMedia } from '@/modules/catalog';
import { Star } from '@/modules/brand';

/**
 * Imagen de producto sobre el fondo cálido de la tienda. Las fotos de estudio
 * traen fondo gris muy claro (246/255): un +4 % de brillo lo lleva a blanco y
 * multiply lo funde con el fondo. Sin imagen: marca y estrella.
 */
export function ProductImage({
  media,
  alt,
  brand,
  sizes,
  priority = false,
  className = '',
}: {
  media: ProductMedia | null;
  alt: string;
  brand: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const t = useTranslations('product');
  if (!media) {
    return (
      <div
        className={`text-fg-muted flex h-full w-full flex-col items-center justify-center gap-4 ${className}`}
      >
        <Star className="text-accent/60 size-5" />
        <span className="font-display tracking-caps-lg text-xl uppercase">
          {brand}
        </span>
      </div>
    );
  }
  return (
    <>
      <Image
        src={media.url}
        alt={
          media.origin === 'generated_draft'
            ? `${media.alt ?? alt} · ${t('generatedImage')}`
            : (media.alt ?? alt)
        }
        fill
        sizes={sizes}
        priority={priority}
        className={`object-contain ${media.origin === 'generated_draft' ? '' : 'mix-blend-multiply brightness-[1.04]'} ${className}`}
      />
      {media.origin === 'generated_draft' && (
        <span className="bg-surface/95 text-fg-muted text-2xs absolute inset-x-0 bottom-0 px-2 py-1 text-center">
          {t('generatedImage')}
        </span>
      )}
    </>
  );
}
