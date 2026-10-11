-- Copias, estado del sistema, uso del asistente y calidad de datos de la
-- consola del titular: solo el titular con MFA; la tarea programada
-- (service_role) solo lista, exporta y registra copias; bucket privado que
-- solo lee el titular; registro de copias de solo inserción. Datos
-- ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(55);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000121', 'titular@test.invalid', now()),
  ('00000000-0000-4000-8000-000000000122', 'tienda@test.invalid', now()),
  ('00000000-0000-4000-8000-000000000123', 'encargado@test.invalid', null),
  ('00000000-0000-4000-8000-000000000124', 'otro-sistema@test.invalid', null);

insert into public.staff_members (user_id, role, display_name) values
  ('00000000-0000-4000-8000-000000000121', 'system_admin', 'Titular de pruebas'),
  ('00000000-0000-4000-8000-000000000122', 'store_admin', null),
  ('00000000-0000-4000-8000-000000000123', 'viewer', '  '),
  ('00000000-0000-4000-8000-000000000124', 'system_admin', null);

insert into internal.control_owners (user_id) values
  ('00000000-0000-4000-8000-000000000121');

-- Verificación en dos pasos: el titular la tiene verificada; la tienda, a
-- medias (no cuenta).
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000012f1', '00000000-0000-4000-8000-000000000121',
   'Móvil', 'totp', 'verified', now(), now()),
  ('00000000-0000-4000-8000-0000000012f2', '00000000-0000-4000-8000-000000000122',
   'Móvil', 'totp', 'unverified', now(), now());

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;

create function pg_temp.location_id() returns uuid
language sql as $$
  select id from public.stock_locations where code = 'castelldefels';
$$;

-- Las siete funciones; las cuatro últimas son solo del titular.
create function pg_temp.all_calls() returns text[]
language sql as $$
  select array[
    'select * from public.admin_control_export_catalog()',
    $q$select public.admin_control_export('public', 'brands', 0)$q$,
    $q$select public.admin_control_log_backup('manual', null, 1, null, '{}', 'ok')$q$,
    'select * from public.admin_control_backups()',
    'select public.admin_control_system_status()',
    $q$select * from public.admin_control_assistant_usage('2026-09-01', '2026-10-01')$q$,
    'select * from public.admin_control_data_quality()'
  ];
$$;
create function pg_temp.owner_calls() returns text[]
language sql as $$
  select (pg_temp.all_calls())[4:7];
$$;

-- Llamadas que NO fallan con 42501 (y con ese mensaje, si se indica): la
-- matriz de acceso pasa si devuelve un array vacío.
create function pg_temp.not_denied(p_calls text[], p_message text) returns text[]
language plpgsql as $$
declare
  v_call text;
  v_result text[] := '{}';
begin
  foreach v_call in array p_calls loop
    begin
      execute v_call;
      v_result := v_result || v_call;
    exception when insufficient_privilege then
      if p_message is not null and sqlerrm <> p_message then
        v_result := v_result || (v_call || ' → ' || sqlerrm);
      end if;
    end;
  end loop;
  return v_result;
