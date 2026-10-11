-- Copias de seguridad, estado del sistema, uso del asistente y calidad de
-- datos de la consola del titular (/admin/control/copias, /sistema,
-- /asistente y /calidad). Todo es del titular con MFA
-- (private.require_business_control); la tarea programada de la copia diaria
-- (service_role, tras CRON_SECRET) solo puede leer la lista de tablas,
-- exportarlas y registrar la copia.
--
-- La copia propia es un volcado JSON de una lista blanca fija de tablas del
-- negocio (nunca auth.*: ni contraseñas ni factores). Se guarda comprimida en
-- el bucket privado system-backups, que solo escribe la tarea programada con
-- la clave privilegiada; el titular solo puede leerlo (descargas con URL
-- firmada). El registro de copias es de solo inserción.

-- ---------------------------------------------------------------------------
-- Bucket privado de copias
-- ---------------------------------------------------------------------------

-- Privado y solo para gzip. Si ya existiera, se fuerza a privado.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('system-backups', 'system-backups', false, 52428800, array['application/gzip'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Una sola política: el titular con MFA lee. Sin INSERT, UPDATE ni DELETE:
-- solo escribe y borra la tarea programada con service_role (sin RLS).
create policy "el titular lee las copias del sistema" on storage.objects
  for select to authenticated
  using (bucket_id = 'system-backups' and (select private.is_control_owner()));

-- ---------------------------------------------------------------------------
-- Registro de copias (internal, solo inserción)
-- ---------------------------------------------------------------------------

-- kind: «scheduled» la copia diaria al bucket; «manual» la descarga al momento
-- desde la consola (no se guarda en el bucket: path null). table_rows guarda
-- las filas copiadas por tabla ('esquema.tabla' → filas). Una copia fallida
-- guarda solo un mensaje corto, sin datos.
create table internal.control_backups (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('scheduled', 'manual')),
  path text check (char_length(path) between 1 and 300),
  size_bytes bigint check (size_bytes >= 0),
  sha256 text check (sha256 ~ '^[0-9a-f]{64}$'),
  table_rows jsonb not null default '{}'
    check (jsonb_typeof(table_rows) = 'object' and octet_length(table_rows::text) <= 20000),
  status text not null check (status in ('ok', 'error')),
  error text check (char_length(error) <= 500),
  -- Quién la pidió; null en la tarea programada. Sin clave ajena: el registro
  -- es de solo inserción y un ON DELETE SET NULL tendría que modificarlo.
  actor_id uuid,
  constraint ok_backup_has_size check (status <> 'ok' or size_bytes is not null),
  constraint ok_scheduled_backup_has_path
    check (status <> 'ok' or kind <> 'scheduled' or path is not null)
);

create index control_backups_created_idx on internal.control_backups (created_at desc, id desc);

create trigger control_backups_append_only
  before update or delete on internal.control_backups
  for each row execute function private.reject_mutation();

-- Fuera de la API como el resto de internal.
revoke all on internal.control_backups from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Auxiliares (solo para las funciones security definer)
-- ---------------------------------------------------------------------------

-- La tarea programada (service_role) o el titular con MFA.
create function private.require_control_or_job()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if private.is_service_role() then
    return;
  end if;
  perform private.require_business_control();
end;
$$;

-- Lista blanca de la copia, en orden de dependencias (las tablas referenciadas
-- antes que las que las referencian) para poder restaurarla en ese orden y
-- vaciarla en el inverso. Solo las que existen en esta base:
-- product_attention_daily llega con la medición de visitas. Fuera, a
-- propósito: auth.* (cuentas, contraseñas y factores), las invitaciones
-- pendientes (private.pending_staff_grants, emails), las claves de
-- idempotencia (private.inventory_requests), las revisiones de precio de 15
-- minutos (private.price_reviews) y el freno por minuto de las visitas
-- (internal.attention_rate).
create function private.control_export_tables()
returns table (schema_name text, table_name text, sort_order integer)
language sql
stable
set search_path = ''
as $$
  select split_part(w.qualified, '.', 1), split_part(w.qualified, '.', 2), w.n::integer
  from unnest(array[
    'public.permissions',
    'public.role_permissions',
    'public.staff_members',
    'public.stock_locations',
    'public.stock_watch_settings',
    'public.brands',
    'public.products',
    'public.product_translations',
    'public.product_variants',
    'public.product_media',
    'public.product_scent_profiles',
    'public.inventory_levels',
    'public.inventory_movements',
    'public.store_sales',
    'public.store_sale_lines',
    'public.store_content',
    'public.newsletter_subscribers',
    'public.daily_reports',
    'public.audit_log',
    'public.assistant_usage',
    'internal.price_change_log',
    'internal.variant_cost_records',
    'internal.suppliers',
    'internal.supplier_variants',
    'internal.purchase_orders',
    'internal.purchase_order_lines',
    'internal.purchase_receipts',
    'internal.purchase_receipt_lines',
    'internal.control_tasks',
    'internal.control_costs',
    'internal.control_deliveries',
    'internal.control_owners',
    'internal.control_backups',
    'internal.product_attention_daily',
    'private.store_documents',
    'private.store_revisions'
  ]) with ordinality as w(qualified, n)
  where to_regclass(w.qualified) is not null;
$$;

-- Columnas de la clave primaria, en su orden.
create function private.primary_key_columns(p_relation regclass)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(a.attname::text order by k.n), '{}')
  from pg_catalog.pg_index i
  cross join lateral unnest(i.indkey::smallint[]) with ordinality as k(attnum, n)
  join pg_catalog.pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
  where i.indrelid = p_relation and i.indisprimary;
