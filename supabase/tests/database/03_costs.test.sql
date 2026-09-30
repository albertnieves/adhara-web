-- Aislamiento de costes (criterio 9 de la Fase 1): el coste vive en internal,
-- solo se lee y se escribe con permiso de costes y MFA, y nada de lo que ve
-- la tienda lo expone. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000021', 'sistema-costes@test.invalid'),
  ('00000000-0000-4000-8000-000000000022', 'tienda-costes@test.invalid'),
  ('00000000-0000-4000-8000-000000000023', 'encargado-costes@test.invalid'),
  ('00000000-0000-4000-8000-000000000024', 'cliente-costes@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000021', 'system_admin'),
  ('00000000-0000-4000-8000-000000000022', 'store_admin'),
  ('00000000-0000-4000-8000-000000000023', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000000b2', 'marca-costes', 'Marca de costes');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000000a3', '00000000-0000-4000-8000-0000000000b2',
   'perfume-costes', 'Perfume de costes');
insert into public.product_variants (id, product_id, size_ml) values
  ('00000000-0000-4000-8000-0000000000c3', '00000000-0000-4000-8000-0000000000a3', 100);

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;

-- Ningún rol de la API alcanza el esquema internal.
select ok(not has_schema_privilege('anon', 'internal', 'usage'),
  'anon no usa el esquema internal');
select ok(not has_schema_privilege('authenticated', 'internal', 'usage'),
  'authenticated no usa el esquema internal');
select is_empty(
  $$select table_name, column_name from information_schema.columns
    where table_schema = 'public' and column_name ilike '%cost%'$$,
  'ninguna tabla pública tiene columnas de coste');
select is_empty(
  $$select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
      and (p.proname ilike '%cost%'
           or pg_get_function_result(p.oid) ilike '%cost%')$$,
  'anon no ejecuta ninguna función que devuelva costes');

-- Anónimo
set local role anon;
select throws_ok('select * from internal.variant_cost_records', '42501', null,
  'anon no lee costes');
select throws_ok(
  $$select * from public.admin_variant_costs(
    array['00000000-0000-4000-8000-0000000000c3'::uuid])$$,
  '42501', null, 'anon no consulta costes');
select throws_ok(
  $$select public.admin_record_variant_cost(
    '00000000-0000-4000-8000-0000000000c3', 1840)$$,
  '42501', null, 'anon no registra costes');

-- Clientes y personal sin permiso de costes
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000024', 'aal2');
select throws_ok('select * from internal.variant_cost_records', '42501', null,
  'un cliente no lee la tabla de costes');
select throws_ok(
  $$select * from public.admin_variant_costs(
    array['00000000-0000-4000-8000-0000000000c3'::uuid])$$,
  '42501', 'forbidden', 'un cliente no consulta costes');

select pg_temp.act_as('00000000-0000-4000-8000-000000000023', 'aal2');
select throws_ok(
  $$select * from public.admin_variant_costs(
    array['00000000-0000-4000-8000-0000000000c3'::uuid])$$,
  '42501', 'forbidden', 'el encargado no ve costes');
select throws_ok(
  $$select public.admin_record_variant_cost(
    '00000000-0000-4000-8000-0000000000c3', 1840)$$,
  '42501', 'forbidden', 'el encargado no registra costes');

-- Administrador de la tienda: sin MFA no, con MFA sí.
select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal1');
select throws_ok(
  $$select * from public.admin_variant_costs(
    array['00000000-0000-4000-8000-0000000000c3'::uuid])$$,
  '42501', 'forbidden', 'sin MFA no se ven costes');
select throws_ok(
  $$select public.admin_record_variant_cost(
    '00000000-0000-4000-8000-0000000000c3', 1840)$$,
  '42501', 'forbidden', 'sin MFA no se registran costes');

select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal2');
select lives_ok(
  $$select public.admin_record_variant_cost(
    '00000000-0000-4000-8000-0000000000c3', 1840, 'Albarán de prueba')$$,
  'store_admin con MFA registra un coste');
select throws_ok(
  $$select public.admin_record_variant_cost(
    '00000000-0000-4000-8000-0000000000c3', -1)$$,
  '22023', 'invalid_amount', 'el coste no puede ser negativo');
select throws_ok(
  $$select public.admin_record_variant_cost(
    '00000000-0000-4000-8000-0000000000ff', 1840)$$,
  '22023', 'unknown_variant', 'el formato debe existir');
select lives_ok(
  $$select public.admin_record_variant_cost(
    '00000000-0000-4000-8000-0000000000c3', 1900)$$,
  'un coste nuevo se añade al historial');
select is(
  (select cost_net_cents from public.admin_variant_costs(
    array['00000000-0000-4000-8000-0000000000c3'::uuid])),
  1900, 'el coste vigente es el último registrado');
select throws_ok('select * from internal.variant_cost_records', '42501', null,
  'ni con permiso se lee la tabla directamente');

select pg_temp.act_as('00000000-0000-4000-8000-000000000021', 'aal2');
select is(
  (select count(*)::int from public.admin_variant_costs(
    array['00000000-0000-4000-8000-0000000000c3'::uuid,
          '00000000-0000-4000-8000-0000000000a3'::uuid])),
  1, 'system_admin ve un coste por formato con coste');

-- Historial y auditoría
reset role;
select is(
  (select count(*)::int from internal.variant_cost_records
   where variant_id = '00000000-0000-4000-8000-0000000000c3'),
  2, 'los dos costes quedan en el historial');
select throws_ok(
  'update internal.variant_cost_records set cost_net_cents = 0', '42501', null,
  'historial de costes de solo inserción incluso para el propietario');
select is(
  (select count(*)::int from public.audit_log
   where action = 'pricing.cost_recorded'
     and entity_id = '00000000-0000-4000-8000-0000000000c3'
     and after - 'cost_record_id' = '{}'::jsonb),
  2, 'la auditoría registra cada coste sin el importe');

-- Un borrador con coste no aparece en la tienda.
set local role anon;
select is_empty(
  $$select * from public.product_variants
    where id = '00000000-0000-4000-8000-0000000000c3'$$,
  'un borrador no es visible para anon (y nunca con coste)');

select * from finish();
rollback;