end;
$$;
grant execute on function pg_temp.all_calls(), pg_temp.owner_calls(),
  pg_temp.not_denied(text[], text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Bucket y registro
-- ---------------------------------------------------------------------------

select results_eq(
  $$select public, file_size_limit, allowed_mime_types from storage.buckets
    where id = 'system-backups'$$,
  $$values (false, 52428800::bigint, array['application/gzip'])$$,
  'bucket privado de 50 MB solo para gzip');
select is(
  (select array_agg(p.cmd || ' ' || array_to_string(p.roles, ',') order by p.policyname)
   from pg_policies p
   where p.schemaname = 'storage' and p.tablename = 'objects'
     and (p.qual like '%system-backups%' or p.with_check like '%system-backups%')),
  array['SELECT authenticated'],
  'una sola política en el bucket: lectura para authenticated');
select is_empty(
  $$select r from unnest(array['anon', 'authenticated']) r
    where has_table_privilege(r, 'internal.control_backups', 'select,insert,update,delete,truncate')$$,
  'el registro de copias no se toca desde la API');

-- ---------------------------------------------------------------------------
-- Matriz de acceso
-- ---------------------------------------------------------------------------

set local role anon;
select is(pg_temp.not_denied(pg_temp.all_calls(), null), '{}'::text[],
  'anon no ejecuta ninguna de las siete funciones');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000123', 'aal2');
select is(pg_temp.not_denied(pg_temp.all_calls(), 'forbidden'), '{}'::text[],
  'el encargado no usa ninguna');
select pg_temp.act_as('00000000-0000-4000-8000-000000000122', 'aal2');
select is(pg_temp.not_denied(pg_temp.all_calls(), 'forbidden'), '{}'::text[],
  'el administrador de la tienda no usa ninguna');
select pg_temp.act_as('00000000-0000-4000-8000-000000000124', 'aal2');
select is(pg_temp.not_denied(pg_temp.all_calls(), 'forbidden'), '{}'::text[],
  'otro administrador del sistema no titular no usa ninguna');
select pg_temp.act_as('00000000-0000-4000-8000-000000000121', 'aal1');
select is(pg_temp.not_denied(pg_temp.all_calls(), 'forbidden'), '{}'::text[],
  'el titular sin MFA no usa ninguna');
reset role;

-- ---------------------------------------------------------------------------
-- Tarea programada: lista, exporta y registra; nada más
-- ---------------------------------------------------------------------------

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000012b1', 'marca-calidad', 'Marca de calidad'),
  ('00000000-0000-4000-8000-0000000012b2', 'marca-copia-b', 'Marca de copia B'),
  ('00000000-0000-4000-8000-0000000012b3', 'marca-copia-c', 'Marca de copia C');

set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select is(pg_temp.not_denied(pg_temp.owner_calls(), 'forbidden'), '{}'::text[],
  'la tarea programada no lee la lista de copias, el estado, el asistente ni la calidad');
select is(
  (select key_columns from public.admin_control_export_catalog()
   where schema_name = 'public' and table_name = 'store_sale_lines'),
  array['sale_id', 'variant_id'], 'la lista da la clave primaria, también compuesta');
select is_empty(
  $$select schema_name || '.' || table_name from public.admin_control_export_catalog()
    where cardinality(key_columns) = 0 or approx_rows is null$$,
  'todas las tablas de la copia tienen clave primaria y filas aproximadas');
select is_empty(
  $$select a.schema_name || '.' || a.table_name || ' antes que ' || b.schema_name || '.' || b.table_name
    from public.admin_control_export_catalog() with ordinality as a(schema_name, table_name, key_columns, approx_rows, n)
    cross join public.admin_control_export_catalog() with ordinality as b(schema_name, table_name, key_columns, approx_rows, n)
    join pg_class ca on ca.relname = a.table_name
    join pg_namespace na on na.oid = ca.relnamespace and na.nspname = a.schema_name
    join pg_class cb on cb.relname = b.table_name
    join pg_namespace nb on nb.oid = cb.relnamespace and nb.nspname = b.schema_name
    join pg_constraint c
      on c.contype = 'f' and c.conrelid = ca.oid and c.confrelid = cb.oid
    where a.n <= b.n and c.conrelid <> c.confrelid$$,
  'la lista va en orden de dependencias: lo referenciado primero');
select is_empty(
  $$select n.nspname || '.' || c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'internal', 'private') and c.relkind in ('r', 'p')
      and n.nspname || '.' || c.relname not in (
        'private.pending_staff_grants', 'private.inventory_requests',
        'private.price_reviews', 'internal.attention_rate')
      and not exists (
        select 1 from public.admin_control_export_catalog() w
        where w.schema_name = n.nspname and w.table_name = c.relname)$$,
  'toda tabla del negocio entra en la copia salvo las excluidas a propósito');
select throws_ok(
  $$select public.admin_control_export('auth', 'users', 0)$$,
  '22023', 'invalid_table', 'nunca exporta auth.users');
select throws_ok(
  $$select public.admin_control_export('private', 'pending_staff_grants', 0)$$,
  '22023', 'invalid_table', 'ni las invitaciones pendientes');