$$;

-- ---------------------------------------------------------------------------
-- Copias: lista de tablas, exportación por páginas y registro
-- ---------------------------------------------------------------------------

-- Tablas que entran en la copia con su clave primaria y sus filas
-- aproximadas (estadísticas de Postgres), en orden de dependencias.
create function public.admin_control_export_catalog()
returns table (
  schema_name text,
  table_name text,
  key_columns text[],
  approx_rows bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_control_or_job();
  return query
    select w.schema_name, w.table_name,
           private.primary_key_columns(to_regclass(format('%I.%I', w.schema_name, w.table_name))),
           s.n_live_tup
    from private.control_export_tables() w
    left join pg_catalog.pg_stat_all_tables s
      on s.relid = to_regclass(format('%I.%I', w.schema_name, w.table_name))
    order by w.sort_order;
end;
$$;

-- Una página de filas de una tabla de la lista blanca, como array jsonb
-- ordenado por la clave primaria. El nombre de la tabla sale de la lista,
-- nunca del texto recibido. Cada llamada es una lectura aparte: la copia no es
-- una instantánea única de toda la base.
create function public.admin_control_export(
  p_schema text,
  p_table text,
  p_offset integer,
  p_limit integer default 5000
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_schema text;
  v_table text;
  v_keys text[];
  v_order text;
  v_rows jsonb;
begin
  perform private.require_control_or_job();
  select w.schema_name, w.table_name into v_schema, v_table
  from private.control_export_tables() w
  where w.schema_name = p_schema and w.table_name = p_table;
  if v_table is null then
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'invalid_page' using errcode = '22023';
  end if;

  v_keys := private.primary_key_columns(to_regclass(format('%I.%I', v_schema, v_table)));
  if cardinality(v_keys) = 0 then
    -- Todas las tablas de la lista tienen clave primaria; sin ella no habría
    -- un orden estable para paginar.
    raise exception 'invalid_table' using errcode = '22023';
  end if;
  select string_agg(format('%I', k.col), ', ' order by k.n) into v_order
  from unnest(v_keys) with ordinality as k(col, n);

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(exported) order by %1$s), ''[]''::jsonb)
     from (select * from %2$I.%3$I order by %1$s offset $1 limit $2) exported',
    v_order, v_schema, v_table)
  into v_rows
  using p_offset, p_limit;
  return v_rows;
end;
$$;

