import { useTranslations } from 'next-intl';
import { formatEuros } from '@/lib/money';
import type { PromotionOffer } from '@/modules/promotions';
import { formatDiscountValue } from '@/modules/promotions';

/**
 * Cómo se describe una promoción en la tienda (DECISIONS §186), con sus
 * reglas y no con su nombre interno: «10 % de descuento en pedidos desde
 * 100 €. Hasta el 30 nov 2026, 23:59.». Sirve en la cesta (servidor) y en
 * «Finalizar compra» (cliente).
 */
export function PromotionOfferText({
  offer,
  locale,
}: {
  offer: PromotionOffer;
  locale: 'es' | 'ca' | 'en';
}) {
  const t = useTranslations('promotion');
  const value = formatDiscountValue(offer, locale);
  const minimum = formatEuros(offer.minItemsCents, locale);
  const parts = [
    offer.brandName
      ? t('offerBrand', { value, minimum, brand: offer.brandName })
      : t('offer', { value, minimum }),
  ];
  if (offer.excludeSaleItems) parts.push(t('noSale'));
  if (offer.endsAt)
    parts.push(
      t('until', {
        date: new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Europe/Madrid',
        }).format(new Date(offer.endsAt)),
      }),
    );
  return <>{parts.join(' ')}</>;
}
