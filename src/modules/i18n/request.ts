import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';
const loaders = {
  es: () => import('../../../messages/es.json'),
  ca: () => import('../../../messages/ca.json'),
  en: () => import('../../../messages/en.json'),
};
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;
  return { locale, messages: (await loaders[locale]()).default };
});