-- Registro de una copia. Valida antes de insertar para responder siempre
-- invalid_backup; el mensaje de error se recorta a 500 caracteres para que
-- registrar un fallo no falle.
create function public.admin_control_log_backup(
  p_kind text,
  p_path text,
  p_size_bytes bigint,
  p_sha256 text,
  p_table_rows jsonb,
  p_status text,
  p_error text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_path text := nullif(btrim(p_path), '');
  v_sha256 text := nullif(lower(btrim(p_sha256)), '');
  v_rows jsonb := coalesce(p_table_rows, '{}'::jsonb);
  v_id bigint;
begin
  perform private.require_control_or_job();
  if p_kind is null or p_kind not in ('scheduled', 'manual')
     or p_status is null or p_status not in ('ok', 'error')
     or char_length(v_path) > 300
     or p_size_bytes < 0
     or v_sha256 !~ '^[0-9a-f]{64}$'
     or jsonb_typeof(v_rows) <> 'object'
     or octet_length(v_rows::text) > 20000
     or (p_status = 'ok' and p_size_bytes is null)
     or (p_status = 'ok' and p_kind = 'scheduled' and v_path is null) then
    raise exception 'invalid_backup' using errcode = '22023';
  end if;

  insert into internal.control_backups (
    kind, path, size_bytes, sha256, table_rows, status, error, actor_id
  ) values (
    p_kind, v_path, p_size_bytes, v_sha256, v_rows, p_status,
    left(nullif(btrim(p_error), ''), 500), (select auth.uid())
  )
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'control.backup_logged', 'control_backup', v_id::text,
          jsonb_build_object('kind', p_kind, 'status', p_status));
  return v_id;
end;
$$;

-- Copias registradas, de la más reciente a la más antigua.
create function public.admin_control_backups(p_limit integer default 90)
returns table (
  id bigint,
  created_at timestamptz,
  kind text,
  path text,
  size_bytes bigint,
  sha256 text,
  table_rows jsonb,
  status text,
  error text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception 'invalid_limit' using errcode = '22023';
  end if;
  return query
    select b.id, b.created_at, b.kind, b.path, b.size_bytes, b.sha256, b.table_rows,
           b.status, b.error
    from internal.control_backups b
    order by b.created_at desc, b.id desc
    limit p_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Estado del sistema
-- ---------------------------------------------------------------------------

-- Solo recuentos y tamaños: ningún email, token ni dato de cuenta. Las tablas
-- opcionales (historial de migraciones de Supabase y visitas) se leen con SQL
-- dinámico solo si existen; si no, su clave vale null. El nombre sale de
-- to_regclass (ya calificado y entre comillas si hace falta), así plpgsql_check
-- no exige la tabla en una base donde aún no exista.
create function public.admin_control_system_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Europe/Madrid')::date;
  v_migrations_table regclass := to_regclass('supabase_migrations.schema_migrations');
  v_attention_table regclass := to_regclass('internal.product_attention_daily');
  v_migrations jsonb;
  v_attention bigint;
begin
  perform private.require_business_control();

  if v_migrations_table is not null then
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''version'', m.version, ''name'', m.name)
                                 order by m.version), ''[]''::jsonb)
       from %s m',
      v_migrations_table)
    into v_migrations;
  end if;

  -- Visitas de los últimos 30 días de Madrid, hoy incluido.
  if v_attention_table is not null then
    execute format(
      'select coalesce(sum(a.hits), 0)::bigint
       from %s a
       where a.day > $1 - 30 and a.day <= $1',
      v_attention_table)
    into v_attention
    using v_today;
  end if;

  return jsonb_build_object(
    'generated_at', now(),
    'database', jsonb_build_object(
      'size_bytes', pg_catalog.pg_database_size(pg_catalog.current_database())
    ),
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'schema', t.schemaname,
               'name', t.relname,
               'rows', t.n_live_tup,
               'total_bytes', t.total_bytes
             ) order by t.total_bytes desc, t.schemaname, t.relname), '[]'::jsonb)
      from (
        select s.schemaname, s.relname, s.n_live_tup,
               pg_catalog.pg_total_relation_size(s.relid) as total_bytes
        from pg_catalog.pg_stat_all_tables s
        where s.schemaname in ('public', 'internal', 'private')
      ) t
    ),
    'migrations', v_migrations,
    'auth', (
      select jsonb_build_object(
        'users', count(*),
        'confirmed', count(*) filter (where u.email_confirmed_at is not null),
        'with_totp', (
          select count(distinct f.user_id)
          from auth.mfa_factors f
          join auth.users fu on fu.id = f.user_id and fu.deleted_at is null
          where f.factor_type = 'totp' and f.status = 'verified'
        )
      )
      from auth.users u
      where u.deleted_at is null
    ),
    'storage', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'bucket', b.id,
               'objects', coalesce(o.objects, 0),
               'bytes', coalesce(o.bytes, 0)
             ) order by b.id), '[]'::jsonb)
      from storage.buckets b
      left join (
        select ob.bucket_id,
               count(*) as objects,
               sum(case when ob.metadata ->> 'size' ~ '^[0-9]{1,18}$'
                        then (ob.metadata ->> 'size')::bigint end) as bytes
        from storage.objects ob
        group by ob.bucket_id
      ) o on o.bucket_id = b.id
    ),
    'daily_report', (
      select jsonb_build_object(
        'report_date', r.report_date,
        'generated_at', r.generated_at,
        'by_cron', r.generated_by is null,
        'has_summary', r.summary is not null
      )
      from public.daily_reports r
      order by r.report_date desc, r.generated_at desc
      limit 1
    ),
    'newsletter', (
      select jsonb_build_object(
        'active', count(*) filter (where n.unsubscribed_at is null),
        'unsubscribed', count(*) filter (where n.unsubscribed_at is not null),
        'pending_sender', count(*) filter (
          where n.unsubscribed_at is null and n.sender_synced_at is null)
      )
      from public.newsletter_subscribers n
    ),
    'last_backup', (
      select jsonb_build_object(
        'created_at', b.created_at,
        'kind', b.kind,
        'status', b.status,
        'size_bytes', b.size_bytes
      )
      from internal.control_backups b
      order by b.created_at desc, b.id desc
      limit 1
    ),
    'attention_30d', v_attention
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Uso del asistente
-- ---------------------------------------------------------------------------