select throws_ok(
  $$select public.admin_control_export('public', 'brands; drop table public.brands', 0)$$,
  '22023', 'invalid_table', 'el nombre de la tabla sale de la lista, no del texto recibido');
select throws_ok(
  $$select public.admin_control_export('public', 'brands', -1)$$,
  '22023', 'invalid_page', 'rechaza un desplazamiento negativo');
select throws_ok(
  $$select public.admin_control_export('public', 'brands', 0, 10001)$$,
  '22023', 'invalid_page', 'rechaza más de 10 000 filas por página');
select is(
  public.admin_control_export('public', 'brands', 0, 2),
  (select jsonb_agg(to_jsonb(b) order by b.id)
   from (select * from public.brands order by id limit 2) b),
  'primera página ordenada por la clave primaria');
select is(
  public.admin_control_export('public', 'brands', 2, 2),
  (select jsonb_agg(to_jsonb(b) order by b.id)
   from (select * from public.brands order by id offset 2 limit 2) b),
  'segunda página');
select is(
  public.admin_control_export('public', 'brands', (select count(*)::integer from public.brands), 5),
  '[]'::jsonb, 'más allá del final, un array vacío');

select isnt(
  public.admin_control_log_backup('scheduled', 'db/2026/10/2026-10-11.json.gz', 2048,
    repeat('a', 64), '{"public.brands": 3}', 'ok'),
  null, 'la tarea programada registra la copia diaria');
select throws_ok(
  $$select public.admin_control_log_backup('scheduled', null, 2048, null, '{}', 'ok')$$,
  '22023', 'invalid_backup', 'una copia diaria correcta lleva ruta');
select throws_ok(
  $$select public.admin_control_log_backup('manual', null, 2048, 'xyz', '{}', 'ok')$$,
  '22023', 'invalid_backup', 'rechaza un sha256 mal formado');
select throws_ok(
  $$select public.admin_control_log_backup('weekly', 'db/x.json.gz', 1, null, '{}', 'ok')$$,
  '22023', 'invalid_backup', 'rechaza un tipo desconocido');
select lives_ok(
  $$select public.admin_control_log_backup('scheduled', null, null, null, null, 'error',
    repeat('x', 800))$$,
  'registra un fallo con un mensaje largo');

-- El titular descarga una copia al momento (no se guarda en el bucket).
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000121', 'aal2');
select lives_ok(
  $$select public.admin_control_log_backup('manual', null, 4096, upper(repeat('b', 64)),
    '{"public.brands": 3}', 'ok')$$,
  'el titular registra una descarga');
reset role;

select results_eq(
  $$select kind, path, size_bytes, sha256, status, char_length(error), actor_id::text
    from internal.control_backups where created_at = now() order by id$$,
  $$values
    ('scheduled', 'db/2026/10/2026-10-11.json.gz', 2048::bigint, repeat('a', 64), 'ok',
     null::integer, null::text),
    ('scheduled', null, null, null, 'error', 500, null),
    ('manual', null, 4096, repeat('b', 64), 'ok', null, '00000000-0000-4000-8000-000000000121')$$,
  'quién, ruta, tamaño, sha256 en minúsculas y error recortado a 500');
select is(
  (select array_agg(a.after::text order by a.id) from public.audit_log a
   where a.action = 'control.backup_logged' and a.at = now()),
  array['{"kind": "scheduled", "status": "ok"}', '{"kind": "scheduled", "status": "error"}',
        '{"kind": "manual", "status": "ok"}'],
  'cada copia queda en la auditoría, sin tamaños ni rutas');
select throws_ok('update internal.control_backups set status = ''error''', '42501', null,
  'nadie modifica el registro de copias');
select throws_ok('delete from internal.control_backups', '42501', null,
  'nadie borra el registro de copias');

-- ---------------------------------------------------------------------------
-- Titular: lista de copias y bucket
-- ---------------------------------------------------------------------------

insert into storage.objects (bucket_id, name, metadata) values
  ('system-backups', 'db/2026/10/prueba-pgtap.json.gz',
   '{"size": 2048, "mimetype": "application/gzip"}');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000121', 'aal2');
