-- Garantías del criterio 9 de la Fase 1 (docs/source/FASE_1_PLAN.md §16) que
-- no cubren 01–06 con un caso concreto: superficie de anon y authenticated
-- sobre todas las tablas y funciones, borradores invisibles fuera del
-- personal, PVP sin permiso y UPDATE/DELETE en las tablas de solo inserción.
-- Datos ficticios solo de prueba; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(28);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000071', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000072', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000073', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000074', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000071', 'system_admin'),
  ('00000000-0000-4000-8000-000000000072', 'store_admin'),
  ('00000000-0000-4000-8000-000000000073', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000000b7', 'marca-garantias', 'Marca de garantías');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000000a7', '00000000-0000-4000-8000-0000000000b7',
   'perfume-garantias', 'Perfume de garantías'),
  ('00000000-0000-4000-8000-0000000000a8', '00000000-0000-4000-8000-0000000000b7',
   'borrador-garantias', 'Borrador de garantías');
insert into public.product_translations (product_id, locale, tagline) values
  ('00000000-0000-4000-8000-0000000000a7', 'es', 'Publicado'),
  ('00000000-0000-4000-8000-0000000000a8', 'es', 'Borrador');
insert into public.product_variants (id, product_id, size_ml, active) values
  ('00000000-0000-4000-8000-0000000000c7', '00000000-0000-4000-8000-0000000000a7', 100, true),
  ('00000000-0000-4000-8000-0000000000c8', '00000000-0000-4000-8000-0000000000a8', 50, true),
  ('00000000-0000-4000-8000-0000000000c9', '00000000-0000-4000-8000-0000000000a8', 30, false);

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
grant execute on function pg_temp.location_id() to authenticated;

-- Superficie de la API: toda tabla pública con RLS, ninguna función admin_*
-- ejecutable por anon y ninguna escritura directa de anon.
select is_empty(
  $$select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not c.relrowsecurity$$,
  'todas las tablas públicas tienen RLS');
select cmp_ok(
  (select count(*)::int from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'admin\_%'),
  '>=', 40, 'hay funciones admin_* que comprobar');
select is_empty(
  $$select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%'
      and has_function_privilege('anon', p.oid, 'execute')$$,
  'anon no ejecuta ninguna función admin_*');
select is_empty(
  $$select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_table_privilege('anon', c.oid, 'insert,update,delete,truncate')$$,
  'anon no escribe en ninguna tabla pública');
select is_empty(
  $$select c.relname from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, 'truncate')$$,
  'authenticated no vacía ninguna tabla pública');
select is_empty(
  $$select r || ' ' || n.nspname || '.' || c.relname
    from unnest(array['anon', 'authenticated']) r
    cross join pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('internal', 'private') and c.relkind in ('r', 'p', 'v', 'm')
      and has_table_privilege(r, c.oid, 'select,insert,update,delete,truncate')$$,
  'ni anon ni authenticated tienen privilegios en tablas de internal o private');
select ok(not has_schema_privilege('anon', 'private', 'usage'),
  'anon no usa el esquema private');

set local role anon;
select throws_ok(
  $$select * from public.admin_variant_price_history(
    '00000000-0000-4000-8000-0000000000c7')$$,
  '42501', null, 'anon no consulta el historial de PVP');
select throws_ok(
  $$update public.product_variants set retail_price_cents = 1
    where id = '00000000-0000-4000-8000-0000000000c7'$$,
  '42501', null, 'anon no cambia el PVP');
reset role;

-- PVP: sin permiso no cambia, ni con MFA ni siendo administrador sin aal2.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000072', 'aal2');
select lives_ok(
  $$update public.product_variants set retail_price_cents = 4990
    where id = '00000000-0000-4000-8000-0000000000c7'$$,
  'store_admin con MFA fija el PVP');
select pg_temp.act_as('00000000-0000-4000-8000-000000000073', 'aal2');
select is_empty(
  $$update public.product_variants set retail_price_cents = 1
    where id = '00000000-0000-4000-8000-0000000000c7' returning id$$,
  'el encargado con MFA no cambia el PVP');
select pg_temp.act_as('00000000-0000-4000-8000-000000000074', 'aal2');
select is_empty(
  $$update public.product_variants set retail_price_cents = 1
    where id = '00000000-0000-4000-8000-0000000000c7' returning id$$,
  'un usuario sin personal no cambia el PVP');
