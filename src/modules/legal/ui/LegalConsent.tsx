'use client';

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useId, useState, useSyncExternalStore } from 'react';
import {
  Button,
  Checkbox,
  CloseButton,
  Eyebrow,
  useModal,
} from '@/components/ui';
import { Star } from '@/modules/brand';
import { Link, usePathname } from '@/modules/i18n';
import type { ConsentChoice, TrackingVendor } from '@/modules/tracking';
import {
  activeCategories,
  ALL_DENIED,
  ALL_GRANTED,
  closeCookieSettings,
  consentNeeded,
  saveConsent,
  useConsent,
  useCookieSettingsRequested,
  VENDOR_CATEGORY,
  VENDOR_NAMES,
} from '@/modules/tracking';
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
 * Aviso de entrada: hay que contestarlo antes de navegar (sin Esc ni clic
 * fuera). Enlaza el aviso legal, la privacidad y las cookies, y no se
 * muestra en esas páginas para poder leerlas antes. La aceptación queda en
 * una cookie técnica de un año con la versión de los textos.
 *
 * Con analítica o publicidad configuradas (`vendors`, DECISIONS §179), el
 * mismo aviso pide el consentimiento: «Rechazar» y «Aceptar todas» con el
 * mismo peso en la primera capa y «Configurar» por tipo en la segunda, como
 * pide la AEPD. Las dos respuestas dejan navegar. «Configurar cookies», al
 * pie de cada página, lo vuelve a abrir para cambiar de opinión.
 */
