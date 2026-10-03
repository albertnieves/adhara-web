import { formatEuros } from '@/lib/money';
import type { Cents } from '@/lib/money';
import { cx } from './cx';

export type PriceSize = 'sm' | 'md' | 'lg';

const SIZES: Record<PriceSize, { now: string; before: string }> = {
  sm: { now: 'text-sm', before: 'text-xs' },
  md: { now: 'text-base', before: 'text-sm' },
  lg: { now: 'font-display text-4xl font-light', before: 'text-2xl' },
};

/**
 * PVP (Fase 2, DS-09) en el formato de cada idioma, con cifras tabulares.
 * El precio anterior solo sale si es mayor (rebaja, regla Ómnibus en
 * docs/PRICING.md); va tachado y con «antes» para el lector de pantalla, que
 * no anuncia el tachado. Los textos llegan del idioma de la página.
 */
export function Price({
  cents,
  compareAtCents,
  from = false,
  locale,
  labels,
  size = 'md',
  className,
}: {
  cents: Cents;
  /** Precio anterior de una rebaja. */
  compareAtCents?: Cents | null;
  /** Hay varios formatos y este es el más económico. */
  from?: boolean;
  locale: string;
  labels: { from: string; before: string };
  size?: PriceSize;
  className?: string;
}) {
  const discounted = compareAtCents != null && compareAtCents > cents;
  return (
    <span
      className={cx(
        'inline-flex flex-wrap items-baseline gap-x-3 lining-nums tabular-nums',
        className,
      )}
    >
      <span className={SIZES[size].now}>
        {from && (
          <span className="text-fg-muted font-sans text-xs">
            {labels.from}{' '}
          </span>
        )}
        {formatEuros(cents, locale)}
      </span>
      {/* Espacio para el lector de pantalla; en el flex no se ve. */}
      {discounted && ' '}
      {discounted && (
        <s className={cx('text-fg-muted', SIZES[size].before)}>
          <span className="sr-only">{labels.before} </span>
          {formatEuros(compareAtCents, locale)}
        </s>
      )}
    </span>
  );
}
