-- Autorización del personal: RLS, aal2 y auditoría de solo inserción.
-- Usuarios ficticios solo de prueba; la transacción se revierte al final.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000001', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000002', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000003', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000004', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000001', 'system_admin'),
  ('00000000-0000-4000-8000-000000000002', 'store_admin'),
  ('00000000-0000-4000-8000-000000000003', 'viewer');

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;

-- Matriz sembrada
select is((select count(*)::int from public.role_permissions where role = 'system_admin'),
  (select count(*)::int from public.permissions), 'system_admin tiene todos los permisos');
select is((select count(*)::int from public.role_permissions where role = 'viewer'), 4,
  'viewer tiene 4 permisos de lectura');

-- anon
set local role anon;
select throws_ok('select * from public.staff_members', '42501', null, 'anon no lee personal');
select throws_ok('select * from public.audit_log', '42501', null, 'anon no lee auditoría');
select throws_ok($$select public.record_audit_event('x', 'y')$$, '42501', null,
  'anon no escribe auditoría');
reset role;

-- Usuario autenticado sin fila de personal (futuro cliente)
select pg_temp.act_as('00000000-0000-4000-8000-000000000004', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.staff_members), 0, 'cliente no ve personal');
select is((select count(*)::int from public.permissions), 0, 'cliente no ve permisos');
select is(private.has_permission('orders.view'), false, 'cliente sin permisos');
select throws_ok($$select public.record_audit_event('x', 'y')$$, '42501', null,
  'cliente no escribe auditoría');
reset role;

-- Encargado (viewer)
select pg_temp.act_as('00000000-0000-4000-8000-000000000003', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.staff_members), 1, 'viewer solo ve su ficha');
select is(private.has_permission('orders.view'), true, 'viewer lee pedidos');
select is(private.has_permission('customers.view'), false, 'viewer no ve clientes');
select throws_ok(
  $$insert into public.staff_members (user_id, role)
    values ('00000000-0000-4000-8000-000000000004', 'system_admin')$$,
  '42501', null, 'viewer no da de alta personal');
reset role;

-- Administrador de la tienda
select pg_temp.act_as('00000000-0000-4000-8000-000000000002', 'aal1');
set local role authenticated;
select is(private.has_permission('pricing.view_cost'), false, 'store_admin sin MFA no ve costes');
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-000000000002', 'aal2');
set local role authenticated;
select is(private.has_permission('pricing.view_cost'), true, 'store_admin con MFA ve costes');
select is(private.has_permission('staff.manage'), false, 'store_admin no gestiona personal');
select is((select count(*)::int from public.audit_log), 0, 'store_admin no consulta auditoría');
reset role;

-- Administrador del sistema
select pg_temp.act_as('00000000-0000-4000-8000-000000000001', 'aal1');
set local role authenticated;
select is(private.has_permission('staff.manage'), false, 'system_admin sin MFA no gestiona personal');
reset role;
select pg_temp.act_as('00000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;
select is((select count(*)::int from public.staff_members), 3, 'system_admin ve todo el personal');
select lives_ok($$select public.record_audit_event('staff.review', 'staff_members')$$,
  'el personal registra auditoría');
select is((select actor_id::text from public.audit_log order by id desc limit 1),
  '00000000-0000-4000-8000-000000000001', 'el actor es la sesión');
reset role;

-- Solo inserción, incluso para el propietario de la base de datos
select throws_ok('delete from public.audit_log', '42501', null,
  'nadie borra la auditoría');

select * from finish();
rollback;