-- Consultas y tokens por día de Madrid, persona, tipo y modelo en
-- [p_from, p_to). La persona es su nombre visible o la etiqueta de su rol,
-- nunca el email; sin usuario, la tarea programada (resumen diario) o una
-- cuenta ya borrada.
create function public.admin_control_assistant_usage(p_from date, p_to date)
returns table (
  day date,
  user_id uuid,
  person text,
  kind text,
  model text,
  calls integer,
  input_tokens bigint,
  output_tokens bigint,
  cache_read_tokens bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  if p_from is null or p_to is null or p_from >= p_to or p_to > p_from + 400 then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  return query
    select x.d, x.uid,
           case
             when x.uid is null and x.k = 'daily_summary' then 'Tarea programada'
             when x.uid is null then 'Cuenta eliminada'
             else coalesce(
               nullif(btrim(s.display_name), ''),
               case s.role
                 when 'system_admin' then 'Administrador del sistema'
                 when 'store_admin' then 'Administrador de la tienda'
                 when 'viewer' then 'Encargado'
               end,
               'Sin ficha de personal')
           end,
           x.k, x.m, x.calls, x.input_tokens, x.output_tokens, x.cache_read_tokens
    from (
      select (u.created_at at time zone 'Europe/Madrid')::date as d,
             u.user_id as uid, u.kind as k, u.model as m,
             count(*)::integer as calls,
             sum(u.input_tokens)::bigint as input_tokens,
             sum(u.output_tokens)::bigint as output_tokens,
             sum(u.cache_read_tokens)::bigint as cache_read_tokens
      from public.assistant_usage u
      where u.created_at >= (p_from::timestamp at time zone 'Europe/Madrid')
        and u.created_at < (p_to::timestamp at time zone 'Europe/Madrid')
      group by 1, 2, 3, 4
    ) x
    left join public.staff_members s on s.user_id = x.uid
    order by x.d, x.uid nulls first, x.k, x.m;
end;
$$;

-- ---------------------------------------------------------------------------
-- Calidad de datos
-- ---------------------------------------------------------------------------

-- Incidencias del catálogo y del stock, una fila por perfume o formato
-- afectado. severity: 'high', 'medium' o 'low' (la consola la traduce).
-- label: «Marca · Perfume» o «Marca · Perfume · formato» (etiqueta escrita a
-- mano o «100 ml», como en la tienda); detail: el dato concreto.
--   variant_without_price  (high)   formato activo de un perfume publicado sin PVP
--   variant_without_cost   (medium) formato activo de un perfume no archivado sin
--                                   ningún coste registrado
--   product_without_image  (high)   publicado sin ninguna imagen (la principal es la
--                                   «hero» o, si no hay, la primera por posición)
--   provisional_image      (low)    publicado con la imagen principal provisional
--   product_without_scent  (low)    publicado sin perfil olfativo o con el perfil vacío
--   missing_translation    (medium) publicado sin texto en algún idioma (es, ca, en):
--                                   sin fila o con frase y descripción vacías
--   stock_mismatch         (high)   existencias (o reservas) de una ubicación distintas
--                                   de la suma de sus movimientos
--   draft_with_stock       (medium) formato de un borrador con existencias
--   variant_without_sku    (low)    formato activo de un perfume publicado sin SKU
--   duplicate_ean          (medium) EAN repetido en varios formatos
--   source_to_review       (low)    perfume no archivado con «por revisar» en su
--                                   procedencia (source_ref)
create function public.admin_control_data_quality()
returns table (
  check_key text,
  severity text,
  product_id uuid,
  variant_id uuid,
  label text,
  detail text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  return query
    with prod as (
      select p.id as pid, p.status, p.source_ref, b.name || ' · ' || p.name as plabel
      from public.products p
      join public.brands b on b.id = p.brand_id
    ),
    var as (
      select v.id as vid, v.product_id as pid, v.active, v.sku,
             nullif(btrim(v.ean), '') as ean, v.retail_price_cents as price, x.status,
             x.plabel || ' · ' || coalesce(nullif(btrim(v.label), ''), v.size_ml || ' ml', '—')
               as vlabel
      from public.product_variants v
      join prod x on x.pid = v.product_id
    ),
    main_media as (
      select distinct on (m.product_id) m.product_id as pid, m.provisional, m.origin
      from public.product_media m
      order by m.product_id, (m.role = 'hero') desc, m.position, m.created_at, m.id
    ),
    ledger as (
      select coalesce(l.variant_id, mv.variant_id) as vid,
             coalesce(l.location_id, mv.location_id) as lid,
             coalesce(l.on_hand, 0)::bigint as on_hand,
             coalesce(l.reserved, 0)::bigint as reserved,
             coalesce(mv.on_hand, 0)::bigint as moved_on_hand,
             coalesce(mv.reserved, 0)::bigint as moved_reserved
      from public.inventory_levels l
      full join (
        select m.variant_id, m.location_id,
               sum(m.delta_on_hand) as on_hand, sum(m.delta_reserved) as reserved
        from public.inventory_movements m
        group by m.variant_id, m.location_id
      ) mv on mv.variant_id = l.variant_id and mv.location_id = l.location_id
    ),
    found as (
      select 'variant_without_price'::text as k, 'high'::text as s, v.pid, v.vid,
             v.vlabel as lbl, 'Formato activo sin PVP'::text as d
      from var v
      where v.status = 'published' and v.active and v.price is null
      union all
      select 'variant_without_cost', 'medium', v.pid, v.vid, v.vlabel,
             'Sin ningún coste registrado'
      from var v
      where v.status <> 'archived' and v.active
        and not exists (
          select 1 from internal.variant_cost_records c where c.variant_id = v.vid)
      union all
      select 'product_without_image', 'high', p.pid, null, p.plabel, 'Sin ninguna imagen'
      from prod p
      where p.status = 'published'
        and not exists (select 1 from main_media mm where mm.pid = p.pid)
      union all
      select 'provisional_image', 'low', p.pid, null, p.plabel,
             'Imagen principal provisional: ' || case mm.origin
               when 'own_photo' then 'foto propia'
               when 'catalog_pdf' then 'catálogo PDF'
               when 'brand_official' then 'imagen oficial de la marca'
               when 'generated_draft' then 'borrador generado'
               else mm.origin
             end
      from prod p
      join main_media mm on mm.pid = p.pid
      where p.status = 'published' and mm.provisional
      union all
      select 'product_without_scent', 'low', p.pid, null, p.plabel,
             case when sp.product_id is null then 'Sin perfil olfativo'
                  else 'Perfil olfativo sin notas ni familias' end
      from prod p
      left join public.product_scent_profiles sp on sp.product_id = p.pid
      where p.status = 'published'
        and (sp.product_id is null
             or cardinality(sp.top_notes) + cardinality(sp.heart_notes)
                + cardinality(sp.base_notes) + cardinality(sp.key_notes)
                + cardinality(sp.families) = 0)
      union all
      select 'missing_translation', 'medium', p.pid, null, p.plabel,
             'Falta el texto en: ' || string_agg(loc.code, ', ' order by loc.n)
      from prod p
      cross join unnest(array['es', 'ca', 'en']) with ordinality as loc(code, n)
      where p.status = 'published'
        and not exists (
          select 1 from public.product_translations t
          where t.product_id = p.pid and t.locale = loc.code
            and (nullif(btrim(t.tagline), '') is not null
                 or nullif(btrim(t.description), '') is not null))
      group by p.pid, p.plabel
      union all
      select 'stock_mismatch', 'high', v.pid, v.vid, v.vlabel,
             format('%s: %s en existencias y %s según los movimientos',
                    sl.name, g.on_hand, g.moved_on_hand)
             || case when g.reserved <> g.moved_reserved
                     then format('; %s reservadas y %s según los movimientos',
                                 g.reserved, g.moved_reserved)
                     else '' end
      from ledger g
      join var v on v.vid = g.vid
      join public.stock_locations sl on sl.id = g.lid
      where g.on_hand <> g.moved_on_hand or g.reserved <> g.moved_reserved
      union all
      select 'draft_with_stock', 'medium', v.pid, v.vid, v.vlabel,
             format('%s uds en existencias', st.units)
      from var v
      join (
        select l.variant_id, sum(l.on_hand)::bigint as units
        from public.inventory_levels l
        group by l.variant_id
      ) st on st.variant_id = v.vid
      where v.status = 'draft' and st.units > 0
      union all
      select 'variant_without_sku', 'low', v.pid, v.vid, v.vlabel, 'Formato activo sin SKU'
      from var v
      where v.status = 'published' and v.active and nullif(btrim(v.sku), '') is null
      union all
      select 'duplicate_ean', 'medium', e.pid, e.vid, e.vlabel,
             format('EAN %s en %s formatos', e.ean, e.copies)
      from (
        select v.pid, v.vid, v.vlabel, v.ean, count(*) over (partition by v.ean) as copies
        from var v
        where v.ean is not null
      ) e
      where e.copies > 1
      union all
      select 'source_to_review', 'low', p.pid, null, p.plabel, left(p.source_ref, 300)
      from prod p
      where p.status <> 'archived' and p.source_ref ilike '%por revisar%'
    )
    select f.k, f.s, f.pid, f.vid, f.lbl, f.d
    from found f
    order by case f.s when 'high' then 1 when 'medium' then 2 else 3 end,
             f.k, f.lbl, f.vid nulls first, f.d;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------------

-- Auxiliares de las funciones security definer: nadie las llama directamente.
revoke execute on function
  private.require_control_or_job(),
  private.control_export_tables(),
  private.primary_key_columns(regclass)
  from public, anon, authenticated, service_role;

revoke execute on function
  public.admin_control_export_catalog(),
  public.admin_control_export(text, text, integer, integer),
  public.admin_control_log_backup(text, text, bigint, text, jsonb, text, text),
  public.admin_control_backups(integer),
  public.admin_control_system_status(),
  public.admin_control_assistant_usage(date, date),
  public.admin_control_data_quality()
  from public, anon;
grant execute on function
  public.admin_control_export_catalog(),
  public.admin_control_export(text, text, integer, integer),
  public.admin_control_log_backup(text, text, bigint, text, jsonb, text, text),
  public.admin_control_backups(integer),
  public.admin_control_system_status(),
  public.admin_control_assistant_usage(date, date),
  public.admin_control_data_quality()
  to authenticated;
-- La copia diaria: lista, exporta y registra con la clave privilegiada.
grant execute on function
  public.admin_control_export_catalog(),
  public.admin_control_export(text, text, integer, integer),
  public.admin_control_log_backup(text, text, bigint, text, jsonb, text, text)
  to service_role;
