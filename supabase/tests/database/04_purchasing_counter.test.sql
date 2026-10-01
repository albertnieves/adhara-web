-- Proveedores, pedidos de compra, mostrador y vigilante: permisos por rol y
-- MFA, aislamiento de internal, recepción parcial sin pasarse, idempotencia y
-- ventas todo o nada. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(54);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000021', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000022', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000023', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000024', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000021', 'system_admin'),
  ('00000000-0000-4000-8000-000000000022', 'store_admin'),
  ('00000000-0000-4000-8000-000000000023', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000002b1', 'marca-compras', 'Marca de compras');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000002a1', '00000000-0000-4000-8000-0000000002b1',
   'perfume-compras', 'Perfume de compras');
insert into public.product_variants (id, product_id, size_ml) values
  ('00000000-0000-4000-8000-0000000002c1', '00000000-0000-4000-8000-0000000002a1', 100),
  ('00000000-0000-4000-8000-0000000002c2', '00000000-0000-4000-8000-0000000002a1', 50);

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

-- Lecturas de control que no dependen del rol activo.
create function pg_temp.on_hand(variant uuid) returns integer
language sql security definer as $$
  select coalesce((select on_hand from public.inventory_levels
                   where variant_id = variant and location_id = pg_temp.location_id()), 0);
$$;
create function pg_temp.order_status(supplier text) returns text
language sql security definer as $$
  select o.status from internal.purchase_orders o
  join internal.suppliers s on s.id = o.supplier_id where s.name = supplier;
$$;
create function pg_temp.order_id(supplier text) returns uuid
language sql security definer as $$
  select o.id from internal.purchase_orders o
  join internal.suppliers s on s.id = o.supplier_id where s.name = supplier;
$$;
create function pg_temp.order_revision(supplier text) returns integer
language sql security definer as $$
  select o.revision from internal.purchase_orders o
  join internal.suppliers s on s.id = o.supplier_id where s.name = supplier;
$$;
create function pg_temp.supplier_id(supplier text) returns uuid
language sql security definer as $$
  select id from internal.suppliers where name = supplier;
$$;
create function pg_temp.line_id(supplier text, variant uuid) returns bigint
language sql security definer as $$
  select pl.id from internal.purchase_order_lines pl
  join internal.purchase_orders o on o.id = pl.order_id
  join internal.suppliers s on s.id = o.supplier_id
  where s.name = supplier and pl.variant_id = variant;
$$;
grant execute on function pg_temp.on_hand(uuid), pg_temp.order_status(text),
  pg_temp.order_id(text), pg_temp.order_revision(text), pg_temp.supplier_id(text),
  pg_temp.line_id(text, uuid)
  to authenticated, anon;

-- Stock inicial del formato c1: 4 uds (carga como postgres, como un dato).
insert into public.inventory_levels (variant_id, location_id, on_hand)
values ('00000000-0000-4000-8000-0000000002c1', pg_temp.location_id(), 4);
insert into public.inventory_movements (
  variant_id, location_id, type, quantity, delta_on_hand, delta_reserved,
  on_hand_after, reserved_after, reference
) values (
  '00000000-0000-4000-8000-0000000002c1', pg_temp.location_id(), 'PURCHASE_RECEIPT',
  4, 4, 0, 4, 0, 'carga-prueba'
);

-- Proveedores: quién puede
set local role anon;
select throws_ok($$select * from public.admin_list_suppliers()$$, '42501', null,
  'anon no ejecuta funciones de compras');
select throws_ok($$select * from public.admin_stock_watch_facts(pg_temp.location_id())$$,
  '42501', null, 'anon no ejecuta el vigilante');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000024', 'aal2');
select throws_ok($$select * from public.admin_list_suppliers()$$, '42501', 'forbidden',
  'un cliente no ve proveedores');
select pg_temp.act_as('00000000-0000-4000-8000-000000000023', 'aal2');
select throws_ok($$select * from public.admin_list_suppliers()$$, '42501', 'forbidden',
  'el encargado no ve proveedores');
select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal1');
select throws_ok(
  $$select public.admin_save_supplier(null, 'Proveedor A')$$, '42501', 'forbidden',
  'sin MFA no se da de alta un proveedor');
select throws_ok($$select * from internal.suppliers$$, '42501', null,
  'internal no es accesible con la sesión');