select pg_temp.act_as('00000000-0000-4000-8000-000000000071', 'aal1');
select is_empty(
  $$update public.product_variants set retail_price_cents = 1
    where id = '00000000-0000-4000-8000-0000000000c7' returning id$$,
  'sin MFA ni el administrador del sistema cambia el PVP');
reset role;
select is(
  (select retail_price_cents from public.product_variants
   where id = '00000000-0000-4000-8000-0000000000c7'),
  4990, 'el PVP sigue siendo el fijado con permiso');
select is(
  (select count(*)::int from internal.price_change_log
   where variant_id = '00000000-0000-4000-8000-0000000000c7'),
  1, 'solo el cambio permitido queda en el historial');

-- Publicación: exige un formato activo con PVP, también al administrador.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000072', 'aal2');
update public.product_variants set retail_price_cents = 2990
  where id = '00000000-0000-4000-8000-0000000000c9';
select pg_temp.act_as('00000000-0000-4000-8000-000000000071', 'aal2');
select throws_ok(
  $$update public.products set status = 'published'
    where id = '00000000-0000-4000-8000-0000000000a8'$$,
  '23514', 'publish_requires_priced_variant',
  'un PVP en un formato inactivo no basta para publicar');
select pg_temp.act_as('00000000-0000-4000-8000-000000000073', 'aal2');
select is_empty(
  $$update public.products set status = 'published'
    where id = '00000000-0000-4000-8000-0000000000a7' returning id$$,
  'el encargado no publica');
select pg_temp.act_as('00000000-0000-4000-8000-000000000072', 'aal2');
select lives_ok(
  $$update public.products set status = 'published'
    where id = '00000000-0000-4000-8000-0000000000a7'$$,
  'store_admin con MFA publica un perfume con PVP');

-- Borradores: invisibles para anon y para usuarios sin personal.
select pg_temp.act_as('00000000-0000-4000-8000-000000000074', 'aal2');
select is(
  (select array_agg(slug order by slug) from public.products
   where brand_id = '00000000-0000-4000-8000-0000000000b7'),
  array['perfume-garantias'], 'un usuario sin personal no ve borradores');
select is_empty(
  $$select 1 from public.product_variants
    where product_id = '00000000-0000-4000-8000-0000000000a8'$$,
  'un usuario sin personal no ve formatos de borradores');
reset role;
set local role anon;
select is_empty(
  $$select 1 from public.product_translations
    where product_id = '00000000-0000-4000-8000-0000000000a8'$$,
  'anon no ve textos de borradores');
select is(
  (select count(*)::int from public.product_translations
   where product_id = '00000000-0000-4000-8000-0000000000a7'),
  1, 'anon ve los textos del publicado');
reset role;

-- Solo inserción: UPDATE y DELETE fallan incluso para el propietario.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000072', 'aal2');
select public.admin_record_variant_cost(
  '00000000-0000-4000-8000-0000000000c7', 1840, 'Albarán de prueba');
select public.admin_record_inventory_movement(
  '00000000-0000-4000-8000-0000000000c7', pg_temp.location_id(),
  'PURCHASE_RECEIPT', 5);
reset role;
select ok(
  (select count(*) from internal.variant_cost_records
   where variant_id = '00000000-0000-4000-8000-0000000000c7') = 1
  and (select count(*) from public.inventory_movements
       where variant_id = '00000000-0000-4000-8000-0000000000c7') = 1
  and exists (select 1 from public.audit_log),
  'hay filas de solo inserción que intentar cambiar');
select throws_ok('update public.audit_log set action = action', '42501', null,
  'nadie modifica la auditoría');
select throws_ok('update internal.price_change_log set new_price_cents = 0',
  '42501', null, 'nadie modifica el historial de PVP');
select throws_ok('delete from internal.price_change_log', '42501', null,
  'nadie borra el historial de PVP');
select throws_ok('delete from internal.variant_cost_records', '42501', null,
  'nadie borra el historial de costes');
select throws_ok('delete from public.inventory_movements', '42501', null,
  'nadie borra movimientos de stock');

select * from finish();
rollback;
