import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: 'ADHARA · Administración', template: '%s · Panel ADHARA' },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
