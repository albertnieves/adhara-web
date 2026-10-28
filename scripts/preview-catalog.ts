/**
 * Copia únicamente el catálogo público. Nunca escribe en el origen.
 * Uso y requisitos: docs/TEST_ENVIRONMENT.md.
 */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { PRODUCTION_SUPABASE_REF } from './check-deployment-environment.ts';

class PreviewCatalogError extends Error {}

const uuid = z.uuid();
const text = z.string().max(100_000);
const nullableText = text.nullable();
const integer = z.number().int();
const money = integer.nonnegative().nullable();
const slugs = z.array(z.string().max(100)).max(20);
const schemas = {
  brands: z.strictObject({ id: uuid, slug: text, name: text }),
  products: z.strictObject({
    id: uuid,
    brand_id: uuid,
    slug: text,
    name: text,
    concentration: nullableText,
    audience: nullableText,
    status: z.literal('published'),
    featured: z.boolean(),
    position: integer,
    unboxing_scene: nullableText,
  }),
  product_variants: z.strictObject({
    id: uuid,
    product_id: uuid,
    sku: nullableText,
    ean: nullableText,
    size_ml: integer.positive().nullable(),
    label: nullableText,
    retail_price_cents: money,
    compare_at_price_cents: money,
    active: z.literal(true),
    position: integer,
    shipping_weight_g: integer.positive().nullable(),
  }),
  product_translations: z.strictObject({
    product_id: uuid,
    locale: z.enum(['es', 'ca', 'en']),
    tagline: nullableText,
    description: nullableText,
  }),
  product_media: z.strictObject({
    id: uuid,
    product_id: uuid,
    url: text,
    alt: nullableText,
    role: z.enum(['hero', 'gallery', 'box']),
    origin: z.enum([
      'own_photo',
      'catalog_pdf',
      'brand_official',
      'generated_draft',
    ]),
    source: nullableText,
    provisional: z.boolean(),
    position: integer,
  }),
  product_scent_profiles: z.strictObject({
    product_id: uuid,
    top_notes: slugs,
    heart_notes: slugs,
    base_notes: slugs,
    key_notes: slugs,
    families: slugs,
    seasons: slugs,
    times_of_day: slugs,
    source_url: text,
    source_note: nullableText,
  }),
};
export const catalogTables = Object.keys(schemas) as (keyof typeof schemas)[];
const mimeTypes = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
] as const;
const assetSchema = z.strictObject({
  mediaId: uuid,
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  contentType: z.enum(mimeTypes),
});
const snapshotSchema = z.strictObject({
  format: z.literal('atelier-public-catalog-v1'),
  sourceRef: z.literal(PRODUCTION_SUPABASE_REF),
  exportedAt: z.iso.datetime(),
  tables: z.strictObject({
    brands: z.array(schemas.brands),
    products: z.array(schemas.products).min(1),
    product_variants: z.array(schemas.product_variants),
    product_translations: z.array(schemas.product_translations),
    product_media: z.array(schemas.product_media),
    product_scent_profiles: z.array(schemas.product_scent_profiles),
  }),
  assets: z.array(assetSchema),
});
export type CatalogSnapshot = z.infer<typeof snapshotSchema>;
const sourceOrigin = 'https://' + PRODUCTION_SUPABASE_REF + '.supabase.co';
const publicMediaPath = '/storage/v1/object/public/product-media/';
const hash = (bytes: Uint8Array) =>
  createHash('sha256').update(bytes).digest('hex');

export function previewRef(value: string | undefined): string {
  if (
    !value ||
    !/^[a-z0-9]{20}$/.test(value) ||
    value === PRODUCTION_SUPABASE_REF
  )
    throw new PreviewCatalogError(
      'Se necesita una referencia de pruebas distinta de producción.',
    );
  return value;
}

/** Solo clave publicable o JWT anon del origen; nunca una clave privilegiada. */
export function assertPublicSourceKey(
  key: string | undefined,
): asserts key is string {
  if (key?.startsWith('sb_publishable_')) return;
  try {
    const payload = JSON.parse(
      Buffer.from(key?.split('.')[1] ?? '', 'base64url').toString(),
    );
    if (payload.role === 'anon' && payload.ref === PRODUCTION_SUPABASE_REF)
      return;
  } catch {
    /* Error deliberadamente sin datos de credenciales. */
  }
  throw new PreviewCatalogError(
    'SOURCE_SUPABASE_PUBLISHABLE_KEY debe ser la clave pública del origen.',
  );
}

