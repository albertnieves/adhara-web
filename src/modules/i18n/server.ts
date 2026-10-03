import 'server-only';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from './routing';
import type { Locale } from './seo';

/**
 * Idioma de una ruta de la tienda: 404 si no es es, ca o en, y si lo es, lo
 * fija para next-intl. El layout y la página se renderizan a la vez, así que
 * cada uno lo comprueba antes de leer datos: si no, una ruta como /xx
 * consulta la base con un idioma inexistente y deja un error en el log.
 */
export function requireLocale(locale: string): Locale {
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
