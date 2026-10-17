-- Revisión de seguridad antes de cobrar (DECISIONS §158–162): la procedencia
-- de los perfumes solo la lee el personal; todo permiso del personal exige
-- MFA; el rol solo va a cuentas confirmadas y una invitación no reutiliza una
-- cuenta sin confirmar abierta por otra persona; y el freno de peticiones de
-- las acciones públicas solo lo usa el servidor. Datos ficticios; la
-- transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(27);

insert into auth.users (id, email, email_confirmed_at, invited_at) values
  ('00000000-0000-4000-8000-000000000201', 'sistema@test.invalid', now(), null),
  ('00000000-0000-4000-8000-000000000202', 'tienda@test.invalid', now(), null),
  ('00000000-0000-4000-8000-000000000203', 'encargado@test.invalid', now(), null),
  ('00000000-0000-4000-8000-000000000204', 'cliente@test.invalid', now(), null),
  -- Alta pública sin confirmar con el email de una futura persona del equipo.
  ('00000000-0000-4000-8000-000000000205', 'futura@test.invalid', null, null),
  -- Invitación enviada y aún sin aceptar.
  ('00000000-0000-4000-8000-000000000206', 'invitada@test.invalid', null, now());
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000201', 'system_admin'),
  ('00000000-0000-4000-8000-000000000202', 'store_admin'),
  ('00000000-0000-4000-8000-000000000203', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000020b1', 'marca-revision', 'Marca de la revisión');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000020a1', '00000000-0000-4000-8000-0000000020b1',
   'perfume-revision', 'Perfume de la revisión'),
  ('00000000-0000-4000-8000-0000000020a2', '00000000-0000-4000-8000-0000000020b1',
   'perfume-sin-procedencia', 'Perfume sin procedencia');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000020c1', '00000000-0000-4000-8000-0000000020a1', 100, 4995);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000020a1';
