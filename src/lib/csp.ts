/**
 * Content Security Policy de todas las respuestas (DECISIONS §162 y §187).
 *
 * Las páginas de la tienda se generan estáticas (ISR), así que no hay nonce
 * por visita y los scripts en línea de Next necesitan 'unsafe-inline'. Aun
 * así, la política cierra lo que más usa un ataque XSS: cargar un script de
 * otro dominio, ejecutar texto con eval, enviar un formulario a otra web,
 * meter la página en un marco, plugins y <base> ajena.
 *
 * Orígenes de scripts: los de las etiquetas de medición que la tienda sabe
 * cargar tras el consentimiento (§179), según las guías de CSP de cada
 * proveedor, y la barra de Vercel de las Preview.
 */
export const SCRIPT_HOSTS = [
  // Google Analytics 4 y gtag.js.
  'https://*.googletagmanager.com',
  // Google Ads: conversión y remarketing.
  'https://www.googleadservices.com',
  'https://googleads.g.doubleclick.net',
  'https://www.google.com',
  'https://pagead2.googlesyndication.com',
  // Píxel de Meta.
  'https://connect.facebook.net',
  // Píxel de TikTok.
  'https://analytics.tiktok.com',
  // Barra de comentarios de Vercel (solo en las Preview).
  'https://vercel.live',
] as const;

/** Páginas de pago del banco: el formulario firmado se envía ahí (P04). */
export const FORM_HOSTS = [
  'https://sis.redsys.es',
  'https://sis-t.redsys.es:25443',
  // Entrar con Google: sin JavaScript, el formulario sigue las redirecciones
  // a Supabase Auth y a Google, y form-action también las comprueba.
  'https://accounts.google.com',
] as const;

/** Origen (esquema, host y puerto) de una URL, o null si no es válida. */
function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

export function contentSecurityPolicy({
  dev = false,
  supabaseUrl,
}: {
  dev?: boolean;
  supabaseUrl?: string;
} = {}): string {
  const supabase = originOf(supabaseUrl);
  const directives: [string, ...string[]][] = [
    [
      'script-src',
      "'self'",
      "'unsafe-inline'",
      // Solo en desarrollo: la recarga en caliente de Next evalúa código.
      ...(dev ? ["'unsafe-eval'"] : []),
      ...SCRIPT_HOSTS,
    ],
    ['worker-src', "'self'", 'blob:'],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'", ...FORM_HOSTS, ...(supabase ? [supabase] : [])],
    ['frame-ancestors', "'none'"],
  ];
  return directives.map((parts) => parts.join(' ')).join('; ');
}
