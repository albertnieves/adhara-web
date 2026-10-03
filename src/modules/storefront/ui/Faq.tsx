import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { Eyebrow, Heading, Icon } from '@/components/ui';
import type { StoreContent } from '@/modules/content';
import { Reveal } from './Reveal';

/** Ancla de la sección: la enlaza el pie desde cualquier página. */
export const FAQ_ANCHOR = 'preguntas-frecuentes';

/**
 * Preguntas frecuentes de la portada, plegadas: solo se ven las preguntas y
 * se abre una cada vez (`<details name>`, sin JavaScript). Las respuestas
 * dicen lo que ya consta en la tienda; los envíos y las devoluciones se
 * publicarán con la compra online. Los datos de la tienda salen del panel.
 */
export async function Faq({ store }: { store: StoreContent }) {
  const t = await getTranslations('faq');
  const contact = [store.phone, store.email].filter(Boolean);

  const items: { id: string; question: string; answer: ReactNode }[] = [
    { id: 'compra', question: t('buyOnlineQ'), answer: t('buyOnlineA') },
    {
      id: 'tienda',
      question: t('visitQ'),
      answer: (
        <>
          {t('visitA', { address: store.address, city: store.city })}
          {store.hours && (
            <span className="mt-3 block whitespace-pre-line">
              {t('hours')}: {store.hours}
            </span>
          )}
          {contact.length > 0 && (
            <span className="mt-3 block">
              {t('contact')}:{' '}
              {store.phone && (
                <a
                  href={`tel:${store.phone.replace(/[^+\d]/g, '')}`}
                  className="link-underline text-fg"
                >
                  {store.phone}
                </a>
              )}
              {store.phone && store.email && ' · '}
              {store.email && (
                <a
                  href={`mailto:${store.email}`}
                  className="link-underline text-fg"
                >
                  {store.email}
                </a>
              )}
            </span>
          )}
        </>
      ),
    },
    { id: 'seleccion', question: t('selectionQ'), answer: t('selectionA') },
    {
      id: 'concentracion',
      question: t('concentrationQ'),
      answer: t('concentrationA'),
    },
    { id: 'precios', question: t('pricesQ'), answer: t('pricesA') },
  ];

  return (
    <section
      id={FAQ_ANCHOR}
      aria-labelledby={`${FAQ_ANCHOR}-titulo`}
      className="mx-auto grid max-w-[90rem] scroll-mt-18 gap-10 px-5 py-24 sm:px-10 sm:py-28 lg:grid-cols-[1fr_2fr] lg:gap-16"
    >
      <Reveal>
        <Eyebrow>{t('eyebrow')}</Eyebrow>
        <Heading
          level={2}
          size="h2"
          id={`${FAQ_ANCHOR}-titulo`}
          className="mt-4"
        >
          {t('title')}
        </Heading>
      </Reveal>
      <div className="border-border border-t">
        {items.map((item) => (
          <details
            key={item.id}
            name="preguntas"
            className="group border-border border-b"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
              <span className="font-display text-xl leading-snug sm:text-2xl">
                {item.question}
              </span>
              {/* Más y menos, sin girar: un icono girado sale de su caja. */}
              <Icon
                name="plus"
                className="text-fg-muted shrink-0 group-open:hidden"
              />
              <Icon
                name="minus"
                className="text-fg-muted hidden shrink-0 group-open:block"
              />
            </summary>
            <p className="text-fg-muted max-w-2xl pb-6 text-base leading-relaxed">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
