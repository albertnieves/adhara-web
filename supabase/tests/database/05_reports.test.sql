-- Informes: permisos por rol, cuadre de existencias de un periodo, coste a
-- una fecha (o posterior, marcado), costes ocultos sin permiso y plazo real
-- de los proveedores. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000031', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000032', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000033', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000034', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000031', 'system_admin'),
  ('00000000-0000-4000-8000-000000000032', 'store_admin'),
  ('00000000-0000-4000-8000-000000000033', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000003b1', 'marca-informes', 'Marca de informes');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000003a1', '00000000-0000-4000-8000-0000000003b1',
   'perfume-informes', 'Perfume de informes');
insert into public.product_variants (id, product_id, size_ml) values
  ('00000000-0000-4000-8000-0000000003c1', '00000000-0000-4000-8000-0000000003a1', 100),
  ('00000000-0000-4000-8000-0000000003c2', '00000000-0000-4000-8000-0000000003a1', 50);

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
grant execute on function pg_temp.location_id() to authenticated, anon;

-- Historial de c1 (fechas de la tienda): +10 el 10/09, −3 el 20/09; en octubre
-- −2 venta, −1 merma, +1 recuento. De c2: +4 el 15/09. Costes de c1: 10,00 €
-- desde el 01/09 y 12,00 € desde el 03/10; de c2 solo desde el 03/10.
insert into public.inventory_movements (
  variant_id, location_id, type, quantity, delta_on_hand, delta_reserved,
  on_hand_after, reserved_after, reference, created_at
) values
  ('00000000-0000-4000-8000-0000000003c1', pg_temp.location_id(), 'PURCHASE_RECEIPT',
   10, 10, 0, 10, 0, 'prueba', '2026-09-10 10:00+02'),
  ('00000000-0000-4000-8000-0000000003c1', pg_temp.location_id(), 'SALE_STORE',
   3, -3, 0, 7, 0, 'prueba', '2026-09-20 10:00+02'),
  ('00000000-0000-4000-8000-0000000003c1', pg_temp.location_id(), 'SALE_STORE',
   2, -2, 0, 5, 0, 'prueba', '2026-10-05 10:00+02'),
  ('00000000-0000-4000-8000-0000000003c1', pg_temp.location_id(), 'DAMAGE_LOSS',
   1, -1, 0, 4, 0, 'prueba', '2026-10-06 10:00+02'),
  ('00000000-0000-4000-8000-0000000003c1', pg_temp.location_id(), 'STOCKTAKE_ADJUSTMENT',
   1, 1, 0, 5, 0, 'prueba', '2026-10-07 10:00+02'),
  ('00000000-0000-4000-8000-0000000003c2', pg_temp.location_id(), 'PURCHASE_RECEIPT',
   4, 4, 0, 4, 0, 'prueba', '2026-09-15 10:00+02');
insert into public.inventory_levels (variant_id, location_id, on_hand) values
  ('00000000-0000-4000-8000-0000000003c1', pg_temp.location_id(), 5),
  ('00000000-0000-4000-8000-0000000003c2', pg_temp.location_id(), 4);
insert into internal.variant_cost_records (variant_id, cost_net_cents, at) values
  ('00000000-0000-4000-8000-0000000003c1', 1000, '2026-09-01 09:00+02'),
  ('00000000-0000-4000-8000-0000000003c1', 1200, '2026-10-03 09:00+02'),
  ('00000000-0000-4000-8000-0000000003c2', 800, '2026-10-03 09:00+02');

-- Un proveedor con un pedido enviado el 05/09 y recibido el 10/09 (5 días).
insert into internal.suppliers (id, name, lead_time_days) values
  ('00000000-0000-4000-8000-0000000003d1', 'Proveedor informes', 3);
insert into internal.purchase_orders (id, number, supplier_id, location_id, status, ordered_at)
values ('00000000-0000-4000-8000-0000000003e1', 'PC-PRUEBA-1',
        '00000000-0000-4000-8000-0000000003d1', pg_temp.location_id(), 'received',
        '2026-09-05 10:00+02');
insert into internal.purchase_order_lines (order_id, variant_id, quantity_ordered,
  quantity_received, unit_cost_net_cents)
