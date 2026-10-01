-- Catálogo e inventario: visibilidad pública, PVP con aal2, publicación y
-- movimientos. Datos ficticios solo de prueba; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(33);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000011', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000012', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000013', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000014', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000011', 'system_admin'),
  ('00000000-0000-4000-8000-000000000012', 'store_admin'),
  ('00000000-0000-4000-8000-000000000013', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000000b1', 'marca-prueba', 'Marca de prueba');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000000a1', '00000000-0000-4000-8000-0000000000b1',
   'perfume-prueba', 'Perfume de prueba'),
  ('00000000-0000-4000-8000-0000000000a2', '00000000-0000-4000-8000-0000000000b1',
   'perfume-borrador', 'Borrador de prueba');
insert into public.product_variants (id, product_id, size_ml) values
  ('00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000a1', 100);

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

-- Precio y publicación
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000012', 'aal1');
select is_empty(
  $$update public.product_variants set retail_price_cents = 4990
    where id = '00000000-0000-4000-8000-0000000000c1' returning id$$,
  'sin MFA no se cambia el PVP');
select pg_temp.act_as('00000000-0000-4000-8000-000000000012', 'aal2');
select throws_ok(
  $$update public.products set status = 'published'
    where id = '00000000-0000-4000-8000-0000000000a1'$$,
  '23514', 'publish_requires_priced_variant', 'no se publica sin PVP');
select pg_temp.act_as('00000000-0000-4000-8000-000000000012', 'aal2');
select lives_ok(
  $$update public.product_variants set retail_price_cents = 4990
    where id = '00000000-0000-4000-8000-0000000000c1'$$,
  'store_admin con MFA cambia el PVP');
select throws_ok(
  $$update public.product_variants set compare_at_price_cents = 3000
    where id = '00000000-0000-4000-8000-0000000000c1'$$,
  '23514', null, 'el precio anterior debe superar al PVP');
select lives_ok(
  $$update public.products set status = 'published'
    where id = '00000000-0000-4000-8000-0000000000a1'$$,
  'store_admin publica un perfume con PVP');
select is(
  (select count(*)::int from public.admin_variant_price_history(
    '00000000-0000-4000-8000-0000000000c1')),
  1, 'el cambio de PVP queda en el historial');

select pg_temp.act_as('00000000-0000-4000-8000-000000000013', 'aal2');
select is_empty(
  $$update public.products set name = 'x'
    where id = '00000000-0000-4000-8000-0000000000a1' returning id$$,
  'viewer no modifica el catálogo');
select throws_ok(
  $$insert into public.brands (slug, name) values ('otra', 'Otra')$$,
  '42501', null, 'viewer no crea marcas');

-- Visibilidad pública
reset role;
set local role anon;
select is((select count(*)::int from public.products), 1, 'anon solo ve lo publicado');
select is((select count(*)::int from public.brands), 1,
  'anon ve la marca de un perfume publicado');
select is((select count(*)::int from public.product_variants), 1,
  'anon ve el formato activo del publicado');
select throws_ok('select * from public.inventory_levels', '42501', null,
  'anon no lee niveles de stock');
select throws_ok('select * from public.inventory_movements', '42501', null,
  'anon no lee movimientos');
select throws_ok(
  $$select public.admin_record_inventory_movement(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(),
    'PURCHASE_RECEIPT', 5)$$,
  '42501', null, 'anon no registra movimientos');
select throws_ok('select * from internal.price_change_log', '42501', null,
  'anon no alcanza el esquema internal');

-- Movimientos
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000013', 'aal2');
select throws_ok(
  $$select public.admin_record_inventory_movement(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(),
    'PURCHASE_RECEIPT', 5)$$,
  '42501', 'forbidden', 'viewer no recibe mercancía');

select pg_temp.act_as('00000000-0000-4000-8000-000000000012', 'aal2');
select is(
  (select on_hand_after from public.admin_record_inventory_movement(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(),
    'PURCHASE_RECEIPT', 5, null, 'Albarán 1')),
  5, 'recepción de 5 unidades');
select is(
  (select on_hand_after from public.admin_record_inventory_movement(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(), 'SALE_STORE', 2)),
  3, 'venta en tienda de 2');
select throws_ok(
  $$select public.admin_record_inventory_movement(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(), 'SALE_STORE', 10)$$,
  '23514', 'negative_on_hand', 'no se vende más de lo que hay');
select throws_ok(
  $$select public.admin_record_inventory_movement(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(), 'SALE_STORE', -1)$$,
  '22023', 'invalid_quantity', 'una venta no admite cantidad negativa');
select throws_ok(
  $$select public.admin_record_inventory_movement(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(),
    'MANUAL_ADJUSTMENT', -1)$$,
  '22023', 'reason_required', 'un ajuste manual exige motivo');
select throws_ok(
  $$select public.admin_record_inventory_movement(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(), 'RESERVATION', 1)$$,
  '22023', 'movement_not_manual', 'las reservas no se registran a mano');
select is(
  (select quantity from public.admin_record_stocktake(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(), 1)),
  -2, 'el recuento registra la diferencia');
select is(
  (public.admin_record_stocktake(
    '00000000-0000-4000-8000-0000000000c1', pg_temp.location_id(), 1)).id,
  null::bigint, 'un recuento que cuadra no genera movimiento');
select is(
  (select on_hand from public.inventory_levels
   where variant_id = '00000000-0000-4000-8000-0000000000c1'),
  1, 'el nivel refleja la suma de movimientos');
select is(
  (select count(*)::int from public.inventory_movements
   where variant_id = '00000000-0000-4000-8000-0000000000c1'),
  3, 'tres movimientos registrados');
select throws_ok(
  'update public.inventory_levels set on_hand = 99', '42501', null,
  'nadie escribe niveles directamente');

select pg_temp.act_as('00000000-0000-4000-8000-000000000014', 'aal2');
select is_empty('select * from public.inventory_levels',
  'un cliente no ve niveles de stock');

reset role;
select throws_ok(
  'update public.inventory_movements set quantity = 1', '42501', null,
  'movimientos de solo inserción incluso para el propietario');
select is(
  (select count(*)::int from public.audit_log where entity = 'inventory_level'),
  3, 'cada movimiento queda en la auditoría');

-- Borrar formatos: con movimientos no; con solo un nivel sin movimientos, sí.
insert into public.product_variants (id, product_id, size_ml) values
  ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000a2', 30);
insert into public.inventory_levels (variant_id, location_id, reorder_point)
values ('00000000-0000-4000-8000-0000000000c2', pg_temp.location_id(), 2);
select throws_ok(
  $$delete from public.product_variants where id = '00000000-0000-4000-8000-0000000000c1'$$,
  '23503', null, 'un formato con movimientos no se puede borrar');
select lives_ok(
  $$delete from public.product_variants where id = '00000000-0000-4000-8000-0000000000c2'$$,
  'un formato sin movimientos se borra con su nivel de stock');

set local role anon;
select is(
  (select status from public.storefront_availability(
    array['00000000-0000-4000-8000-0000000000a1'::uuid])),
  'low_stock', 'la tienda ve solo el estado de disponibilidad');

select * from finish();
rollback;
