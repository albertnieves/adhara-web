import 'server-only';
import type { TrackingConfig } from './domain/config';
import { trackingConfig } from './domain/config';

/**
 * Proveedores configurados en este despliegue (Vercel → Environment
 * Variables). Se lee al generar las páginas: cambiar un ID exige redesplegar.
 */
export function serverTrackingConfig(): TrackingConfig {
  return trackingConfig(process.env);
}