values ('00000000-0000-4000-8000-0000000003e1', '00000000-0000-4000-8000-0000000003c1',
        10, 10, 1000);
insert into internal.purchase_receipts (order_id, request_id, units, at)
values ('00000000-0000-4000-8000-0000000003e1', gen_random_uuid(), 10, '2026-09-10 10:00+02');
insert into internal.purchase_receipt_lines (receipt_id, line_id, quantity, movement_id)
select r.id, pl.id, 10, m.id
from internal.purchase_receipts r, internal.purchase_order_lines pl, public.inventory_movements m
where r.order_id = '00000000-0000-4000-8000-0000000003e1'
  and pl.order_id = '00000000-0000-4000-8000-0000000003e1'
  and m.variant_id = '00000000-0000-4000-8000-0000000003c1' and m.type = 'PURCHASE_RECEIPT';

create function pg_temp.october(variant text) returns record
language sql as $$
  select (r.opening_units, r.received_units, r.sold_units, r.returned_units,
          r.lost_units, r.adjusted_units, r.transferred_units, r.closing_units)
  from public.admin_report_inventory_period(pg_temp.location_id(),
    '2026-10-01 00:00+02', '2026-11-01 00:00+01') r
  where r.variant_id = variant::uuid;
$$;
grant execute on function pg_temp.october(text) to authenticated;

-- Permisos
set local role anon;
select throws_ok(
  $$select * from public.admin_report_inventory_period(pg_temp.location_id(), now() - interval '1 day', now())$$,
  '42501', null, 'anon no ejecuta informes');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000034', 'aal2');
select throws_ok(
  $$select * from public.admin_report_inventory_period(pg_temp.location_id(), now() - interval '1 day', now())$$,
  '42501', 'forbidden', 'un cliente no ve informes');
select pg_temp.act_as('00000000-0000-4000-8000-000000000033', 'aal2');
select throws_ok(
  $$select * from public.admin_report_inventory_period(pg_temp.location_id(), now() - interval '1 day', now())$$,
  '42501', 'forbidden', 'el encargado no ve informes');
select throws_ok(
  $$select * from public.admin_report_purchases(now() - interval '1 day', now())$$,
  '42501', 'forbidden', 'el encargado no ve compras por proveedor');

-- Cuadre del periodo
select pg_temp.act_as('00000000-0000-4000-8000-000000000032', 'aal1');
select is(
  pg_temp.october('00000000-0000-4000-8000-0000000003c1')::text,
  '(7,0,2,0,1,1,0,5)',
  'octubre: 7 iniciales, 2 vendidas, 1 merma, +1 de recuento, 5 finales');
select is(
  (select count(*)::int from public.admin_report_inventory_period(pg_temp.location_id(),
     '2026-10-01 00:00+02', '2026-11-01 00:00+01') r
   where r.opening_units + r.received_units - r.sold_units + r.returned_units
         - r.lost_units + r.adjusted_units - r.transferred_units <> r.closing_units),
  0, 'iniciales + movimientos = finales en todos los formatos');
select is(
  (select r.closing_units from public.admin_report_inventory_period(pg_temp.location_id(),
     '2026-10-01 00:00+02', '2100-01-01 00:00+01') r
   where r.variant_id = '00000000-0000-4000-8000-0000000003c1'),
  (select on_hand from public.inventory_levels
   where variant_id = '00000000-0000-4000-8000-0000000003c1'),
  'sin fecha de fin, las finales coinciden con el nivel');
select is(
  (select row(r.opening_units, r.received_units, r.sold_units, r.closing_units)::text
   from public.admin_report_inventory_period(pg_temp.location_id(),
     '2026-09-01 00:00+02', '2026-10-01 00:00+02') r
   where r.variant_id = '00000000-0000-4000-8000-0000000003c1'),
  '(0,10,3,7)', 'septiembre: 10 recibidas, 3 vendidas, 7 finales');
select is(
  (select r.last_sale_at from public.admin_report_inventory_period(pg_temp.location_id(),
     '2026-09-01 00:00+02', '2026-10-01 00:00+02') r
   where r.variant_id = '00000000-0000-4000-8000-0000000003c1'),
  '2026-09-20 10:00+02'::timestamptz, 'la última venta no mira más allá del periodo');