select results_eq(
  $$select kind, status from public.admin_control_backups() where created_at = now()$$,
  $$values ('manual', 'ok'), ('scheduled', 'error'), ('scheduled', 'ok')$$,
  'la lista va de la más reciente a la más antigua');
select is((select count(*)::integer from public.admin_control_backups(2)), 2,
  'con un límite de filas');
select throws_ok('select * from public.admin_control_backups(0)', '22023', 'invalid_limit',
  'rechaza un límite fuera de rango');
select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'system-backups' and name = 'db/2026/10/prueba-pgtap.json.gz'),
  1, 'el titular con MFA ve las copias del bucket');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('system-backups', 'db/falsa.json.gz')$$,
  '42501', null, 'ni el titular sube copias: solo la tarea programada');
select pg_temp.act_as('00000000-0000-4000-8000-000000000121', 'aal1');
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'system-backups'),
  0, 'sin MFA, el titular no ve el bucket');
select pg_temp.act_as('00000000-0000-4000-8000-000000000122', 'aal2');
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'system-backups'),
  0, 'el administrador de la tienda no ve el bucket');
select pg_temp.act_as('00000000-0000-4000-8000-000000000124', 'aal2');
select is(
  (select count(*)::integer from storage.objects where bucket_id = 'system-backups'),
  0, 'otro administrador del sistema no titular tampoco');
reset role;

-- ---------------------------------------------------------------------------
-- Estado del sistema
-- ---------------------------------------------------------------------------

-- Informe de mañana (el último seguro), de la tarea programada y sin resumen.
insert into public.daily_reports (location_id, report_date, facts)
values (pg_temp.location_id(), (now() at time zone 'Europe/Madrid')::date + 1, '{}');
insert into public.newsletter_subscribers (email, locale, consent_version, unsubscribed_at,
  sender_synced_at) values
  ('activa-sincronizada@test.invalid', 'es', 'v1', null, now()),
  ('activa-pendiente@test.invalid', 'ca', 'v1', null, null),
  ('baja@test.invalid', 'en', 'v1', now(), now());

create temporary table status_snapshot (s jsonb);
grant insert on status_snapshot to authenticated;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000121', 'aal2');
insert into status_snapshot select public.admin_control_system_status();
reset role;

select is(
  (select array_agg(k order by k) from status_snapshot, jsonb_object_keys(s) k),
  array['attention_30d', 'auth', 'daily_report', 'database', 'generated_at', 'last_backup',
        'migrations', 'newsletter', 'storage', 'tables'],
  'el estado tiene todas sus claves');
select is(
  (select s -> 'auth' from status_snapshot),
  jsonb_build_object(
    'users', (select count(*) from auth.users where deleted_at is null),
    'confirmed', (select count(*) from auth.users
                  where deleted_at is null and email_confirmed_at is not null),
    'with_totp', (select count(distinct f.user_id) from auth.mfa_factors f
                  join auth.users u on u.id = f.user_id and u.deleted_at is null
                  where f.factor_type = 'totp' and f.status = 'verified')),
  'cuentas: solo recuentos, con la verificación en dos pasos ya verificada');
select is(
  (select e from status_snapshot, jsonb_array_elements(s -> 'storage') e
   where e ->> 'bucket' = 'system-backups'),
  jsonb_build_object('bucket', 'system-backups',
    'objects', (select count(*) from storage.objects where bucket_id = 'system-backups'),
    'bytes', (select sum((metadata ->> 'size')::bigint) from storage.objects
              where bucket_id = 'system-backups')),
  'almacenamiento por bucket: objetos y bytes');
select is(
  (select s -> 'daily_report' from status_snapshot),
  jsonb_build_object('report_date', (now() at time zone 'Europe/Madrid')::date + 1,
    'generated_at', now(), 'by_cron', true, 'has_summary', false),
  'último informe diario: fecha, tarea programada y sin resumen');
select is(
  (select s -> 'newsletter' from status_snapshot),
  jsonb_build_object(
    'active', (select count(*) from public.newsletter_subscribers where unsubscribed_at is null),
    'unsubscribed', (select count(*) from public.newsletter_subscribers
                     where unsubscribed_at is not null),
    'pending_sender', (select count(*) from public.newsletter_subscribers
                       where unsubscribed_at is null and sender_synced_at is null)),
  'suscriptores activos, bajas y pendientes de Sender');
