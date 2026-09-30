'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { formatEuros } from '@/lib/money';
import type { Availability, ProductVariant } from '@/modules/catalog';
import { variantLabel } from '@/modules/catalog';

const DOT: Record<Availability, string> = {
  in_stock: 'bg-success',
  low_stock: 'bg-gold',
  out_of_stock: 'bg-mist',
};
const LABEL: Record<Availability, 'inStock' | 'lowStock' | 'outOfStock'> = {
  in_stock: 'inStock',
  low_stock: 'lowStock',
  out_of_stock: 'outOfStock',
};

/** Formato, precio y disponibilidad. La compra online llega en la Fase 10. */
export function PurchasePanel({
  variants,
  availability,
}: {
  variants: ProductVariant[];
  availability: Record<string, Availability>;
}) {
  const t = useTranslations('product');
  const locale = useLocale();
  const [selectedId, setSelectedId] = useState(variants[0]?.id ?? null);
  const selected = variants.find((v) => v.id === selectedId) ?? null;
  const status = selected ? availability[selected.id] : undefined;

  return (
    <div className="space-y-8">
      <div className="min-h-[3.25rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={selected?.id ?? 'none'}
            className="font-display text-4xl font-light lining-nums tabular-nums"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            {selected?.priceCents != null ? (
              <>
                {formatEuros(selected.priceCents, locale)}
                {selected.compareAtCents != null && (
                  <s className="text-mist ml-4 text-2xl">
                    {formatEuros(selected.compareAtCents, locale)}
                  </s>
                )}
                <span className="text-smoke ml-3 align-middle text-[0.625rem] font-normal tracking-[0.2em] uppercase">
                  {t('vat')}
                </span>
              </>
            ) : (
              <span className="text-smoke text-2xl">{t('pricePending')}</span>
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      {variants.length > 0 && (
        <fieldset>
          <legend className="eyebrow mb-3">{t('size')}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                aria-pressed={variant.id === selectedId}
                onClick={() => setSelectedId(variant.id)}
                className={`min-w-20 border px-4 py-3 text-xs tracking-[0.15em] transition-colors duration-500 ${
                  variant.id === selectedId
                    ? 'border-ink bg-ink text-ivory'
                    : 'border-line hover:border-ink'
                }`}
              >
                {variantLabel(variant)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {status && (
        <p className="flex items-center gap-3 text-xs tracking-[0.2em] uppercase">
          <span className={`size-1.5 rounded-full ${DOT[status]}`} />
          {t(LABEL[status])}
        </p>
      )}

      <div className="space-y-4">
        <button type="button" disabled className="btn btn-primary w-full">
          {t('buySoon')}
        </button>
        <p className="text-smoke text-sm leading-relaxed">{t('storeNote')}</p>
      </div>
    </div>
  );
}