export function isLocalMedia(url: string): boolean {
  return (
    /^\/media\/[a-zA-Z0-9_./-]+$/.test(url) &&
    !url.split('/').some((part) => part === '.' || part === '..')
  );
}

export function assertSourceMedia(value: string): void {
  const url = new URL(value);
  if (
    url.origin !== sourceOrigin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !url.pathname.startsWith(publicMediaPath) ||
    decodeURIComponent(url.pathname)
      .split('/')
      .some((part) => part === '..')
  )
    throw new PreviewCatalogError('Imagen fuera del bucket público de origen.');
}

export function parseSnapshot(value: unknown): CatalogSnapshot {
  const snapshot = snapshotSchema.parse(value);
  const tables = snapshot.tables;
  for (const table of catalogTables) {
    const keys = tables[table].map((row) => {
      if ('id' in row) return row.id;
      return row.product_id + ('locale' in row ? ':' + row.locale : '');
    });
    if (new Set(keys).size !== keys.length)
      throw new PreviewCatalogError('Filas duplicadas: ' + table);
  }
  const products = new Set(tables.products.map((row) => row.id));
  const brands = new Set(tables.brands.map((row) => row.id));
  for (const product of tables.products) {
    if (
      !brands.has(product.brand_id) ||
      !tables.product_variants.some(
        (v) => v.product_id === product.id && v.retail_price_cents !== null,
      )
    )
      throw new PreviewCatalogError(
        'Catálogo incompleto; repetir exportación sin cambios simultáneos.',
      );
  }
  for (const table of catalogTables.filter(
    (t) => t !== 'brands' && t !== 'products',
  ))
    for (const row of tables[table])
      if (!('product_id' in row) || !products.has(row.product_id))
        throw new PreviewCatalogError('Referencia a un producto no exportado.');
  const assets = new Map(
    snapshot.assets.map((asset) => [asset.mediaId, asset]),
  );
  if (assets.size !== snapshot.assets.length)
    throw new PreviewCatalogError('Imágenes duplicadas.');
  for (const media of tables.product_media) {
    if (isLocalMedia(media.url)) {
      if (assets.has(media.id))
        throw new PreviewCatalogError(
          'Imagen local con copia remota inesperada.',
        );
    } else {
      assertSourceMedia(media.url);
      if (!assets.has(media.id))
        throw new PreviewCatalogError('Falta la copia de una imagen.');
    }
  }
  for (const id of assets.keys())
    if (!tables.product_media.some((media) => media.id === id))
      throw new PreviewCatalogError('Imagen sin fila de catálogo.');
  return snapshot;
}

/** Conexión directa exclusivamente al proyecto de pruebas declarado. */
export function databaseEnvironment(raw: string | undefined, ref: string) {
  previewRef(ref);
  let url: URL;
  try {
    url = new URL(raw ?? '');
  } catch {
    throw new PreviewCatalogError('Falta PREVIEW_DATABASE_URL válida.');
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== 'db.' + ref + '.supabase.co' ||
    (url.port && url.port !== '5432') ||
    url.pathname !== '/postgres' ||
    url.username !== 'postgres' ||
    !url.password ||
    url.search ||
    url.hash
  )
    throw new PreviewCatalogError(
      'Solo conexión directa postgres al proyecto de pruebas; sin parámetros.',
    );
  return {
    PGHOST: url.hostname,
    PGPORT: '5432',
    PGDATABASE: 'postgres',
    PGUSER: 'postgres',
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: 'verify-full',
    PGCONNECT_TIMEOUT: '15',
    PGAPPNAME: 'atelier-preview-catalog',
  };
}

function dollar(value: unknown) {
  const data = typeof value === 'string' ? value : JSON.stringify(value);
  let tag = 'catalog';
  while (data.includes('$' + tag + '$')) tag += '_x';
  return '$' + tag + '$' + data + '$' + tag + '$';
}

