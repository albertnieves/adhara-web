'use client';

import type { ReactNode } from 'react';
import { openCookieSettings } from './runtime';

/**
 * «Configurar cookies»: abre las preferencias para cambiar o retirar el
 * consentimiento tan fácil como se dio. Solo se pinta si hay cookies
 * opcionales configuradas (lo decide quien lo usa).
 */
export function CookieSettingsButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className={className}
      data-cookie-settings=""
    >
      {children}
    </button>
  );
}
