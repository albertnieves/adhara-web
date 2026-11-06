// Utilidades comunes de las etapas: rutas del proyecto, slug y carpeta de salida.
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carpeta `video/`, con independencia de desde dónde se lance el script. */
export const VIDEO_ROOT = fileURLToPath(new URL('../../', import.meta.url));

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug);
}

/** Lee el slug de `--slug <slug>` o de la variable SLUG. */
export function readSlug(
  argv: readonly string[],
  required: boolean,
): string | null {
  const flag = argv.indexOf('--slug');
  const value = flag >= 0 ? argv[flag + 1] : process.env.SLUG;
  if (!value) {
    if (required) fail('Falta el slug: usa --slug <slug> o SLUG=<slug>.');
    return null;
  }
  if (!isValidSlug(value))
    fail(`Slug no válido: «${value}» (minúsculas, cifras y guiones).`);
  return value;
}

/** `build/<slug>/<etapa>/`, creada si no existe. */
export function stageDir(slug: string, stage: string): string {
  const dir = join(VIDEO_ROOT, 'build', slug, stage);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
}

/**
 * Escribe solo si el contenido cambia: una etapa repetida deja los archivos
 * como estaban (idempotencia) y devuelve si hubo cambios.
 */
export function writeIfChanged(path: string, content: string): boolean {
  if (existsSync(path) && readFileSync(path, 'utf8') === content) return false;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return true;
}

export function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}
