'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Badge, Button, Eyebrow, Price } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import type { Availability, ProductVariant } from '@/modules/catalog';
import { variantLabel } from '@/modules/catalog';

const TONE: Record<Availability, BadgeTone> = {
  in_stock: 'success',
  low_stock: 'warning',
  out_of_stock: 'neutral',
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
            className="flex flex-wrap items-baseline gap-x-3"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4 }}
          >
            {selected?.priceCents != null ? (
              <>
                <Price
                  cents={selected.priceCents}
                  compareAtCents={selected.compareAtCents}
                  locale={locale}
                  labels={{ from: t('from'), before: t('before') }}
                  size="lg"
                />
                <Eyebrow as="span">{t('vat')}</Eyebrow>
              </>
            ) : (
              <span className="text-fg-muted font-display text-2xl">
                {t('pricePending')}
              </span>
            )}
          </motion.p>
        </AnimatePresence>
      </div>

      {variants.length > 0 && (
        <fieldset>
          <legend className="mb-3">
            <Eyebrow as="span">{t('size')}</Eyebrow>
          </legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((variant) => (
              <button
                key={variant.id}
                type="button"
                aria-pressed={variant.id === selectedId}
                onClick={() => setSelectedId(variant.id)}
                className={`tracking-caps ease-luxe min-h-11 min-w-20 border px-4 text-xs transition-colors duration-(--duration-base) ${
                  variant.id === selectedId
                    ? 'border-fg bg-fg text-fg-inverse'
                    : 'border-border-strong hover:border-fg'
                }`}
              >
                {variantLabel(variant)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {status && <Badge tone={TONE[status]}>{t(LABEL[status])}</Badge>}

      <div className="space-y-4">
        <Button size="lg" disabled className="w-full">
          {t('buySoon')}
        </Button>
        <p className="text-fg-muted text-sm leading-relaxed">
          {t('storeNote')}
        </p>
      </div>
    </div>
  );
}
