import { getTranslations, setRequestLocale } from 'next-intl/server';
export default async function Catalog({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('setup');
  return (
    <main>
      <h1>{t('catalog')}</h1>
      <p>{t('empty')}</p>
    </main>
  );
}
