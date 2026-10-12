'use client';

import { useEffect, useRef } from 'react';

/** Interés que mide la tienda (add_to_cart, con la cesta de P03). */
export type TrackedKind = 'view' | 'scent_view' | 'unboxing' | 'add_to_cart';

/** Global Privacy Control o «Do Not Track» activados: no se envía nada. */
function optedOut() {
  return (
    ('globalPrivacyControl' in navigator &&
      navigator.globalPrivacyControl === true) ||
    navigator.doNotTrack === '1'
  );
}

/**
 * Medición anónima y agregada (POST /api/eventos): solo suma un contador por
 * perfume publicado, día y tipo. Sin cookies ni almacenamiento en el
 * navegador. Para eventos imperativos (la escena 3D); nunca lanza errores.
 */
export function trackProductEvent(slug: string, kind: TrackedKind) {
  if (typeof navigator === 'undefined' || optedOut()) return;
  const body = JSON.stringify({ slug, kind });
  try {
    if (
      navigator.sendBeacon(
        '/api/eventos',
        new Blob([body], { type: 'application/json' }),
      )
    )
      return;
  } catch {
    // Sin sendBeacon o rechazado por el navegador: se envía con fetch.
  }
  fetch('/api/eventos', {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
  }).catch(() => undefined);
}

/**
 * Cuenta una visita al montar la ficha, una sola vez por perfume y tipo. No
 * pinta nada; la página no lo incluye en la vista previa del personal.
 */
export function TrackEvent({
  slug,
  kind,
}: {
  slug: string;
  kind: TrackedKind;
}) {
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const key = `${kind}:${slug}`;
    if (sent.current === key) return;
    sent.current = key;
    trackProductEvent(slug, kind);
  }, [slug, kind]);
  return null;
}
