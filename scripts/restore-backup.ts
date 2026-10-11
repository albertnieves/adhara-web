/**
 * Restaura una copia de la consola (latelier-copia-….json.gz o la de
 * system-backups) en Supabase LOCAL. Nunca contra un proyecto remoto:
 * restaurar en adhara-dev o en producción es una decisión del titular y se
 * hace a mano (DECISIONS §119).
 *
 *   node scripts/local-env.ts node scripts/restore-backup.ts copia.json.gz --dry-run
 *   node scripts/local-env.ts node scripts/restore-backup.ts copia.json.gz
 *
 * --dry-run (simulacro) carga todo en una transacción, comprueba que cada
 * tabla queda con las filas de la copia y la deshace. Sin él, sustituye el
 * contenido de las tablas de la copia y confirma.
 *
 * Qué no restaura: las fotos de Storage, las cuentas de Auth (contraseñas y
 * MFA: crea cuentas mínimas para los usuarios que aparecen en los datos) ni
 * nada fuera de la lista de tablas de la copia. Los triggers se desactivan
 * durante la carga (session_replication_role = replica) para no reescribir
 * historiales ni auditoría.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

const CONTAINER = 'supabase_db_adhara-admin-delivery';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USER_COLUMNS = [
  'user_id',
  'actor_id',
  'created_by',
  'updated_by',
  'generated_by',
];
const TABLE_KEY = /^(public|internal|private)\.[a-z_][a-z0-9_]*$/;

type Row = Record<string, unknown>;
type Backup = {
  format: string;
  version: number;
  row_counts: Record<string, number>;
  tables: Record<string, Row[]>;
};

if (
  process.env.ADHARA_LOCAL_TEST !== '1' ||
  !/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  )
)
  throw new Error(
    'Solo Supabase local: ejecútalo con node scripts/local-env.ts node scripts/restore-backup.ts …',
  );

const [file, ...flags] = process.argv.slice(2);
if (!file) throw new Error('Falta el archivo de la copia (.json.gz).');
const dryRun = flags.includes('--dry-run');

const backup = JSON.parse(
  gunzipSync(readFileSync(file)).toString('utf8'),
) as Backup;
if (backup.format !== 'latelier-backup' || backup.version !== 1)
  throw new Error('No es una copia de la consola (formato o versión).');
const tables = Object.keys(backup.tables);
for (const key of tables)
  if (!TABLE_KEY.test(key)) throw new Error(`Tabla no válida: ${key}`);

/** Dólar-comillas con una etiqueta que no aparece en el contenido. */
function dollar(text: string) {
  let tag = 'restaurar';
  while (text.includes(`$${tag}$`)) tag += '_x';
  return `$${tag}$${text}$${tag}$`;
}

const users = new Set<string>();
for (const rows of Object.values(backup.tables))
  for (const row of rows)
    for (const column of USER_COLUMNS) {
      const value = row[column];
      if (typeof value === 'string' && UUID.test(value)) users.add(value);
    }

const sql: string[] = [
  '\\set ON_ERROR_STOP 1',
  'begin;',
  'set local session_replication_role = replica;',
];
for (const id of users)
  sql.push(
    `insert into auth.users (id, email) values ('${id}', 'restaurado+${id}@test.invalid') on conflict (id) do nothing;`,
  );
for (const key of tables) sql.push(`delete from ${key};`);
for (const key of tables) {
  const rows = backup.tables[key]!;
  if (rows.length === 0) continue;
  sql.push(
    `insert into ${key} overriding system value select * from jsonb_populate_recordset(null::${key}, ${dollar(JSON.stringify(rows))}::jsonb);`,
  );
}
// Las columnas de identidad siguen desde el máximo restaurado.
sql.push(`do $$
declare r record;
begin
  for r in
    select n.nspname as s, c.relname as t, a.attname as col
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where a.attidentity <> '' and n.nspname || '.' || c.relname = any (array[${tables.map((t) => `'${t}'`).join(', ')}]::text[])
  loop
    execute format(
      'select setval(pg_get_serial_sequence(%L, %L), coalesce((select max(%I) from %I.%I), 0) + 1, false)',
      r.s || '.' || r.t, r.col, r.col, r.s, r.t);
  end loop;
end $$;`);
for (const key of tables) {
  const expected = backup.tables[key]!.length;
  sql.push(`do $$ begin
  if (select count(*) from ${key}) <> ${expected} then
    raise exception 'restauración: ${key} no tiene ${expected} filas';
  end if;
end $$;`);
}
sql.push(dryRun ? 'rollback;' : 'commit;');

const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    CONTAINER,
    'psql',
    '-X',
    '-q',
    '-U',
    'postgres',
    '-d',
    'postgres',
  ],
  { input: sql.join('\n'), encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
);
if (result.status !== 0) {
  console.error(result.stderr || result.stdout);
  process.exit(1);
}
const total = Object.values(backup.tables).reduce(
  (n, rows) => n + rows.length,
  0,
);
console.log(
  `${dryRun ? 'Simulacro correcto (deshecho)' : 'Restauración correcta'}: ${tables.length} tablas, ${total} filas, ${users.size} cuentas mínimas.`,
);
