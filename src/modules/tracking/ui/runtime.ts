import type { TrackingConfig } from '../domain/config';
import { activeVendors, NO_TRACKING } from '../domain/config';
import type { ConsentChoice, StoredConsent } from '../domain/consent';
import {
  consentFromCookieHeader,
  consentNeeded,
  grantedVendors,
  serializeConsent,
  TRACKING_CONSENT_COOKIE,
  TRACKING_CONSENT_MAX_AGE,
} from '../domain/consent';
import type { CommerceEvent } from '../domain/events';
import { vendorCalls } from '../domain/events';
import type { TrackingVendor } from '../domain/vendors';
import {
  GA_COOKIE_EXPIRES_SECONDS,
  VENDOR_CATEGORY,
  VENDOR_COOKIES,
} from '../domain/vendors';

/*
 * Lo que pasa en el navegador (DECISIONS §179): la elección del visitante,
 * la carga de las etiquetas que ha aceptado y los eventos. Nada de terceros
 * se carga ni se llama antes de aceptar: es el modo «básico» del Consent
 * Mode de Google, el que pide la AEPD.
 */

type Gtag = (...args: unknown[]) => void;
type Fbq = (...args: unknown[]) => void;
type Ttq = { track: (...args: unknown[]) => void; page: () => void };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
    ttq?: Ttq;
  }
}

// ---------------------------------------------------------------- elección

/** Estado de la cookie de elección; `known: false` en el servidor y al hidratar. */
export type ConsentSnapshot =
  { known: false } | { known: true; stored: StoredConsent | null };

const UNKNOWN: ConsentSnapshot = { known: false };
let lastRaw: string | undefined;
let lastSnapshot: ConsentSnapshot = UNKNOWN;
const consentListeners = new Set<() => void>();

function rawConsentCookie(): string {
  const prefix = `${TRACKING_CONSENT_COOKIE}=`;
  return (
    document.cookie
      .split(/;\s*/)
      .find((part) => part.startsWith(prefix))
      ?.slice(prefix.length) ?? ''
  );
}

export function getConsentSnapshot(): ConsentSnapshot {
  const raw = rawConsentCookie();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastSnapshot = {
      known: true,
      stored: consentFromCookieHeader(`${TRACKING_CONSENT_COOKIE}=${raw}`),
    };
  }
  return lastSnapshot;
}

export const getServerConsentSnapshot = () => UNKNOWN;

export function subscribeConsent(listener: () => void) {
  consentListeners.add(listener);
  return () => {
    consentListeners.delete(listener);
  };
}

/**
 * Guarda la elección (un año) y la aplica en la página. Si retira un permiso
 * que había dado, borra las cookies de esos proveedores y recarga la página
 * para descargar sus etiquetas.
 */
export function saveConsent(
  choice: ConsentChoice,
  vendors: readonly TrackingVendor[],
) {
  const before = getConsentSnapshot();
  const previous = before.known ? before.stored : null;
  const value = serializeConsent(choice, vendors, Date.now() / 1000);
  document.cookie = `${TRACKING_CONSENT_COOKIE}=${encodeURIComponent(value)}; Max-Age=${TRACKING_CONSENT_MAX_AGE}; Path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
  for (const listener of consentListeners) listener();

  const revoked = previous
    ? grantedVendors(previous, previous.vendors).filter(
        (vendor) => !choice[VENDOR_CATEGORY[vendor]],
      )
    : [];
  if (!choice.analytics && !choice.ads) {
    try {
      localStorage.removeItem(MEASURED_KEY);
    } catch {
      // Sin almacenamiento: nada que borrar.
    }
  }
  if (revoked.length > 0) {
    clearVendorCookies(revoked);
    if (revoked.some((vendor) => loaded.has(vendor))) {
      location.reload();
      return;
    }
  }
  applyConsent();
}

/** Borra las cookies de esos proveedores en el dominio de la tienda y sus superiores. */
export function clearVendorCookies(vendors: readonly TrackingVendor[]) {
  const doomed = document.cookie
    .split(/;\s*/)
    .map((part) => part.split('=')[0] ?? '')
    .filter((name) =>
      vendors.some(
        (vendor) =>
          VENDOR_COOKIES[vendor].names.includes(name) ||
          VENDOR_COOKIES[vendor].prefixes.some((prefix) =>
            name.startsWith(prefix),
          ),
      ),
    );
  const labels = location.hostname.split('.');
  const domains: (string | null)[] = [null];
  // El propio host (también `localhost`) y sus superiores, sin el dominio de primer nivel.
  for (let i = 0; i < Math.max(1, labels.length - 1); i += 1) {
    const domain = labels.slice(i).join('.');
    domains.push(domain, `.${domain}`);
  }
  for (const name of doomed) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ''}`;
    }
  }
}