select is(
  (select (s -> 'last_backup') - 'created_at' from status_snapshot),
  '{"kind": "manual", "status": "ok", "size_bytes": 4096}'::jsonb,
  'última copia registrada');
select ok(
  (select (s -> 'database' ->> 'size_bytes')::bigint > 0
          and (s -> 'migrations') @> '[{"version": "20261011090000", "name": "control_owners"}]'
          and (s -> 'tables') @> '[{"schema": "internal", "name": "control_backups"}]'
          and (s -> 'attention_30d' = 'null'::jsonb)
              = (to_regclass('internal.product_attention_daily') is null)
   from status_snapshot),
  'tamaño de la base, migraciones aplicadas, tablas y visitas solo si existe su tabla');
select is_empty(
  $$select 1
    from status_snapshot,
         jsonb_array_elements(s -> 'tables') with ordinality as t(e, n)
    join lateral jsonb_array_elements(s -> 'tables') with ordinality as u(e, n) on u.n = t.n + 1
    where (t.e ->> 'total_bytes')::bigint < (u.e ->> 'total_bytes')::bigint$$,
  'las tablas van de mayor a menor tamaño');

-- ---------------------------------------------------------------------------
-- Uso del asistente
-- ---------------------------------------------------------------------------

-- Días de Madrid (CEST = +02): la primera es el 10 a la 01:30; las dos
-- últimas caen el 9 y el 11, fuera del periodo [10, 11).
insert into public.assistant_usage (user_id, kind, model, input_tokens, output_tokens,
  cache_read_tokens, created_at) values
  ('00000000-0000-4000-8000-000000000121', 'chat', 'claude-opus-5-5', 100, 20, 5,
   '2026-09-09 23:30+00'),
  ('00000000-0000-4000-8000-000000000121', 'chat', 'claude-opus-5-5', 50, 10, 0,
   '2026-09-10 12:00+02'),
  ('00000000-0000-4000-8000-000000000123', 'chat', 'claude-opus-5-5', 10, 1, 0,
   '2026-09-10 18:00+02'),
  (null, 'daily_summary', 'claude-opus-5-5', 1000, 200, 300, '2026-09-10 08:00+02'),
  ('00000000-0000-4000-8000-000000000121', 'chat', 'claude-opus-5-5', 7, 7, 7,
   '2026-09-09 23:59+02'),
  ('00000000-0000-4000-8000-000000000121', 'chat', 'claude-opus-5-5', 9, 9, 9,
   '2026-09-11 00:00+02');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000121', 'aal2');
select results_eq(
  $$select day, user_id::text, person, kind, model, calls, input_tokens, output_tokens,
           cache_read_tokens
    from public.admin_control_assistant_usage('2026-09-10', '2026-09-11')$$,
  $$values
    ('2026-09-10'::date, null::text, 'Tarea programada', 'daily_summary', 'claude-opus-5-5',
     1, 1000::bigint, 200::bigint, 300::bigint),
    ('2026-09-10', '00000000-0000-4000-8000-000000000121', 'Titular de pruebas', 'chat',
     'claude-opus-5-5', 2, 150, 30, 5),
    ('2026-09-10', '00000000-0000-4000-8000-000000000123', 'Encargado', 'chat',
     'claude-opus-5-5', 1, 10, 1, 0)$$,
  'por día de Madrid, persona (nombre o rol, nunca el email), tipo y modelo');
select throws_ok(
  $$select * from public.admin_control_assistant_usage('2026-01-01', '2027-02-06')$$,
  '22023', 'invalid_period', 'periodo de más de 400 días');
select throws_ok(
  $$select * from public.admin_control_assistant_usage('2026-09-10', '2026-09-10')$$,
  '22023', 'invalid_period', 'periodo vacío');
reset role;

-- ---------------------------------------------------------------------------
-- Calidad de datos
-- ---------------------------------------------------------------------------

