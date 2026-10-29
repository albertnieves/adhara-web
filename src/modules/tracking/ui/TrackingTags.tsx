'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { TrackingConfig } from '../domain/config';
import type { CommerceEvent } from '../domain/events';
import type { ConsentSnapshot } from './runtime';
import {
  getConsentSnapshot,
  getServerConsentSnapshot,
  getServerSettingsSnapshot,
  getSettingsSnapshot,
  setupTracking,
  subscribeConsent,
  subscribeSettings,
  track,
  trackPageView,
} from './runtime';

/** La elección guardada; `known: false` en el servidor y al hidratar. */
export function useConsent(): ConsentSnapshot {
  return useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot,
  );
}

/** Si alguien ha pedido abrir «Configurar cookies». */
export function useCookieSettingsRequested(): boolean {
  return useSyncExternalStore(
    subscribeSettings,
    getSettingsSnapshot,
    getServerSettingsSnapshot,
  );
}

/**
 * Carga las etiquetas aceptadas (una vez por página) y avisa de los cambios
 * de página sin recarga. No pinta nada. Va en el layout de la tienda, nunca
 * en el panel; `suppressed` en la vista previa del personal.
 */
export function TrackingTags({
  config,
  suppressed,
}: {
  config: TrackingConfig;
  suppressed: boolean;
}) {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);
  const key = JSON.stringify(config);

  useEffect(() => {
    setupTracking(JSON.parse(key) as TrackingConfig, { suppressed });
  }, [key, suppressed]);

  useEffect(() => {
    if (previous.current !== null && previous.current !== pathname)
      trackPageView();
    previous.current = pathname;
  }, [pathname]);

  return null;
}

/** Envía un evento de comercio al montar (y si cambia). No pinta nada. */
export function TrackCommerce({ event }: { event: CommerceEvent }) {
  const key = JSON.stringify(event);
  useEffect(() => {
    track(JSON.parse(key) as CommerceEvent);
  }, [key]);
  return null;
}