select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal2');
select lives_ok(
  $$select public.admin_save_supplier(null, 'Proveedor A', 'Ana', 'ana@test.invalid',
    null, 10)$$,
  'store_admin con MFA da de alta un proveedor');
select throws_ok(
  $$select public.admin_save_supplier(null, '  proveedor a ')$$, '23505', null,
  'el nombre del proveedor no se repite (sin distinguir mayúsculas)');
select lives_ok(
  $$select public.admin_save_supplier(null, 'Proveedor B', p_lead_time_days => 3)$$,
  'segundo proveedor');
select lives_ok(
  $$select public.admin_save_supplier_variant(pg_temp.supplier_id('Proveedor A'),
    '00000000-0000-4000-8000-0000000002c1', 'REF-A1', 6, null, true)$$,
  'condiciones de compra por formato');
select lives_ok(
  $$select public.admin_save_supplier_variant(pg_temp.supplier_id('Proveedor B'),
    '00000000-0000-4000-8000-0000000002c1', null, 1, null, true)$$,
  'otro proveedor preferente para el mismo formato');
select is(
  (select array_agg(supplier_name order by supplier_name)
   from public.admin_supplier_terms(null, array['00000000-0000-4000-8000-0000000002c1'::uuid])
   where preferred),
  array['Proveedor B'], 'solo queda un proveedor preferente por formato');
select is(
  public.admin_assign_supplier_brand(pg_temp.supplier_id('Proveedor A'),
    '00000000-0000-4000-8000-0000000002b1', true),
  1, 'asignar por marca añade solo los formatos que faltaban');
select is(
  (select preferred from public.admin_supplier_terms(pg_temp.supplier_id('Proveedor A'),
     array['00000000-0000-4000-8000-0000000002c2'::uuid])),
  true, 'y los marca como preferentes si no tenían otro');
select lives_ok(
  $$select public.admin_save_supplier_variant(pg_temp.supplier_id('Proveedor A'),
    '00000000-0000-4000-8000-0000000002c1', 'REF-A1', 6, null, true)$$,
  'Proveedor A vuelve a ser el preferente de c1');

-- Vigilante: el encargado lee datos agregados, sin proveedores ni costes
select pg_temp.act_as('00000000-0000-4000-8000-000000000023', 'aal1');
select is(
  (select row(lead_time_days, pack_size, has_supplier, ledger_on_hand)::text
   from public.admin_stock_watch_facts(pg_temp.location_id())
   where variant_id = '00000000-0000-4000-8000-0000000002c1'),
  row(10, 6, true, 4)::text,
  'el encargado ve plazo, múltiplo y movimientos del proveedor preferente');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public'
     and (column_name ~ '(supplier_name|cost)' )
     and table_name in ('store_sales', 'store_sale_lines', 'stock_watch_settings')),
  0, 'las tablas públicas nuevas no tienen proveedores ni costes');
select is(
  (select sales_window_days from public.stock_watch_settings),
  30, 'el encargado lee los parámetros del vigilante');
select throws_ok(
  $$select public.admin_set_stock_watch_settings(60, 30, 7, 120)$$, '42501', 'forbidden',
  'el encargado no cambia los parámetros');
select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal2');
select throws_ok(
  $$select public.admin_set_stock_watch_settings(60, 30, 7, 120)$$, '42501', 'forbidden',
  'store_admin no cambia la configuración');
select pg_temp.act_as('00000000-0000-4000-8000-000000000021', 'aal2');
select lives_ok(
  $$select public.admin_set_stock_watch_settings(60, 30, 7, 120)$$,
  'system_admin con MFA cambia los parámetros');

-- Pedido de compra
select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal2');
select lives_ok(
  $$select public.admin_create_purchase_order(pg_temp.supplier_id('Proveedor A'),
    pg_temp.location_id(),
    '[{"variant_id": "00000000-0000-4000-8000-0000000002c1", "quantity": 5,
       "unit_cost_net_cents": 1234}]'::jsonb)$$,
  'store_admin crea un pedido con líneas');
select ok(
  (select number from public.admin_list_purchase_orders() where supplier_name = 'Proveedor A')
    ~ '^PC-[0-9]{4}-[0-9]{4}$',
  'el pedido recibe un número legible');
