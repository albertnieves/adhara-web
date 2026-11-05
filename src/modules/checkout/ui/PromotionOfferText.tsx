import { useTranslations } from 'next-intl';
import { formatEuros } from '@/lib/money';
import type { PromotionOffer } from '@/modules/promotions';
import { formatDiscountValue } from '@/modules/promotions';
import type { FreeShippingOffer } from '@/modules/shipping';

type Locale = 'es' | 'ca' | 'en';

/** Final de una promoción en hora de Madrid: «30 nov 2026, 23:59». */
export function promotionDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Madrid',
  }).format(new Date(iso));
}

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
  locale: Locale;
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
    parts.push(t('until', { date: promotionDate(offer.endsAt, locale) }));
  return <>{parts.join(' ')}</>;
}

/**
 * Envío gratis temporal (DECISIONS §189), también con sus reglas: «Envío
 * gratis a Baleares en pedidos desde 30 €. Hasta el 15 dic 2026, 23:59.». La
 * zona solo se nombra si no vale en todas las que tienen envío; si algún
 * servicio no cuenta (un urgente), se avisa.
 */
export function FreeShippingOfferText({
  offer,
  locale,
}: {
  offer: FreeShippingOffer;
  locale: Locale;
}) {
  const t = useTranslations('promotion');
  const zone = offer.everywhere
    ? null
    : offer.zones.map((z) => t(`zones.${z}`)).join(', ');
  const minimum = formatEuros(offer.minItemsCents, locale);
  const parts = [
    offer.minItemsCents === 0
      ? zone
        ? t('freeShippingAllZone', { zone })
        : t('freeShippingAll')
      : zone
        ? t('freeShippingZone', { zone, minimum })
        : t('freeShipping', { minimum }),
  ];
  if (!offer.allServices) parts.push(t('freeShippingOptions'));
  parts.push(t('until', { date: promotionDate(offer.endsAt, locale) }));
  return <>{parts.join(' ')}</>;
}
