import { getTranslations } from 'next-intl/server';
import { checkoutTestMode } from '@/modules/payments/server/config';

/**
 * Aviso de la venta en pruebas (DECISIONS §193): mientras el banco valida el
 * comercio, la tienda cobra con su entorno de pruebas y ningún pago es real.
 * Sale en la cesta, en «Finalizar compra» y en la página del pedido; con la
 * clave real (`live`) no pinta nada.
 */
export async function CheckoutTestNotice({
  className = '',
}: {
  className?: string;
}) {
  if (!checkoutTestMode()) return null;
  const t = await getTranslations('checkout');
  return (
    <p
      role="note"
      data-testid="checkout-test-notice"
      className={`border-warning bg-warning-soft text-warning border px-4 py-3 text-sm leading-relaxed ${className}`}
    >
      <strong className="font-semibold">{t('testNoticeTitle')}</strong>{' '}
      {t('testNotice')}
    </p>
  );
}