-- X: publicado con un formato sin PVP, sin SKU ni coste, EAN repetido, solo en
-- español, sin imagen, sin perfil y con la marca por revisar.
-- Y: publicado y completo salvo la imagen principal provisional (la «hero»
-- manda sobre la primera por posición).
-- Z: borrador con existencias; uno de sus formatos, descuadrado.
-- W: archivado: no cuenta aunque le falte el coste o esté por revisar.
insert into public.products (id, brand_id, slug, name, status, source_ref) values
  ('00000000-0000-4000-8000-0000000012a1', '00000000-0000-4000-8000-0000000012b1',
   'perfume-calidad', 'Perfume de calidad', 'draft',
   'CATALOGO 2026, p. 9 · marca deducida, por revisar'),
  ('00000000-0000-4000-8000-0000000012a2', '00000000-0000-4000-8000-0000000012b1',
   'perfume-completo', 'Perfume completo', 'draft', 'Ficha oficial'),
  ('00000000-0000-4000-8000-0000000012a3', '00000000-0000-4000-8000-0000000012b1',
   'borrador-con-stock', 'Borrador con stock', 'draft', null),
  ('00000000-0000-4000-8000-0000000012a4', '00000000-0000-4000-8000-0000000012b1',
   'archivado-calidad', 'Archivado de calidad', 'archived', 'Por revisar');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents, sku, ean) values
  ('00000000-0000-4000-8000-0000000012c1', '00000000-0000-4000-8000-0000000012a1', 100, 4995,
   'CAL-100', '8400000012001'),
  ('00000000-0000-4000-8000-0000000012c2', '00000000-0000-4000-8000-0000000012a1', 50, null,
   null, ' 8400000012001 '),
  ('00000000-0000-4000-8000-0000000012c3', '00000000-0000-4000-8000-0000000012a2', 100, 3995,
   'CAL-Y100', '8400000012002'),
  ('00000000-0000-4000-8000-0000000012c4', '00000000-0000-4000-8000-0000000012a3', 100, null,
   null, null),
  ('00000000-0000-4000-8000-0000000012c5', '00000000-0000-4000-8000-0000000012a3', 50, null,
   null, null),
  ('00000000-0000-4000-8000-0000000012c6', '00000000-0000-4000-8000-0000000012a4', 30, null,
   null, null);
insert into internal.variant_cost_records (variant_id, cost_net_cents) values
  ('00000000-0000-4000-8000-0000000012c1', 2000),
  ('00000000-0000-4000-8000-0000000012c3', 1500);
insert into public.product_translations (product_id, locale, tagline, description) values
  ('00000000-0000-4000-8000-0000000012a1', 'es', 'Frase', null),
  ('00000000-0000-4000-8000-0000000012a1', 'ca', ' ', ''),
  ('00000000-0000-4000-8000-0000000012a2', 'es', 'Frase', null),
  ('00000000-0000-4000-8000-0000000012a2', 'ca', null, 'Descripció'),
  ('00000000-0000-4000-8000-0000000012a2', 'en', 'Tagline', null);
insert into public.product_scent_profiles (product_id, key_notes, source_url) values
  ('00000000-0000-4000-8000-0000000012a2', array['oud'], 'https://example.com/ficha');
insert into public.product_media (product_id, url, role, origin, provisional, position) values
  ('00000000-0000-4000-8000-0000000012a2', '/media/completo-galeria.jpg', 'gallery',
   'own_photo', false, 0),
  ('00000000-0000-4000-8000-0000000012a2', '/media/completo-principal.jpg', 'hero',
   'catalog_pdf', true, 5);
update public.products set status = 'published'
where id in ('00000000-0000-4000-8000-0000000012a1', '00000000-0000-4000-8000-0000000012a2');

-- Z: 3 uds en cada formato según los movimientos; el de 50 ml dice 5.
insert into public.inventory_movements (variant_id, location_id, type, quantity, delta_on_hand,
  delta_reserved, on_hand_after, reserved_after) values
  ('00000000-0000-4000-8000-0000000012c4', pg_temp.location_id(), 'PURCHASE_RECEIPT', 3, 3, 0,
   3, 0),
  ('00000000-0000-4000-8000-0000000012c5', pg_temp.location_id(), 'PURCHASE_RECEIPT', 3, 3, 0,
   3, 0);
