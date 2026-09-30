import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { BRAND_NAME } from '@/modules/brand';
import { fontVariables } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: `${BRAND_NAME} · Administración`,
    template: `%s · Panel ${BRAND_NAME}`,
  },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
