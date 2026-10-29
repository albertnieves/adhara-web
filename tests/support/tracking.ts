import type { BrowserContext } from '@playwright/test';
import {
  activeVendors,
  trackingConfig,
} from '../../src/modules/tracking/domain/config';

/**
 * La compilación de las pruebas tiene IDs de analítica y publicidad (e2e.yml,
 * DECISIONS §178). Sin ellos, el aviso es el de solo cookies técnicas.
 */
export const TRACKING_ON =
  activeVendors(trackingConfig(process.env)).length > 0;

const TRACKERS =
  /^https:\/\/(www\.googletagmanager\.com|connect\.facebook\.net|analytics\.tiktok\.com)\//;

/**
 * Sirve vacías las etiquetas de Google, Meta y TikTok: ninguna petición sale
 * a esas empresas y las llamadas se quedan en sus colas (dataLayer, fbq.queue
 * y ttq), donde las pruebas las leen. Devuelve los hosts pedidos, en orden.
 */
export async function stubTrackers(context: BrowserContext) {
  const hosts: string[] = [];
  await context.route(TRACKERS, async (route) => {
    hosts.push(new URL(route.request().url()).host);
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript',
      body: '',
    });
  });
  return hosts;
}

/** Llamadas guardadas en las colas de los tres proveedores. */
export type TrackerQueues = {
  gtag: unknown[][];
  fbq: unknown[][];
  ttq: unknown[][];
};

export const readQueues = () => {
  const w = window as unknown as {
    dataLayer?: ArrayLike<unknown>[];
    fbq?: { queue?: ArrayLike<unknown>[] };
    ttq?: ArrayLike<unknown>[];
  };
  return {
    gtag: (w.dataLayer ?? []).map((entry) => Array.from(entry)),
    fbq: (w.fbq?.queue ?? []).map((entry) => Array.from(entry)),
    ttq: Array.from(w.ttq ?? []).map((entry) =>
      Array.from(entry as ArrayLike<unknown>),
    ),
  } satisfies TrackerQueues;
};