select throws_ok(
  $$select * from public.admin_report_inventory_period(pg_temp.location_id(), now(), now() - interval '1 day')$$,
  '22023', 'invalid_period', 'un periodo al revés no es válido');

-- Costes
select is(
  (select row(r.opening_cost_net_cents, r.closing_cost_net_cents)::text
   from public.admin_report_inventory_period(pg_temp.location_id(),
     '2026-10-01 00:00+02', '2026-11-01 00:00+01') r
   where r.variant_id = '00000000-0000-4000-8000-0000000003c1'),
  '(,)', 'sin MFA el informe no lleva costes');
select pg_temp.act_as('00000000-0000-4000-8000-000000000032', 'aal2');
select is(
  (select row(r.opening_cost_net_cents, r.opening_cost_is_later,
              r.closing_cost_net_cents, r.closing_cost_is_later)::text
   from public.admin_report_inventory_period(pg_temp.location_id(),
     '2026-10-01 00:00+02', '2026-11-01 00:00+01') r
   where r.variant_id = '00000000-0000-4000-8000-0000000003c1'),
  '(1000,f,1200,f)', 'coste vigente al inicio y al cierre del periodo');
select is(
  (select row(r.closing_cost_net_cents, r.closing_cost_is_later)::text
   from public.admin_report_inventory_period(pg_temp.location_id(),
     '2026-09-01 00:00+02', '2026-10-01 00:00+02') r
   where r.variant_id = '00000000-0000-4000-8000-0000000003c2'),
  '(800,t)', 'sin coste a la fecha se toma el primero posterior, marcado');

-- Compras por proveedor
select pg_temp.act_as('00000000-0000-4000-8000-000000000032', 'aal1');
select throws_ok(
  $$select * from public.admin_report_purchases(now() - interval '1 day', now())$$,
  '42501', 'forbidden', 'sin MFA no se ven compras por proveedor');
select pg_temp.act_as('00000000-0000-4000-8000-000000000032', 'aal2');
select is(
  (select row(r.orders_placed, r.units_ordered, r.receipts, r.units_received,
              r.value_received_net_cents, r.units_received_without_cost)::text
   from public.admin_report_purchases('2026-09-01 00:00+02', '2026-10-01 00:00+02') r
   where r.supplier_name = 'Proveedor informes'),
  '(1,10,1,10,10000,0)', 'pedido, unidades y valor recibido del proveedor');
select is(
  (select row(r.declared_lead_time_days, r.orders_with_lead, r.avg_lead_time_days)::text
   from public.admin_report_purchases('2026-09-01 00:00+02', '2026-10-01 00:00+02') r
   where r.supplier_name = 'Proveedor informes'),
  '(3,1,5.0)', 'plazo real (5 días) frente al declarado (3)');
select is(
  (select r.orders_with_lead
   from public.admin_report_purchases('2026-10-01 00:00+02', '2026-11-01 00:00+01') r
   where r.supplier_name = 'Proveedor informes'),
  0, 'el plazo cuenta en el periodo de la primera recepción');

-- Sistema: mismos datos; las funciones no escriben nada
select pg_temp.act_as('00000000-0000-4000-8000-000000000031', 'aal2');
select lives_ok(
  $$select * from public.admin_report_inventory_period(pg_temp.location_id(),
    '2026-01-01 00:00+01', '2027-01-01 00:00+01')$$,
  'system_admin lee el año completo');
select is(
  (select count(*)::int from public.audit_log where entity in ('report', 'reports')),
  0, 'leer informes no deja rastro de escritura');

reset role;
select is(
  (select provolatile::text from pg_proc
   where proname = 'admin_report_inventory_period'),
  's', 'el informe de existencias es una función de solo lectura (stable)');
select is(
  (select provolatile::text from pg_proc where proname = 'admin_report_purchases'),
  's', 'el de compras también');
select is(
  (select count(*)::int from information_schema.role_routine_grants
   where grantee = 'anon' and routine_name like 'admin_report_%'),
  0, 'anon no tiene permiso de ejecución sobre ningún informe');

select * from finish();
rollback;
