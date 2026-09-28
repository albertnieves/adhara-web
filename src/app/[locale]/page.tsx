import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/modules/i18n';
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('setup');
  return (
    <main>
      <h1>ADHARA</h1>
      <p>{t('status')}</p>
      <Link href="/catalogo">{t('catalog')}</Link>
    </main>
  );
}