export function LegalConsent({
  vendors = [],
}: {
  vendors?: readonly TrackingVendor[];
}) {
  const t = useTranslations('legalConsent');
  const pathname = usePathname();
  // Las cookies solo se leen en el navegador (la página es estática): en el
  // servidor y al hidratar cuentan como contestadas y no se pinta nada.
  const stored = useSyncExternalStore(subscribe, hasAccepted, () => true);
  const consent = useConsent();
  const requested = useCookieSettingsRequested();
  const [acceptedNow, setAcceptedNow] = useState(false);
  const [view, setView] = useState<'notice' | 'settings'>('notice');
  const tracking = vendors.length > 0;
  const choicePending =
    tracking && consent.known && consentNeeded(consent.stored, vendors);
  const mustAnswer =
    ((!stored && !acceptedNow) || choicePending) && !LEGAL_PAGES.has(pathname);
  const open = mustAnswer || (tracking && requested);
  const settings = tracking && (requested || view === 'settings');
  const ref = useModal(open);
  const titleId = useId();

  const acceptLegal = () => {
    document.cookie = `${LEGAL_CONSENT_COOKIE}=${LEGAL_UPDATED_AT}; Max-Age=${LEGAL_CONSENT_MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
    setAcceptedNow(true);
  };

  const choose = (choice: ConsentChoice) => {
    acceptLegal();
    setView('notice');
    closeCookieSettings();
    // Puede recargar la página si retira un permiso: lo último.
    saveConsent(choice, vendors);
  };

  const close = () => {
    if (mustAnswer) return;
    setView('notice');
    closeCookieSettings();
  };

  const link = (href: (typeof LEGAL_PATHS)[keyof typeof LEGAL_PATHS]) =>
    function LegalLink(chunks: ReactNode) {
      return (
        <Link href={href} className="link-underline text-accent-fg">
          {chunks}
        </Link>
      );
    };

  const categories = activeCategories(vendors);
  const legalLinks = (
    <p className="text-fg-muted text-sm leading-relaxed">
      {t.rich(tracking ? 'linksTracking' : 'links', {
        notice: link(LEGAL_PATHS.legalNotice),
        privacy: link(LEGAL_PATHS.privacy),
        cookies: link(LEGAL_PATHS.cookies),
      })}
    </p>
  );

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="dialog"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
    >
      {open && settings && (
        <CookieSettings
          key={consent.known && consent.stored ? consent.stored.at : 0}
          titleId={titleId}
          vendors={vendors}
          initial={
            consent.known && consent.stored && !choicePending
              ? consent.stored.choice
              : ALL_DENIED
          }
          onChoose={choose}
          onClose={mustAnswer ? null : close}
        >
          {legalLinks}
        </CookieSettings>
      )}
      {open && !settings && (
        <div className="flex flex-col gap-5 p-8">
          <Star className="text-accent size-4" />
          <div>
            <Eyebrow tone="accent">{t('eyebrow')}</Eyebrow>
            <h2
              id={titleId}
              tabIndex={-1}
              {...(tracking ? { 'data-autofocus': '' } : {})}
              className="font-display mt-3 text-3xl leading-tight font-light outline-none"
            >
              {t('title')}
            </h2>
          </div>
          <p className="text-fg-muted text-sm leading-relaxed">
            {tracking
              ? t(
                  categories.length === 2
                    ? 'bodyBoth'
                    : categories[0] === 'ads'
                      ? 'bodyAds'
                      : 'bodyAnalytics',
                )
              : t('body')}
          </p>
          {legalLinks}
          {tracking ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={() => choose(ALL_DENIED)}>
                  {t('reject')}
                </Button>
                <Button onClick={() => choose(ALL_GRANTED)}>
                  {t('acceptAll')}
                </Button>
              </div>
              <Button variant="outline" onClick={() => setView('settings')}>
                {t('configure')}
              </Button>
            </div>
          ) : (
            <Button data-autofocus="" onClick={acceptLegal} className="w-full">
              {t('accept')}
            </Button>
          )}
        </div>
      )}
    </dialog>
  );
}

/** Segunda capa: un interruptor por tipo, apagados hasta que se elijan. */
function CookieSettings({
  titleId,
  vendors,
  initial,
  onChoose,
  onClose,
  children,
}: {
  titleId: string;
  vendors: readonly TrackingVendor[];
  initial: ConsentChoice;
  onChoose: (choice: ConsentChoice) => void;
  /** null mientras tenga que contestar. */
  onClose: (() => void) | null;
  children: ReactNode;
}) {
  const t = useTranslations('legalConsent');
  const [choice, setChoice] = useState<ConsentChoice>(initial);
  const names = (category: 'analytics' | 'ads') =>
    vendors
      .filter((vendor) => VENDOR_CATEGORY[vendor] === category)
      .map((vendor) => VENDOR_NAMES[vendor]);
  return (
    <div className="flex flex-col gap-5 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow tone="accent">{t('settingsEyebrow')}</Eyebrow>
          <h2
            id={titleId}
            tabIndex={-1}
            data-autofocus=""
            className="font-display mt-3 text-3xl leading-tight font-light outline-none"
          >
            {t('settingsTitle')}
          </h2>
        </div>
        {onClose && <CloseButton label={t('close')} onClick={onClose} />}
      </header>
      <p className="text-fg-muted text-sm leading-relaxed">
        {t('settingsIntro')}
      </p>
      <div className="flex flex-col gap-2">
        <Checkbox
          label={t('technical')}
          hint={t('technicalHint')}
          checked
          disabled
          readOnly
        />
        {activeCategories(vendors).map((category) => (
          <Checkbox
            key={category}
            name={category}
            label={t(category)}
            hint={t(`${category}Hint`, {
              vendors: names(category).join(', '),
              count: names(category).length,
            })}
            checked={choice[category]}
            onChange={(event) =>
              setChoice({ ...choice, [category]: event.target.checked })
            }
          />
        ))}
      </div>
      {children}
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <Button onClick={() => onChoose(ALL_DENIED)}>{t('rejectAll')}</Button>
          <Button onClick={() => onChoose(ALL_GRANTED)}>
            {t('acceptAll')}
          </Button>
        </div>
        <Button variant="outline" onClick={() => onChoose(choice)}>
          {t('save')}
        </Button>
      </div>
    </div>
  );
}
