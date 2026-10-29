import { pathToFileURL } from 'node:url';

// Proyecto que contiene los datos reales, aunque conserve el nombre atelier-dev.
// Cambiar esta referencia exige un corte de entorno documentado en OPERATIONS.
export const PRODUCTION_SUPABASE_REF = 'xgpsislololgbakzcmad';

type Environment = Record<string, string | undefined>;

/**
 * IDs públicos de analítica y publicidad (DECISIONS §178). Repite los
 * formatos de src/modules/tracking/domain/config.ts, porque este script se
 * ejecuta con Node sin el resto de la app; una prueba unitaria comprueba que
 * coinciden. Un ID mal escrito se ignoraría en silencio: en Production para
 * el build.
 */
export const TRACKING_ID_FORMATS: Record<string, RegExp> = {
  NEXT_PUBLIC_GA_MEASUREMENT_ID: /^G-[A-Z0-9]{4,20}$/,
  NEXT_PUBLIC_GOOGLE_ADS_ID: /^AW-\d{6,15}$/,
  NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL: /^[A-Za-z0-9_-]{4,64}$/,
  NEXT_PUBLIC_META_PIXEL_ID: /^\d{10,20}$/,
  NEXT_PUBLIC_TIKTOK_PIXEL_ID: /^[A-Z0-9]{15,30}$/,
};

/** Solo devuelve nombres y problemas de configuración, nunca valores de claves. */
export function deploymentEnvironmentIssues(env: Environment): string[] {
  if (env.VERCEL_ENV !== 'preview' && env.VERCEL_ENV !== 'production')
    return [];

  const issues: string[] = [];
  const rawUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  let ref: string | null = null;
  if (rawUrl) {
    try {
      const url = new URL(rawUrl);
      const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(url.hostname);
      if (
        url.protocol !== 'https:' ||
        !match ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        issues.push(
          'NEXT_PUBLIC_SUPABASE_URL debe ser la URL HTTPS del proyecto Supabase.',
        );
      else ref = match[1] ?? null;
    } catch {
      issues.push('NEXT_PUBLIC_SUPABASE_URL no es válida.');
    }
  }

  if (env.VERCEL_ENV === 'production') {
    if (!rawUrl || !key)
      issues.push(
        'Production requiere las dos variables públicas de Supabase.',
      );
    if (ref && ref !== PRODUCTION_SUPABASE_REF)
      issues.push(
        'Production no apunta al proyecto real registrado. Revisar el corte de entorno.',
      );
    if (env.REDSYS_ENVIRONMENT && env.REDSYS_ENVIRONMENT !== 'live')
      issues.push('Production solo admite REDSYS_ENVIRONMENT=live.');
    for (const [name, format] of Object.entries(TRACKING_ID_FORMATS)) {
      const value = env[name]?.trim();
      if (value && !format.test(value))
        issues.push(`${name} no tiene el formato esperado.`);
    }
    if (
      env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL &&
      !env.NEXT_PUBLIC_GOOGLE_ADS_ID
    )
      issues.push(
        'NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL necesita NEXT_PUBLIC_GOOGLE_ADS_ID.',
      );
    return issues;
  }

  if (Boolean(rawUrl) !== Boolean(key))
    issues.push(
      'Preview requiere las dos variables públicas de Supabase o ninguna.',
    );
  if (ref === PRODUCTION_SUPABASE_REF)
    issues.push('Preview no puede conectarse a la base real de la tienda.');
  if (
    ref &&
    (!env.ATELIER_PREVIEW_SUPABASE_REF ||
      ref !== env.ATELIER_PREVIEW_SUPABASE_REF)
  )
    issues.push(
      'Preview debe coincidir con ATELIER_PREVIEW_SUPABASE_REF del entorno aislado.',
    );
  if (env.ATELIER_PREVIEW_SUPABASE_REF === PRODUCTION_SUPABASE_REF)
    issues.push('ATELIER_PREVIEW_SUPABASE_REF no puede ser el proyecto real.');
  if (!ref && env.SUPABASE_SECRET_KEY)
    issues.push(
      'Preview no puede tener SUPABASE_SECRET_KEY sin una base aislada válida.',
    );
  if (env.REDSYS_ENVIRONMENT && env.REDSYS_ENVIRONMENT !== 'test')
    issues.push('Preview solo admite REDSYS_ENVIRONMENT=test.');
  if (env.REDSYS_SECRET_KEY && env.REDSYS_ENVIRONMENT !== 'test')
    issues.push('La clave de Redsys en Preview requiere el entorno test.');
  // Hasta disponer de un proveedor de pruebas con destinatarios restringidos.
  for (const name of [
    'RESEND_API_KEY',
    'SENDER_API_TOKEN',
    'CRON_SECRET',
    'SUPABASE_BACKUPS_TOKEN',
  ]) {
    if (env[name])
      issues.push(
        `${name} no se admite en Preview: evitar envíos y tareas reales.`,
      );
  }
  return issues;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const issues = deploymentEnvironmentIssues(process.env);
  if (issues.length) {
    for (const issue of issues) console.error(`[entornos] ${issue}`);
    process.exitCode = 1;
  } else console.log('[entornos] Configuración compatible con el destino.');
}
