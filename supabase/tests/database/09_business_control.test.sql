-- Control del negocio y del proyecto: solo el administrador del sistema con
-- MFA, tablas de internal fuera de la API, precio cobrado en el mostrador y
-- hechos del mes. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(36);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000091', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000092', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000093', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000094', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000091', 'system_admin'),
  ('00000000-0000-4000-8000-000000000092', 'store_admin'),
  ('00000000-0000-4000-8000-000000000093', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000009b1', 'marca-control', 'Marca de control');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000009a1', '00000000-0000-4000-8000-0000000009b1',
   'perfume-control', 'Perfume de control');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000009c1', '00000000-0000-4000-8000-0000000009a1', 100, 4995),
  ('00000000-0000-4000-8000-0000000009c2', '00000000-0000-4000-8000-0000000009a1', 50, null);

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
create function pg_temp.month_start() returns date
language sql as $$
  select date_trunc('month', now() at time zone 'Europe/Madrid')::date;
$$;
grant execute on function pg_temp.location_id(), pg_temp.month_start()
  to authenticated, anon;

-- Permiso sembrado
select is(
  (select requires_aal2 from public.permissions where code = 'business.control'),
  true, 'business.control exige MFA');
select is(
  (select array_agg(role order by role) from public.role_permissions
   where permission = 'business.control'),
  array['system_admin'], 'solo el administrador del sistema tiene business.control');

-- anon
set local role anon;
select throws_ok('select * from public.admin_control_tasks()', '42501', null,
  'anon no lee tareas');
select throws_ok('select * from internal.control_costs', '42501', null,
  'anon no lee la tabla de costes');
reset role;

set local role authenticated;

-- Encargado, administrador de la tienda y cliente: sin acceso
select pg_temp.act_as('00000000-0000-4000-8000-000000000093', 'aal2');
select throws_ok('select * from public.admin_control_tasks()', '42501', 'forbidden',
  'el encargado no lee tareas');
select pg_temp.act_as('00000000-0000-4000-8000-000000000092', 'aal2');
select throws_ok('select * from public.admin_control_costs()', '42501', 'forbidden',
  'el administrador de la tienda no lee costes del negocio');
select throws_ok('select * from public.admin_control_deliveries()', '42501', 'forbidden',
  'ni entregas');
select throws_ok(
  $$select * from public.admin_control_month_facts(pg_temp.month_start(),
    (pg_temp.month_start() + interval '1 month')::date)$$,
  '42501', 'forbidden', 'ni los hechos del mes');
select throws_ok(
  $$select public.admin_control_save_task(null, 'Tarea', 'project', 'pending', 'normal', 'me')$$,
  '42501', 'forbidden', 'ni crea tareas');
select throws_ok('select * from internal.control_tasks', '42501', null,
  'internal no está expuesto al personal');
select pg_temp.act_as('00000000-0000-4000-8000-000000000094', 'aal2');
select throws_ok('select * from public.admin_control_deliveries()', '42501', 'forbidden',
  'un cliente no lee entregas');

-- Administrador del sistema sin MFA
select pg_temp.act_as('00000000-0000-4000-8000-000000000091', 'aal1');
select throws_ok('select * from public.admin_control_tasks()', '42501', 'forbidden',
  'sin MFA, ni el administrador del sistema');

-- Administrador del sistema con MFA: tareas
select pg_temp.act_as('00000000-0000-4000-8000-000000000091', 'aal2');
select isnt(
  public.admin_control_save_task(null, '  Pedir el TPV virtual  ', 'business', 'pending',
    'high', 'client', '2026-10-31', 'Datos del banco'),
  null, 'crea una tarea');
select is((select title from public.admin_control_tasks()), 'Pedir el TPV virtual',
  'guarda el título sin espacios sobrantes');
select is((select completed_at from public.admin_control_tasks()), null,
  'pendiente, sin fecha de cierre');
select lives_ok(
  $$select public.admin_control_set_task_status(
    (select id from public.admin_control_tasks()), 'done')$$,
  'marca la tarea como hecha');
select isnt((select completed_at from public.admin_control_tasks()), null,
  'hecha, con fecha de cierre');
select throws_ok(
  $$select public.admin_control_save_task(null, 'X', 'project', 'unknown', 'normal', 'me')$$,
  '23514', null, 'rechaza un estado que no existe');
select throws_ok(
  $$select public.admin_control_delete_task(gen_random_uuid())$$,
  '22023', 'unknown_record', 'borrar una tarea que no existe avisa');
select is(
  (select count(*)::int from public.audit_log where action like 'control.task_%'),
  2, 'cada cambio de tarea queda en la auditoría');