select is(
  (select unit_cost_net_cents from public.admin_purchase_order_lines(pg_temp.order_id('Proveedor A'))),
  1234, 'quien ve costes ve el coste de la línea');
select throws_ok(
  $$select public.admin_set_purchase_order_lines(pg_temp.order_id('Proveedor A'),
    pg_temp.order_revision('Proveedor A') - 1, '[]'::jsonb)$$,
  '55000', 'stale_revision', 'una revisión antigua no sobrescribe el pedido');
select throws_ok(
  $$select public.admin_set_purchase_order_lines(pg_temp.order_id('Proveedor A'),
    pg_temp.order_revision('Proveedor A'),
    '[{"variant_id": "00000000-0000-4000-8000-0000000002c1", "quantity": 1},
      {"variant_id": "00000000-0000-4000-8000-0000000002c1", "quantity": 2}]'::jsonb)$$,
  '22023', 'invalid_items', 'no se repite un formato en el pedido');
select throws_ok(
  $$select public.admin_transition_purchase_order(pg_temp.order_id('Proveedor A'),
    pg_temp.order_revision('Proveedor A'), 'close')$$,
  '55000', 'invalid_status', 'un borrador no se cierra');
select is(
  public.admin_transition_purchase_order(pg_temp.order_id('Proveedor A'),
    pg_temp.order_revision('Proveedor A'), 'order'),
  'ordered', 'el borrador pasa a pedido');
select throws_ok(
  $$select public.admin_set_purchase_order_lines(pg_temp.order_id('Proveedor A'),
    pg_temp.order_revision('Proveedor A'), '[]'::jsonb)$$,
  '55000', 'invalid_status', 'las líneas de un pedido enviado no cambian');
select throws_ok(
  $$select public.admin_delete_purchase_order(pg_temp.order_id('Proveedor A'),
    pg_temp.order_revision('Proveedor A'))$$,
  '55000', 'invalid_status', 'un pedido enviado no se borra');

select pg_temp.act_as('00000000-0000-4000-8000-000000000023', 'aal2');
select throws_ok(
  $$select * from public.admin_purchase_order_lines(pg_temp.order_id('Proveedor A'))$$,
  '42501', 'forbidden', 'el encargado no ve pedidos');
select is(
  (select incoming_units from public.admin_stock_watch_facts(pg_temp.location_id())
   where variant_id = '00000000-0000-4000-8000-0000000002c1'),
  5, 'lo pedido cuenta como pendiente de recibir');

-- Recepción
select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal2');
select lives_ok(
  format($$select public.admin_receive_purchase_order(%L,
    '00000000-0000-4000-8000-0000000000e1',
    jsonb_build_array(jsonb_build_object('line_id', %s, 'quantity', 3)), 'ALB-1', true)$$,
    pg_temp.order_id('Proveedor A'),
    pg_temp.line_id('Proveedor A', '00000000-0000-4000-8000-0000000002c1')),
  'recepción parcial');
select is(pg_temp.on_hand('00000000-0000-4000-8000-0000000002c1'), 7,
  'la recepción suma stock');
select is(pg_temp.order_status('Proveedor A'), 'partially_received',
  'el pedido queda parcialmente recibido');
select lives_ok(
  format($$select public.admin_receive_purchase_order(%L,
    '00000000-0000-4000-8000-0000000000e1',
    jsonb_build_array(jsonb_build_object('line_id', %s, 'quantity', 3)), 'ALB-1', true)$$,
    pg_temp.order_id('Proveedor A'),
    pg_temp.line_id('Proveedor A', '00000000-0000-4000-8000-0000000002c1')),
  'repetir la misma recepción no falla');
select is(pg_temp.on_hand('00000000-0000-4000-8000-0000000002c1'), 7,
  'y no vuelve a sumar stock');
select throws_ok(
  format($$select public.admin_receive_purchase_order(%L,
    '00000000-0000-4000-8000-0000000000e2',
    jsonb_build_array(jsonb_build_object('line_id', %s, 'quantity', 3)))$$,
    pg_temp.order_id('Proveedor A'),
    pg_temp.line_id('Proveedor A', '00000000-0000-4000-8000-0000000002c1')),
  '23514', 'over_receipt', 'no se recibe más de lo pedido');