export function catalogSql(input: unknown, ref: string, apply = false): string {
  previewRef(ref);
  const snapshot = parseSnapshot(input);
  const assets = new Map(
    snapshot.assets.map((asset) => [asset.mediaId, asset]),
  );
  const statements = [
    '\\set ON_ERROR_STOP on',
    'begin;',
    "set local lock_timeout = '5s';",
    "set local statement_timeout = '60s';",
    'lock table ' +
      catalogTables.map((table) => 'public.' + table).join(', ') +
      ' in exclusive mode;',
    "do $$ begin if exists(select 1 from public.products) or exists(select 1 from public.brands) or exists(select 1 from public.orders) or exists(select 1 from auth.users) then raise exception 'El destino debe estar vacío, sin catálogo, pedidos ni cuentas'; end if; end $$;",
  ];
  for (const table of catalogTables) {
    const rows = snapshot.tables[table].map((row) => {
      if (table === 'products') return { ...row, status: 'draft' };
      // No trasladar ni inventar historial Ómnibus; se conserva el PVP actual.
      if (table === 'product_variants')
        return { ...row, compare_at_price_cents: null };
      if (table === 'product_media' && 'id' in row) {
        const asset = assets.get(row.id);
        if (asset)
          return {
            ...row,
            url:
              'https://' +
              ref +
              '.supabase.co' +
              publicMediaPath +
              'preview-catalog/' +
              asset.sha256,
          };
      }
      return row;
    });
    if (!rows.length) continue;
    const columns = Object.keys(schemas[table].shape).join(', ');
    statements.push(
      'insert into public.' +
        table +
        ' (' +
        columns +
        ') select ' +
        columns +
        ' from jsonb_populate_recordset(null::public.' +
        table +
        ', ' +
        dollar(rows) +
        '::jsonb);',
    );
  }
  statements.push("update public.products set status = 'published';");
  statements.push(
    'insert into public.product_sources (product_id, source_ref) select id, ' +
      dollar(
        'Catálogo público ' +
          sourceOrigin +
          ' exportado el ' +
          snapshot.exportedAt,
      ) +
      ' from public.products;',
  );
  for (const table of catalogTables)
    statements.push(
      'do $$ begin if (select count(*) from public.' +
        table +
        ') <> ' +
        snapshot.tables[table].length +
        " then raise exception 'Recuento incorrecto'; end if; end $$;",
    );
  statements.push(apply ? 'commit;' : 'rollback;');
  return statements.join('\n');
}

/** Respuestas limitadas y sin redirecciones: las claves no salen de su destino. */
async function request(url: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new PreviewCatalogError(
      'Solicitud fallida (HTTP ' + response.status + ').',
    );
  return response;
}

async function readImage(response: Response): Promise<Buffer> {
  const reader = response.body?.getReader();
  if (!reader) throw new PreviewCatalogError('Imagen vacía.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 8388608) {
      await reader.cancel();
      throw new PreviewCatalogError('Imagen superior a 8 MiB.');
    }
    chunks.push(value);
  }
  if (!size) throw new PreviewCatalogError('Imagen vacía.');
  return Buffer.concat(chunks);
}

export async function exportCatalog(directory: string) {
  const key = process.env.SOURCE_SUPABASE_PUBLISHABLE_KEY;
  assertPublicSourceKey(key);
  // Un directorio nuevo evita mezclar capturas o sobrescribir trabajo previo.
  await mkdir(directory);
  await mkdir(join(directory, 'media'));
  const tables: Record<string, unknown[]> = {};
  for (const table of catalogTables) {
    const rows: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      const query = new URLSearchParams({
        select: Object.keys(schemas[table].shape).join(','),
        order:
          table === 'product_translations'
            ? 'product_id,locale'
            : table === 'product_scent_profiles'
              ? 'product_id'
              : 'id',
        limit: '500',
        offset: String(offset),
      });
      if (table === 'products') query.set('status', 'eq.published');
      if (table === 'product_variants') query.set('active', 'eq.true');
      const response = await request(
        sourceOrigin + '/rest/v1/' + table + '?' + query,
        {
          headers: {
            apikey: key,
            ...(key.startsWith('sb_publishable_')
              ? {}
              : { Authorization: 'Bearer ' + key }),
          },
        },
      );
      const page = z.array(schemas[table]).parse(await response.json());
      rows.push(...page);
      if (page.length < 500) break;
      if (rows.length > 100_000)
        throw new PreviewCatalogError('Exportación demasiado grande.');
    }
    tables[table] = rows;
  }
  const assets: z.infer<typeof assetSchema>[] = [];
  for (const media of z
    .array(schemas.product_media)
    .parse(tables.product_media)) {
    if (isLocalMedia(media.url)) continue;
    assertSourceMedia(media.url);
    const response = await request(media.url);
    const contentType = z
      .enum(mimeTypes)
      .parse(response.headers.get('content-type')?.split(';')[0]);
    const bytes = await readImage(response);
    const sha256 = hash(bytes);
    await writeFile(join(directory, 'media', sha256), bytes, { mode: 0o600 });
    assets.push({ mediaId: media.id, sha256, contentType });
  }
  const snapshot = parseSnapshot({
    format: 'atelier-public-catalog-v1',
    sourceRef: PRODUCTION_SUPABASE_REF,
    exportedAt: new Date().toISOString(),
    tables,
    assets,
  });
  await writeFile(
    join(directory, 'catalog.json'),
    JSON.stringify(snapshot, null, 2),
    { flag: 'wx', mode: 0o600 },
  );
  return snapshot;
}

