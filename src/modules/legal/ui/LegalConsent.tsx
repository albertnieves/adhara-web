'use client';

import { useTranslations } from 'next-intl';
import { useId, useState, useSyncExternalStore } from 'react';
import { Button, Eyebrow, useModal } from '@/components/ui';
import { Star } from '@/modules/brand';
import { Link, usePathname } from '@/modules/i18n';
import {
  LEGAL_CONSENT_COOKIE,
  LEGAL_CONSENT_MAX_AGE,
  LEGAL_UPDATED_AT,
} from '../domain/entity';
import { LEGAL_PATHS } from '../domain/routes';

const LEGAL_PAGES = new Set<string>(Object.values(LEGAL_PATHS));

function hasAccepted() {
  return document.cookie
    .split('; ')
    .includes(`${LEGAL_CONSENT_COOKIE}=${LEGAL_UPDATED_AT}`);
}

/** La cookie no avisa de sus cambios: basta con leerla al pintar. */
const subscribe = () => () => {};

/**
 * Aviso de entrada: hay que aceptarlo antes de navegar (sin Esc ni clic
 * fuera). Enlaza el aviso legal, la privacidad y las cookies, y no se
 * muestra en esas páginas para poder leerlas antes. La aceptación queda en
 * una cookie técnica de un año con la versión de los textos.
 */
export function LegalConsent() {
  const t = useTranslations('legalConsent');
  const pathname = usePathname();
  // La cookie solo se lee en el navegador (la página es estática): en el
  // servidor y al hidratar cuenta como aceptada y no se pinta nada.
  const stored = useSyncExternalStore(subscribe, hasAccepted, () => true);
  const [acceptedNow, setAcceptedNow] = useState(false);
  const open = !stored && !acceptedNow && !LEGAL_PAGES.has(pathname);
  const ref = useModal(open);
  const titleId = useId();

  const accept = () => {
    document.cookie = `${LEGAL_CONSENT_COOKIE}=${LEGAL_UPDATED_AT}; Max-Age=${LEGAL_CONSENT_MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setAcceptedNow(true);
  };

  const link = (href: (typeof LEGAL_PATHS)[keyof typeof LEGAL_PATHS]) =>
    function LegalLink(chunks: React.ReactNode) {
      return (
        <Link href={href} className="link-underline text-accent-fg">
          {chunks}
        </Link>
      );
    };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="dialog"
      onCancel={(event) => event.preventDefault()}
    >
      {open && (
        <div className="flex flex-col gap-5 p-8">
          <Star className="text-accent size-4" />
          <div>
            <Eyebrow tone="accent">{t('eyebrow')}</Eyebrow>
            <h2
              id={titleId}
              className="font-display mt-3 text-3xl leading-tight font-light"
            >
              {t('title')}
            </h2>
          </div>
          <p className="text-fg-muted text-sm leading-relaxed">{t('body')}</p>
          <p className="text-fg-muted text-sm leading-relaxed">
            {t.rich('links', {
              notice: link(LEGAL_PATHS.legalNotice),
              privacy: link(LEGAL_PATHS.privacy),
              cookies: link(LEGAL_PATHS.cookies),
            })}
          </p>
          <Button data-autofocus="" onClick={accept} className="w-full">
            {t('accept')}
          </Button>
        </div>
      )}
    </dialog>
  );
}