-- Costes
select isnt(
  public.admin_control_save_cost(null, 'Alquiler del local', 'business', 'rent', 80000,
    'monthly', '2026-01-01'),
  null, 'crea un coste mensual');
select is(
  (select ends_on from public.admin_control_costs()
   where concept = 'Alquiler del local'),
  null, 'sin fecha de fin, sigue vigente');
select lives_ok(
  $$select public.admin_control_save_cost(null, 'Alta de dominio', 'project', 'hosting', 1500,
    'once', '2026-10-01', '2027-10-01')$$,
  'crea un coste puntual');
select is(
  (select ends_on from public.admin_control_costs() where concept = 'Alta de dominio'),
  null, 'un coste puntual no guarda fecha de fin');
select throws_ok(
  $$select public.admin_control_save_cost(null, 'Negativo', 'business', 'other', -1,
    'monthly', '2026-01-01')$$,
  '23514', null, 'rechaza un importe negativo');
select is(
  (select count(*)::int from public.audit_log
   where action like 'control.cost_%' and after::text like '%80000%'),
  0, 'la auditoría no guarda importes');

-- Entregas
select isnt(
  public.admin_control_save_delivery(null, 'Checkout con tarjeta', 'planned',
    'Pago con Redsys', '2026-11-15', null, null, 120000, 'pending'),
  null, 'crea una entrega con importe');
select is(
  (select billing_status from public.admin_control_deliveries()),
  'pending', 'con su estado de facturación');

-- Precio cobrado en el mostrador
select pg_temp.act_as('00000000-0000-4000-8000-000000000092', 'aal2');
select lives_ok(
  $$select public.admin_record_variant_cost('00000000-0000-4000-8000-0000000009c1', 2000)$$,
  'coste del formato de 100 ml');
select lives_ok(
  $$select public.admin_record_inventory_movement('00000000-0000-4000-8000-0000000009c1',
    pg_temp.location_id(), 'PURCHASE_RECEIPT', 10)$$,
  'recepción de 10 unidades');
select lives_ok(
  $$select public.admin_record_inventory_movement('00000000-0000-4000-8000-0000000009c2',
    pg_temp.location_id(), 'PURCHASE_RECEIPT', 5)$$,
  'recepción de 5 unidades sin coste');
select throws_ok(
  $$select public.admin_record_store_sale(pg_temp.location_id(), 'sale',
    '[{"variant_id": "00000000-0000-4000-8000-0000000009c1", "quantity": 1,
       "unit_price_cents": 49950}]'::jsonb,
    '00000000-0000-4000-8000-0000000009f1')$$,
  '22023', 'price_above_retail', 'no se cobra por encima del PVP');
select lives_ok(
  $$select public.admin_record_store_sale(pg_temp.location_id(), 'sale',
    '[{"variant_id": "00000000-0000-4000-8000-0000000009c1", "quantity": 2},
      {"variant_id": "00000000-0000-4000-8000-0000000009c2", "quantity": 1,
       "unit_price_cents": 2500}]'::jsonb,
    '00000000-0000-4000-8000-0000000009f2', 'T-91')$$,
  'venta con el PVP y con un precio indicado');
select results_eq(
  $$select variant_id::text, unit_price_cents, retail_price_cents from public.store_sale_lines
    where variant_id in ('00000000-0000-4000-8000-0000000009c1',
                         '00000000-0000-4000-8000-0000000009c2')
    order by variant_id$$,
  $$values ('00000000-0000-4000-8000-0000000009c1', 4995, 4995),
           ('00000000-0000-4000-8000-0000000009c2', 2500, null::integer)$$,
  'cada línea guarda el precio cobrado y el PVP del momento');
select lives_ok(
  $$select public.admin_record_store_sale(pg_temp.location_id(), 'sale',
    '[{"variant_id": "00000000-0000-4000-8000-0000000009c1", "quantity": 1,
       "unit_price_cents": 3995}]'::jsonb,
    '00000000-0000-4000-8000-0000000009f3')$$,
  'venta con descuento');

-- Hechos del mes
select pg_temp.act_as('00000000-0000-4000-8000-000000000091', 'aal2');
select results_eq(
  $$select sold_units, priced_sold_units, sold_gross_cents, cogs_net_cents, uncosted_units,
           received_units, received_net_cents, uncosted_received_units, retail_price_cents
    from public.admin_control_month_facts(pg_temp.month_start(),
      (pg_temp.month_start() + interval '1 month')::date)
    where variant_id = '00000000-0000-4000-8000-0000000009c1'$$,
  $$values (3, 3, 13985::bigint, 6000::bigint, 0, 10, 20000::bigint, 0, 4995)$$,
  'ventas, coste de lo vendido y compras del formato con coste');

reset role;
select * from finish();
rollback;