function runSql(
  sql: string,
  connection: ReturnType<typeof databaseEnvironment>,
) {
  // No heredar un pooler, service file, hostaddr u opciones de otra conexión.
  const inherited = { ...process.env };
  for (const name of Object.keys(inherited))
    if (name.startsWith('PG') && name !== 'PGSSLROOTCERT')
      delete inherited[name];
  const result = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1'], {
    input: sql,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024,
    env: { ...inherited, ...connection },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  // No mostrar stderr: PostgreSQL puede incluir filas, cadenas o datos de conexión.
  if (result.error || result.status !== 0)
    throw new PreviewCatalogError(
      'Importación SQL fallida: revisar conexión TLS, migraciones y destino vacío. No se confirmó la transacción.',
    );
}

export async function importCatalog(directory: string, apply: boolean) {
  const ref = previewRef(process.env.ATELIER_PREVIEW_SUPABASE_REF);
  const connection = databaseEnvironment(process.env.PREVIEW_DATABASE_URL, ref);
  const snapshot = parseSnapshot(
    JSON.parse(await readFile(join(directory, 'catalog.json'), 'utf8')),
  );
  const files = new Map<string, Buffer>();
  for (const asset of snapshot.assets) {
    const bytes = await readFile(join(directory, 'media', asset.sha256));
    if (bytes.length > 8388608 || hash(bytes) !== asset.sha256)
      throw new PreviewCatalogError('Imagen alterada o incompleta.');
    files.set(asset.sha256, bytes);
  }
  // Ensayo transaccional antes de cualquier escritura en Storage.
  runSql(catalogSql(snapshot, ref), connection);
  if (!apply) return snapshot;
  const key = process.env.PREVIEW_SUPABASE_SECRET_KEY;
  if (snapshot.assets.length && !key)
    throw new PreviewCatalogError(
      'Falta PREVIEW_SUPABASE_SECRET_KEY del destino.',
    );
  for (const asset of new Map(
    snapshot.assets.map((a) => [a.sha256, a]),
  ).values()) {
    await request(
      'https://' +
        ref +
        '.supabase.co/storage/v1/object/product-media/preview-catalog/' +
        asset.sha256,
      {
        method: 'POST',
        headers: {
          apikey: key!,
          Authorization: 'Bearer ' + key!,
          'Content-Type': asset.contentType,
          'x-upsert': 'true',
        },
        body: new Uint8Array(files.get(asset.sha256)!),
      },
    );
  }
  runSql(catalogSql(snapshot, ref, true), connection);
  return snapshot;
}

async function main() {
  const [command, directory, ...flags] = process.argv.slice(2);
  if (
    !directory ||
    !['export', 'import'].includes(command ?? '') ||
    flags.some((flag) => flag !== '--apply') ||
    (command === 'export' && flags.length)
  )
    throw new PreviewCatalogError(
      'Uso: node scripts/preview-catalog.ts export|import DIRECTORIO [--apply solo import].',
    );
  const snapshot =
    command === 'export'
      ? await exportCatalog(directory)
      : await importCatalog(directory, flags.includes('--apply'));
  console.log(
    command === 'export'
      ? 'Catálogo exportado.'
      : flags.includes('--apply')
        ? 'Catálogo importado en pruebas.'
        : 'Simulacro correcto; transacción deshecha, sin subidas a Storage.',
  );
  console.log(
    Object.fromEntries(
      catalogTables.map((table) => [table, snapshot.tables[table].length]),
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error: unknown) => {
    if (error instanceof PreviewCatalogError) console.error(error.message);
    console.error(
      'No se completó la operación. Comprueba los requisitos de docs/TEST_ENVIRONMENT.md; no se imprimen credenciales ni filas.',
    );
    process.exitCode = 1;
  });
}