insert into public.product_sources (product_id, source_ref) values
  ('00000000-0000-4000-8000-0000000020a1', 'Compra a Proveedor Centinela (20 uds)');

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
grant execute on function pg_temp.act_as(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Procedencia solo para el personal
-- ---------------------------------------------------------------------------

select hasnt_column('public', 'products', 'source_ref',
  'products ya no lleva la procedencia (la lee cualquiera)');
select ok(
  not has_table_privilege('anon', 'public.product_sources', 'select'),
  'un visitante no puede leer product_sources');
select ok(
  not has_table_privilege('authenticated', 'public.product_sources', 'truncate'),
  'ni una sesión vaciarla');

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok('select source_ref from public.product_sources', '42501', null,
  'la API pública no da la procedencia');
select is((select count(*)::int from public.products where slug = 'perfume-revision'), 1,
  'pero sí el perfume publicado');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000204', 'aal1');
select is_empty('select 1 from public.product_sources',
  'una cuenta de cliente no ve la procedencia');
select pg_temp.act_as('00000000-0000-4000-8000-000000000204', 'aal2');
select is_empty('select 1 from public.product_sources', 'ni aunque diga aal2');
select pg_temp.act_as('00000000-0000-4000-8000-000000000203', 'aal1');
select is_empty('select 1 from public.product_sources',
  'el personal sin MFA tampoco');
select pg_temp.act_as('00000000-0000-4000-8000-000000000203', 'aal2');
select is((select source_ref from public.product_sources),
  'Compra a Proveedor Centinela (20 uds)', 'el encargado con MFA sí la lee');
select throws_ok(
  $$insert into public.product_sources (product_id, source_ref)
    values ('00000000-0000-4000-8000-0000000020a2', 'Otra fuente')$$,
  '42501', null, 'pero sin catalog.edit no la escribe');
select pg_temp.act_as('00000000-0000-4000-8000-000000000202', 'aal2');
select lives_ok(
  $$insert into public.product_sources (product_id, source_ref)
    values ('00000000-0000-4000-8000-0000000020a2', 'Ficha oficial de la marca')$$,
  'catalog.edit con MFA la da de alta');
select lives_ok(
  $$update public.product_sources set source_ref = 'Ficha oficial, revisada'
    where product_id = '00000000-0000-4000-8000-0000000020a2'$$,
  'y la cambia');
reset role;
select is(
  (select count(*)::int from public.audit_log
   where entity = 'product_sources'
     and entity_id = '00000000-0000-4000-8000-0000000020a2'),
  2, 'cada cambio de la procedencia queda en la auditoría');
select throws_ok(
  $$insert into public.product_sources (product_id, source_ref)
    values ('00000000-0000-4000-8000-0000000020a1', '   ')$$,
  '23514', null, 'una procedencia vacía no vale');
delete from public.products where id = '00000000-0000-4000-8000-0000000020a2';
select is(
  (select count(*)::int from public.product_sources
   where product_id = '00000000-0000-4000-8000-0000000020a2'),
  0, 'al borrar el perfume se borra su procedencia');

-- ---------------------------------------------------------------------------
-- 2. MFA en todos los permisos del personal
-- ---------------------------------------------------------------------------

select is_empty('select code from public.permissions where not requires_aal2',
  'todo permiso del personal exige MFA, también los de lectura');
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000202', 'aal1');
select ok(not private.has_permission('customers.view'),
  'con solo la contraseña no hay datos de clientes');
select ok(not private.has_permission('orders.view'), 'ni pedidos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000202', 'aal2');
select ok(private.has_permission('customers.view'), 'con MFA, sí');
reset role;

-- ---------------------------------------------------------------------------
-- 3. Rol del personal solo para cuentas confirmadas
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000201', 'aal2');
select throws_ok(
  $$select public.admin_grant_staff('futura@test.invalid', 'viewer', 'Futura')$$,
  '22023', 'unconfirmed_user', '«Dar acceso» no va a una cuenta sin confirmar');
select throws_ok(
  $$select public.admin_prepare_invite('futura@test.invalid', 'viewer', 'Futura')$$,
  '22023', 'unconfirmed_user',
  'ni se invita sobre un alta sin confirmar que abrió otra persona');
select lives_ok(
  $$select public.admin_prepare_invite('invitada@test.invalid', 'viewer', 'Invitada')$$,
  'reenviar una invitación pendiente sí');
select lives_ok(
  $$select public.admin_prepare_invite('nueva@test.invalid', 'viewer', 'Nueva')$$,
  'ni invitar un email sin cuenta');
select is(
  public.admin_grant_staff('cliente@test.invalid', 'viewer', 'Cliente'),
  '00000000-0000-4000-8000-000000000204'::uuid,
  'una cuenta confirmada recibe el rol');
reset role;

-- ---------------------------------------------------------------------------
-- 4. Freno de peticiones, solo del servidor
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.web_order_rate_limit(text, text, integer, integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.web_order_rate_limit(text, text, integer, integer)', 'execute'),
  'nadie más que el servidor usa el freno (nadie puede gastar el cupo de otro)');
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select is(
  array[
    public.web_order_rate_limit('prueba', repeat('a', 64), 2, 600),
    public.web_order_rate_limit('prueba', repeat('a', 64), 2, 600),
    public.web_order_rate_limit('prueba', repeat('a', 64), 2, 600),
    public.web_order_rate_limit('prueba', repeat('b', 64), 2, 600),
    public.web_order_rate_limit('otra', repeat('a', 64), 2, 600)
  ],
  array[true, true, false, true, true],
  'cuenta por acción y cliente: la tercera del mismo cliente se frena');
select throws_ok(
  $$select public.web_order_rate_limit('prueba', '192.168.1.1', 2, 600)$$,
  '22023', 'invalid_limit', 'la huella es un sha-256, nunca la IP');
reset role;

select * from finish();
rollback;