insert into public.inventory_levels (variant_id, location_id, on_hand) values
  ('00000000-0000-4000-8000-0000000012c4', pg_temp.location_id(), 3),
  ('00000000-0000-4000-8000-0000000012c5', pg_temp.location_id(), 5);

create temporary table quality_snapshot (
  check_key text, severity text, product_id uuid, variant_id uuid, label text, detail text
);
grant insert on quality_snapshot to authenticated;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000121', 'aal2');
insert into quality_snapshot select * from public.admin_control_data_quality();
reset role;

select results_eq(
  $$select check_key, severity, variant_id::text, label, detail from quality_snapshot
    where product_id = '00000000-0000-4000-8000-0000000012a1'$$,
  $$values
    ('product_without_image', 'high', null::text, 'Marca de calidad · Perfume de calidad',
     'Sin ninguna imagen'),
    ('variant_without_price', 'high', '00000000-0000-4000-8000-0000000012c2',
     'Marca de calidad · Perfume de calidad · 50 ml', 'Formato activo sin PVP'),
    ('duplicate_ean', 'medium', '00000000-0000-4000-8000-0000000012c1',
     'Marca de calidad · Perfume de calidad · 100 ml', 'EAN 8400000012001 en 2 formatos'),
    ('duplicate_ean', 'medium', '00000000-0000-4000-8000-0000000012c2',
     'Marca de calidad · Perfume de calidad · 50 ml', 'EAN 8400000012001 en 2 formatos'),
    ('missing_translation', 'medium', null, 'Marca de calidad · Perfume de calidad',
     'Falta el texto en: ca, en'),
    ('variant_without_cost', 'medium', '00000000-0000-4000-8000-0000000012c2',
     'Marca de calidad · Perfume de calidad · 50 ml', 'Sin ningún coste registrado'),
    ('product_without_scent', 'low', null, 'Marca de calidad · Perfume de calidad',
     'Sin perfil olfativo'),
    ('source_to_review', 'low', null, 'Marca de calidad · Perfume de calidad',
     'CATALOGO 2026, p. 9 · marca deducida, por revisar'),
    ('variant_without_sku', 'low', '00000000-0000-4000-8000-0000000012c2',
     'Marca de calidad · Perfume de calidad · 50 ml', 'Formato activo sin SKU')$$,
  'cada incidencia del perfume, por gravedad, con su etiqueta y su dato');
select results_eq(
  $$select check_key, severity, variant_id::text, label, detail from quality_snapshot
    where product_id = '00000000-0000-4000-8000-0000000012a2'$$,
  $$values ('provisional_image', 'low', null::text, 'Marca de calidad · Perfume completo',
            'Imagen principal provisional: catálogo PDF')$$,
  'un perfume completo solo avisa de su imagen principal provisional');
select results_eq(
  $$select check_key, severity, variant_id::text, detail from quality_snapshot
    where product_id = '00000000-0000-4000-8000-0000000012a3'
      and check_key in ('stock_mismatch', 'draft_with_stock')$$,
  $$values
    ('stock_mismatch', 'high', '00000000-0000-4000-8000-0000000012c5',
     (select name from public.stock_locations where code = 'castelldefels')
       || ': 5 en existencias y 3 según los movimientos'),
    ('draft_with_stock', 'medium', '00000000-0000-4000-8000-0000000012c4',
     '3 uds en existencias'),
    ('draft_with_stock', 'medium', '00000000-0000-4000-8000-0000000012c5',
     '5 uds en existencias')$$,
  'descuadre de existencias y borrador con existencias');
select is_empty(
  $$select 1 from quality_snapshot where product_id = '00000000-0000-4000-8000-0000000012a4'$$,
  'un perfume archivado no da incidencias');

-- La matriz no es vacía de por sí: con MFA, el titular usa las siete.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000121', 'aal2');
select is(pg_temp.not_denied(pg_temp.all_calls(), 'forbidden'), pg_temp.all_calls(),
  'el titular con MFA usa las siete funciones');
reset role;

select * from finish();
rollback;
