'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { useRouter } from '@/modules/i18n';

const EVERY_MS = 4000;
const TRIES = 15;

/**
 * Vuelta del banco antes de que llegue su notificación: la página se vuelve a
 * leer cada pocos segundos durante un minuto. Nunca confirma nada por sí sola.
 */
export function AwaitingConfirmation() {
  const t = useTranslations('order');
  const router = useRouter();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (tries >= TRIES) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setTries((n) => n + 1);
    }, EVERY_MS);
    return () => window.clearTimeout(timer);
  }, [router, tries]);

  return (
    <p role="status" className="text-fg-muted leading-relaxed">
      {tries >= TRIES ? t('confirmingSlow') : t('confirmingText')}
    </p>
  );
}
