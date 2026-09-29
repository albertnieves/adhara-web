import Image from 'next/image';
import type { ProductMedia } from '@/modules/catalog';
import { Star } from '@/modules/brand';

/**
 * Imagen de producto sobre el fondo cálido de la tienda. Las fotos de estudio
 * con fondo claro se funden con multiply. Sin imagen: marca y estrella.
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
  if (!media) {
    return (
      <div
        className={`text-smoke flex h-full w-full flex-col items-center justify-center gap-4 ${className}`}
      >
        <Star className="text-gold/60 size-5" />
        <span className="font-display text-xl tracking-[0.3em] uppercase">
          {brand}
        </span>
      </div>
    );
  }
  return (
    <Image
      src={media.url}
      alt={media.alt ?? alt}
      fill
      sizes={sizes}
      priority={priority}
      className={`object-contain mix-blend-multiply ${className}`}
    />
  );
}
