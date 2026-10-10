import { getTranslations } from 'next-intl/server';
import { Eyebrow, Heading } from '@/components/ui';
import { Star } from '@/modules/brand';
import { storeContent, STORE_DEFAULTS } from '@/modules/content';
import { readStoreContent } from '@/modules/content/server';
import { Link } from '@/modules/i18n';
import { LEGAL_CONTACT_EMAIL } from '@/modules/legal';
import { NewsletterSignup } from './NewsletterSignup';

/** Sección de suscripción a las promociones, justo antes del pie. */
export async function NewsletterSection() {
  const [t, data] = await Promise.all([
    getTranslations('newsletter'),
    readStoreContent('store', 'es'),
  ]);
  const store = data ? storeContent.parse(data.payload) : STORE_DEFAULTS;
  const email = store.email || LEGAL_CONTACT_EMAIL;
  return (
    <section
      aria-labelledby="newsletter-title"
      className="bg-surface-sunken grain relative overflow-hidden"
    >
      <div className="relative mx-auto grid max-w-[90rem] gap-12 px-5 py-24 sm:px-10 sm:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-20">
        <div>
          <Star className="text-accent size-4" />
          <Eyebrow tone="accent" className="mt-6">
            {t('eyebrow')}
          </Eyebrow>
          <Heading id="newsletter-title" level={2} size="h2" className="mt-4">
            {t('title')}
          </Heading>
          <p className="text-fg-muted mt-6 max-w-md text-lg leading-relaxed">
            {t('lead')}
          </p>
        </div>
        <div>
          <NewsletterSignup />
          <p className="text-fg-muted mt-6 max-w-xl text-xs leading-relaxed">
            {t('privacy')}{' '}
            {t.rich('privacyContact', {
              email,
              mail: (chunks) => (
                <a href={`mailto:${email}`} className="link-underline">
                  {chunks}
                </a>
              ),
            })}{' '}
            {t.rich('privacyMore', {
              link: (chunks) => (
                <Link href="/privacidad" className="link-underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>
        </div>
      </div>
    </section>
  );
}