select is(
  (select cost_net_cents from public.admin_variant_costs(
    array['00000000-0000-4000-8000-0000000002c1'::uuid])),
  1234, 'el coste del pedido pasa a ser el vigente');
select lives_ok(
  format($$select public.admin_receive_purchase_order(%L,
    '00000000-0000-4000-8000-0000000000e3',
    jsonb_build_array(jsonb_build_object('line_id', %s, 'quantity', 2)))$$,
    pg_temp.order_id('Proveedor A'),
    pg_temp.line_id('Proveedor A', '00000000-0000-4000-8000-0000000002c1')),
  'recepción del resto');
select is(pg_temp.order_status('Proveedor A'), 'received',
  'recibido todo, el pedido queda recibido');
select is(
  (select count(*)::int from public.inventory_movements
   where variant_id = '00000000-0000-4000-8000-0000000002c1'
     and type = 'PURCHASE_RECEIPT' and reference like 'PC-%'),
  2, 'cada recepción deja su movimiento con el número del pedido');

-- Mostrador
select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal1');
select throws_ok(
  $$select public.admin_record_store_sale(pg_temp.location_id(), 'sale',
    '[{"variant_id": "00000000-0000-4000-8000-0000000002c1", "quantity": 1}]'::jsonb,
    '00000000-0000-4000-8000-0000000000f1')$$,
  '42501', 'forbidden', 'sin MFA no se vende en mostrador');
select pg_temp.act_as('00000000-0000-4000-8000-000000000022', 'aal2');
select throws_ok(
  $$select public.admin_record_store_sale(pg_temp.location_id(), 'sale',
    '[{"variant_id": "00000000-0000-4000-8000-0000000002c1", "quantity": 2},
      {"variant_id": "00000000-0000-4000-8000-0000000002c2", "quantity": 1}]'::jsonb,
    '00000000-0000-4000-8000-0000000000f1', 'T-1')$$,
  '23514', 'insufficient_stock', 'una línea sin stock detiene la venta');
select is(pg_temp.on_hand('00000000-0000-4000-8000-0000000002c1'), 9,
  'y no descuenta ninguna línea (todo o nada)');
select lives_ok(
  $$select public.admin_record_store_sale(pg_temp.location_id(), 'sale',
    '[{"variant_id": "00000000-0000-4000-8000-0000000002c1", "quantity": 2}]'::jsonb,
    '00000000-0000-4000-8000-0000000000f2', 'T-2')$$,
  'venta en mostrador');
select lives_ok(
  $$select public.admin_record_store_sale(pg_temp.location_id(), 'sale',
    '[{"variant_id": "00000000-0000-4000-8000-0000000002c1", "quantity": 2}]'::jsonb,
    '00000000-0000-4000-8000-0000000000f2', 'T-2')$$,
  'repetir la misma venta no falla');
select is(pg_temp.on_hand('00000000-0000-4000-8000-0000000002c1'), 7,
  'y descuenta una sola vez');
select throws_ok(
  $$insert into public.store_sales (request_id, location_id, kind, units)
    values (gen_random_uuid(), pg_temp.location_id(), 'sale', 1)$$,
  '42501', null, 'nadie escribe ventas de mostrador directamente');

select pg_temp.act_as('00000000-0000-4000-8000-000000000023', 'aal2');
select is((select count(*)::int from public.store_sales), 1,
  'el encargado lee las ventas de mostrador');
select is(
  (select units_sold from public.admin_stock_watch_facts(pg_temp.location_id())
   where variant_id = '00000000-0000-4000-8000-0000000002c1'),
  2, 'el vigilante cuenta las ventas de mostrador');
select pg_temp.act_as('00000000-0000-4000-8000-000000000024', 'aal2');
select is((select count(*)::int from public.store_sales), 0,
  'un cliente no ve ventas de mostrador');

-- El nivel sigue cuadrando con la suma de movimientos
reset role;
select is(
  (select count(*)::int
   from public.inventory_levels l
   where l.on_hand <> coalesce((
     select sum(m.delta_on_hand) from public.inventory_movements m
     where m.variant_id = l.variant_id and m.location_id = l.location_id), 0)),
  0, 'on_hand coincide con la suma de movimientos');
select throws_ok(
  $$update internal.purchase_receipts set units = 99$$,
  '42501', null, 'las recepciones son de solo inserción');

select * from finish();
rollback;