// --------------------------------------------------- petición de «Configurar»

let settingsOpen = false;
const settingsListeners = new Set<() => void>();

/** Abre las preferencias de cookies (pie y política de cookies). */
export function openCookieSettings() {
  settingsOpen = true;
  for (const listener of settingsListeners) listener();
}

export function closeCookieSettings() {
  settingsOpen = false;
  for (const listener of settingsListeners) listener();
}

export const getSettingsSnapshot = () => settingsOpen;
export const getServerSettingsSnapshot = () => false;

export function subscribeSettings(listener: () => void) {
  settingsListeners.add(listener);
  return () => {
    settingsListeners.delete(listener);
  };
}

// ------------------------------------------------------------- etiquetas

let config: TrackingConfig = NO_TRACKING;
/** waiting: aún no ha elegido (los eventos esperan); off: nada se envía. */
let state: 'waiting' | 'off' | 'on' = 'waiting';
const granted = new Set<TrackingVendor>();
const loaded = new Set<TrackingVendor>();
const queue: CommerceEvent[] = [];
const MAX_QUEUE = 30;

/**
 * La llama una vez por página la etiqueta del layout. `suppressed`: vista
 * previa del personal, que nunca se mide.
 */
export function setupTracking(
  next: TrackingConfig,
  { suppressed }: { suppressed: boolean },
) {
  config = next;
  if (suppressed || activeVendors(next).length === 0) {
    state = 'off';
    queue.length = 0;
    return;
  }
  applyConsent();
}

function applyConsent() {
  const snapshot = getConsentSnapshot();
  if (!snapshot.known) return;
  const configured = activeVendors(config);
  if (configured.length === 0) return;
  const allowed = grantedVendors(snapshot.stored, configured);
  if (allowed.length === 0) {
    // Sin elección: los eventos esperan a que elija. Rechazado: se tiran.
    state = consentNeeded(snapshot.stored, configured) ? 'waiting' : 'off';
    if (state === 'off') queue.length = 0;
    return;
  }
  for (const vendor of allowed) granted.add(vendor);
  loadGoogle();
  if (granted.has('meta') && config.meta) loadMeta(config.meta);
  if (granted.has('tiktok') && config.tiktok) loadTikTok(config.tiktok);
  state = 'on';
  for (const event of queue.splice(0)) dispatch(event);
}

function injectScript(src: string) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function injectInline(code: string) {
  const script = document.createElement('script');
  script.textContent = code;
  document.head.appendChild(script);
}

function loadGoogle() {
  const ga = granted.has('ga4') ? config.ga4 : null;
  const ads = granted.has('googleAds') ? (config.googleAds?.id ?? null) : null;
  if (!ga && !ads) return;
  if (!window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag.js necesita el objeto `arguments`, no un array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
    window.gtag('consent', 'default', {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'denied',
    });
    window.gtag('js', new Date());
    injectScript(
      `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga ?? ads ?? '')}`,
    );
  }
  window.gtag('consent', 'update', {
    analytics_storage: ga ? 'granted' : 'denied',
    ad_storage: ads ? 'granted' : 'denied',
    ad_user_data: ads ? 'granted' : 'denied',
    ad_personalization: ads ? 'granted' : 'denied',
  });
  if (ga && !loaded.has('ga4')) {
    loaded.add('ga4');
    window.gtag('config', ga, { cookie_expires: GA_COOKIE_EXPIRES_SECONDS });
  }
  if (ads && !loaded.has('googleAds')) {
    loaded.add('googleAds');
    window.gtag('config', ads);
  }
}

