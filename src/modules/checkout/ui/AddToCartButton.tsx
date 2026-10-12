'use client';

import { useTranslations } from 'next-intl';
import { useActionState, useEffect } from 'react';
import { SubmitButton } from '@/components/ui';
import { Link } from '@/modules/i18n';
import { CART_EVENT } from '../domain/cart';
import type { AddToCartState } from '../server/actions';
import { addToCartAction } from '../server/actions';

const IDLE: AddToCartState = { status: 'idle' };

/**
 * Añade una unidad del formato elegido a la cesta (cookie en el servidor) y
 * avisa a la cabecera para que vuelva a contar. `onAdded` deja a la tienda
 * sumar su «añadido a la cesta» anónimo.
 */
export function AddToCartButton({
  variantId,
  onAdded,
}: {
  variantId: string;
  onAdded?: () => void;
}) {
  const t = useTranslations('cart');
  const [state, dispatch, pending] = useActionState(addToCartAction, IDLE);

  useEffect(() => {
    if (state.status !== 'added') return;
    window.dispatchEvent(new Event(CART_EVENT));
    onAdded?.();
    // Solo al cambiar el resultado, no si cambia la función.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={dispatch} className="space-y-3">
      <input type="hidden" name="variantId" value={variantId} />
      <SubmitButton
        size="lg"
        className="w-full"
        pending={pending}
        pendingLabel={t('adding')}
      >
        {t('add')}
      </SubmitButton>
      <p role="status" aria-live="polite" className="text-sm">
        {state.status === 'added' && (
          <>
            {t('added')}{' '}
            <Link href="/cesta" className="link-underline font-semibold">
              {t('view')}
            </Link>
          </>
        )}
        {state.status === 'full' && (
          <span className="text-danger">{t('full')}</span>
        )}
        {state.status === 'max' && (
          <span className="text-danger">{t('max')}</span>
        )}
        {state.status === 'error' && (
          <span className="text-danger">{t('addError')}</span>
        )}
      </p>
    </form>
  );
}
