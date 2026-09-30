import { divideHalfEven, formatEuros } from '@/lib/money';
import { Star } from '@/modules/brand';
import { CONCENTRATION_NAMES, isConcentration } from '../domain/product';

export type PriceLabelValues = {
  brandName: string;
  productName: string;
  concentration: string | null;
  sizeMl: number | null;
  variantLabel: string;
  sku: string | null;
  priceCents: number;
  compareAtCents: number | null;
};

/**
 * Etiqueta de estante de 63,5 × 38,1 mm (hojas A4 de 3 × 7). PVP con IVA; en
 * rebaja, el precio anterior validado con Ómnibus. Medidas en mm y pt para que
 * la impresión coincida con la hoja.
 */
export function PriceLabelCard({
  label,
  cutLines,
}: {
  label: PriceLabelValues;
  cutLines: boolean;
}) {
  const concentration =
    label.concentration &&
    isConcentration(label.concentration) &&
    label.concentration !== 'OTHER'
      ? CONCENTRATION_NAMES[label.concentration]
      : null;
  const details = [
    concentration,
    label.variantLabel !== '—' && label.variantLabel,
  ]
    .filter(Boolean)
    .join(' · ');
  const perHundred = label.sizeMl
    ? divideHalfEven(label.priceCents * 100, label.sizeMl)
    : null;

  return (
    <article
      className={`text-ink flex h-[38.1mm] w-[63.5mm] break-inside-avoid flex-col justify-between overflow-hidden bg-white px-[3.5mm] py-[3mm] ${cutLines ? 'border-line border-[0.2mm]' : ''}`}
    >
      <header className="flex items-center justify-between gap-[2mm]">
        <p className="truncate text-[6pt] tracking-[0.24em] uppercase">
          {label.brandName}
        </p>
        <Star className="text-gold size-[2.4mm] shrink-0" />
      </header>
      <div className="min-w-0">
        <h2 className="font-display line-clamp-2 text-[14pt] leading-[1.02]">
          {label.productName}
        </h2>
        {details && (
          <p className="text-smoke mt-[0.8mm] truncate text-[6.5pt]">
            {details}
          </p>
        )}
      </div>
      <footer className="flex items-end justify-between gap-[2mm]">
        <p className="text-smoke text-[5.5pt] leading-[1.3] tabular-nums">
          {perHundred !== null && (
            <span className="block">
              {formatEuros(perHundred, 'es')} / 100 ml
            </span>
          )}
          {label.sku && <span className="block">{label.sku}</span>}
        </p>
        <div className="text-right leading-none">
          {label.compareAtCents !== null && (
            <p className="text-smoke text-[6.5pt] lining-nums tabular-nums">
              Antes <s>{formatEuros(label.compareAtCents, 'es')}</s>
            </p>
          )}
          <p className="font-display text-[17pt] lining-nums tabular-nums">
            {formatEuros(label.priceCents, 'es')}
          </p>
          <p className="text-smoke mt-[0.8mm] text-[5pt] tracking-[0.12em] uppercase">
            IVA incl.
          </p>
        </div>
      </footer>
    </article>
  );
}