/**
 * Código oficial del píxel de Meta. `autoConfig` apagado: el píxel no envía
 * por su cuenta clics ni datos de la página, solo los eventos de aquí.
 */
function loadMeta(id: string) {
  if (loaded.has('meta')) return;
  loaded.add('meta');
  injectInline(
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');` +
      `fbq('set','autoConfig',false,'${id}');fbq('init','${id}');fbq('track','PageView');`,
  );
}

/** Código oficial del píxel de TikTok. */
function loadTikTok(id: string) {
  if (loaded.has('tiktok')) return;
  loaded.add('tiktok');
  injectInline(
    `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=d.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=d.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};` +
      `ttq.load('${id}');ttq.page();}(window,document,'ttq');`,
  );
}

// ---------------------------------------------------------------- eventos

/** Pedidos ya medidos en este navegador: una compra cuenta una sola vez. */
const MEASURED_KEY = 'atelier_medicion';
const MEASURED_DAYS = 30;

function alreadyMeasured(orderNumber: number): boolean {
  try {
    const list = JSON.parse(localStorage.getItem(MEASURED_KEY) ?? '[]');
    return (
      Array.isArray(list) &&
      list.some(
        (entry: unknown) => Array.isArray(entry) && entry[0] === orderNumber,
      )
    );
  } catch {
    return false;
  }
}

function markMeasured(orderNumber: number) {
  try {
    const now = Date.now();
    const parsed: unknown = JSON.parse(
      localStorage.getItem(MEASURED_KEY) ?? '[]',
    );
    const recent = (Array.isArray(parsed) ? parsed : []).filter(
      (entry: unknown): entry is [number, number] =>
        Array.isArray(entry) &&
        typeof entry[0] === 'number' &&
        typeof entry[1] === 'number' &&
        now - entry[1] < MEASURED_DAYS * 86_400_000,
    );
    recent.push([orderNumber, now]);
    localStorage.setItem(MEASURED_KEY, JSON.stringify(recent.slice(-20)));
  } catch {
    // Sin almacenamiento (modo privado): se mide igual.
  }
}

function dispatch(event: CommerceEvent) {
  if (event.type === 'purchase') {
    if (alreadyMeasured(event.orderNumber)) return;
    markMeasured(event.orderNumber);
  }
  for (const call of vendorCalls(event, config, granted)) {
    try {
      if (call.target === 'gtag') window.gtag?.(...call.args);
      else if (call.target === 'fbq') window.fbq?.(...call.args);
      else window.ttq?.track(...call.args);
    } catch {
      // Un proveedor que falla no rompe la tienda.
    }
  }
}

/** Envía un evento a los proveedores aceptados; si aún no ha elegido, espera. */
export function track(event: CommerceEvent) {
  if (typeof window === 'undefined' || state === 'off') return;
  if (state === 'waiting') {
    if (queue.length < MAX_QUEUE) queue.push(event);
    return;
  }
  dispatch(event);
}

/**
 * Cambio de página sin recarga. Google Analytics lo mide solo (medición
 * mejorada, «cambios de página según el historial»); Ads, Meta y TikTok no.
 */
export function trackPageView() {
  if (state !== 'on') return;
  try {
    if (loaded.has('googleAds') && config.googleAds)
      window.gtag?.('event', 'page_view', { send_to: config.googleAds.id });
    if (loaded.has('meta')) window.fbq?.('track', 'PageView');
    if (loaded.has('tiktok')) window.ttq?.page();
  } catch {
    // Igual que en dispatch.
  }
}
