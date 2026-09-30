import { Cormorant_Garamond, Manrope } from 'next/font/google';

/** Serif de display: titulares y nombres de perfume. */
export const display = Cormorant_Garamond({
  subsets: ['latin', 'latin-ext'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});

/** Sans de lectura e interfaz. */
export const sans = Manrope({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-manrope',
  display: 'swap',
});

export const fontVariables = `${display.variable} ${sans.variable}`;
