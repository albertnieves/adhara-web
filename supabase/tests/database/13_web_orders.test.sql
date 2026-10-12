-- Pedidos de la web (PLAN_PEDIDOS_WEB, P02): solo el servidor crea pedidos y
-- registra cobros; reserva todo o nada con el precio del catálogo; decisión
-- ante cada notificación igual que planCardPaymentConfirmation; caducidad;
-- lectura por permiso (el contacto exige customers.view) y transiciones del
-- personal con su efecto de inventario. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(79);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000131', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000132', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000133', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000134', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000131', 'system_admin'),
  ('00000000-0000-4000-8000-000000000132', 'store_admin'),
  ('00000000-0000-4000-8000-000000000133', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000013b1', 'marca-pedidos', 'Marca de pedidos');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000013a1', '00000000-0000-4000-8000-0000000013b1',
   'perfume-pedidos', 'Perfume de pedidos'),
  ('00000000-0000-4000-8000-0000000013a2', '00000000-0000-4000-8000-0000000013b1',
   'borrador-pedidos', 'Borrador de pedidos');
insert into public.product_variants (id, product_id, sku, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000013c1', '00000000-0000-4000-8000-0000000013a1', 'PED-100', 100, 4995),
  ('00000000-0000-4000-8000-0000000013c2', '00000000-0000-4000-8000-0000000013a1', 'PED-50', 50, 2990),
  ('00000000-0000-4000-8000-0000000013c3', '00000000-0000-4000-8000-0000000013a1', 'PED-30', 30, null),
  ('00000000-0000-4000-8000-0000000013c4', '00000000-0000-4000-8000-0000000013a2', 'BOR-100', 100, 1500);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000013a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select v.id, l.id, v.on_hand
from (values ('00000000-0000-4000-8000-0000000013c1'::uuid, 10),
             ('00000000-0000-4000-8000-0000000013c2'::uuid, 5)) v(id, on_hand)
cross join public.stock_locations l where l.code = 'castelldefels';

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
-- Pedido de recogida con un contacto válido; p_request identifica el pedido.
create function pg_temp.create_order(
  p_request uuid,
  p_items jsonb,
  p_fulfillment text default 'click_collect',
  p_contact jsonb default '{"full_name": " Cliente de prueba ", "email": " Cliente@Test.INVALID ", "phone": "+34 600 000 000"}'
) returns jsonb
language sql as $$
  select public.web_order_create(p_request, 'es', p_fulfillment, pg_temp.location_id(),
                                 p_items, p_contact, 'redsys', 30);
$$;
create function pg_temp.order_id(p_request uuid) returns uuid
language sql as $$
  select id from public.orders where request_id = p_request;
$$;
create function pg_temp.ref(p_request uuid) returns text
language sql as $$
  select a.reference from public.order_payment_attempts a
  join public.orders o on o.id = a.order_id
  where o.request_id = p_request order by a.created_at desc limit 1;
$$;
create function pg_temp.rev(p_request uuid) returns integer
language sql as $$
  select revision from public.orders where request_id = p_request;
$$;
create function pg_temp.pay(p_request uuid, p_tx text, p_outcome text, p_amount integer,
                            p_currency text default 'EUR') returns jsonb
language sql as $$
  select public.web_order_record_payment('redsys', pg_temp.ref(p_request), p_tx, p_outcome,
                                         p_amount, p_currency);
$$;
create function pg_temp.level(p_variant uuid) returns text
language sql as $$
  select on_hand || '/' || reserved from public.inventory_levels
  where variant_id = p_variant and location_id = pg_temp.location_id();
$$;
grant execute on function pg_temp.location_id(), pg_temp.order_id(uuid), pg_temp.ref(uuid),
  pg_temp.rev(uuid), pg_temp.level(uuid),
  pg_temp.create_order(uuid, jsonb, text, jsonb),
  pg_temp.pay(uuid, text, text, integer, text)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Superficie: web_order_* solo para el servidor
-- ---------------------------------------------------------------------------

select is_empty(
  $$select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'web\_order\_%'
      and (has_function_privilege('anon', p.oid, 'execute')
           or has_function_privilege('authenticated', p.oid, 'execute')
           or not has_function_privilege('service_role', p.oid, 'execute'))$$,
  'solo service_role ejecuta las funciones web_order_*');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'web\_order\_%'),
  4, 'hay cuatro funciones del servidor');
select is_empty(
  $$select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('order_transition', 'apply_order_movement', 'apply_order_inventory',
                        'new_payment_attempt', 'web_order_summary')
      and (has_function_privilege('authenticated', p.oid, 'execute')
           or has_function_privilege('service_role', p.oid, 'execute'))$$,
  'nadie llama directamente a los auxiliares privados');

set local role anon;
select throws_ok('select * from public.orders', '42501', null, 'anon no lee pedidos');
select throws_ok('select * from public.order_contacts', '42501', null,
  'anon no lee contactos');
select throws_ok(
  $$select pg_temp.create_order('00000000-0000-4000-8000-0000000013d9',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c1", "quantity": 1}]')$$,
  '42501', null, 'anon no crea pedidos');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000131', 'aal2');
select throws_ok(
  $$select pg_temp.create_order('00000000-0000-4000-8000-0000000013d9',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c1", "quantity": 1}]')$$,
  '42501', null, 'ni el administrador del sistema crea pedidos desde la API');
select throws_ok(
  $$select public.web_order_record_payment('redsys', '000000000000', 'tx', 'succeeded', 1, 'EUR')$$,
  '42501', null, 'el personal no registra cobros');
select throws_ok('select public.web_order_release_expired()', '42501', null,
  'el personal no libera reservas');
reset role;

-- ---------------------------------------------------------------------------
-- Creación (servidor)
-- ---------------------------------------------------------------------------

set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select throws_ok(
  $$select pg_temp.create_order('00000000-0000-4000-8000-0000000013d9',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c1", "quantity": 1}]', 'shipping',
    '{"full_name": "Cliente", "email": "cliente@test.invalid", "phone": "600000000",
      "address_line1": "Calle de prueba 1", "postal_code": "08860", "city": "Castelldefels"}')$$,
  '22023', 'shipping_unavailable', 'sin tarifa activa no se vende con envío (P03, 14)');
select throws_ok(
  $$select pg_temp.create_order('00000000-0000-4000-8000-0000000013d9',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c1", "quantity": 1}]', 'click_collect',
    '{"full_name": "Cliente", "email": "sin-arroba"}')$$,
  '22023', 'invalid_contact', 'rechaza un email no válido');
select throws_ok(
  $$select pg_temp.create_order('00000000-0000-4000-8000-0000000013d9',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c3", "quantity": 1}]')$$,
  '22023', 'unavailable_variant', 'un formato sin PVP no se vende');
select throws_ok(
  $$select pg_temp.create_order('00000000-0000-4000-8000-0000000013d9',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c4", "quantity": 1}]')$$,
  '22023', 'unavailable_variant', 'un perfume sin publicar no se vende');
select throws_ok(
  $$select pg_temp.create_order('00000000-0000-4000-8000-0000000013d9', '[]')$$,
  '22023', 'invalid_items', 'un pedido sin líneas no se crea');
select throws_ok(
  $$select pg_temp.create_order('00000000-0000-4000-8000-0000000013d9',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c2", "quantity": 1},
      {"variant_id": "00000000-0000-4000-8000-0000000013c1", "quantity": 11}]')$$,
  '23514', 'insufficient_stock', 'sin stock suficiente no se crea ni se reserva nada');
select is(
  (select count(*)::int from public.orders), 0, 'los intentos fallidos no dejan pedidos');
select is(pg_temp.level('00000000-0000-4000-8000-0000000013c2'), '5/0',
  'ni reservas a medias');

-- A: dos de 100 ml y uno de 50 ml.
select is(
  (pg_temp.create_order('00000000-0000-4000-8000-0000000013d1',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c1", "quantity": 2},
      {"variant_id": "00000000-0000-4000-8000-0000000013c2", "quantity": 1}]') ->> 'total_cents')::int,
  12980, 'el total sale del PVP del catálogo: 2 × 49,95 + 29,90');
select is(
  pg_temp.create_order('00000000-0000-4000-8000-0000000013d1',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c1", "quantity": 9}]') ->> 'order_id',
  pg_temp.order_id('00000000-0000-4000-8000-0000000013d1')::text,
  'repetir la petición devuelve el mismo pedido');
-- B, C y D: uno de 50 ml, uno de 100 ml y uno de 50 ml con un precio inventado.
select pg_temp.create_order('00000000-0000-4000-8000-0000000013d2',
  '[{"variant_id": "00000000-0000-4000-8000-0000000013c2", "quantity": 1}]');
select pg_temp.create_order('00000000-0000-4000-8000-0000000013d3',
  '[{"variant_id": "00000000-0000-4000-8000-0000000013c1", "quantity": 1}]');
select is(
  (pg_temp.create_order('00000000-0000-4000-8000-0000000013d4',
    '[{"variant_id": "00000000-0000-4000-8000-0000000013c2", "quantity": 1,
       "unit_price_cents": 1, "unit_cost_net_cents": 1}]') ->> 'total_cents')::int,
  2990, 'un precio enviado por el navegador no cuenta');
reset role;

select is(
  (select status || '/' || reservation || '/' || fulfillment || '/' || locale
   from public.orders where request_id = '00000000-0000-4000-8000-0000000013d1'),
  'pending_payment/active/click_collect/es', 'el pedido nace pendiente de pago y con reserva');
select ok(
  (select reserved_until > now() + interval '29 minutes'
          and reserved_until <= now() + interval '30 minutes'
   from public.orders where request_id = '00000000-0000-4000-8000-0000000013d1'),
  'la reserva caduca a los 30 minutos');
select is(pg_temp.level('00000000-0000-4000-8000-0000000013c1'), '10/3',
  'reservadas tres unidades de 100 ml (A y C), una sola vez pese al reintento');
select is(pg_temp.level('00000000-0000-4000-8000-0000000013c2'), '5/3',
  'reservadas tres unidades de 50 ml (A, B y D)');
select is(
  (select array_agg(type || ':' || quantity order by variant_id) from public.inventory_movements
   where reference = 'Pedido web ' || (select number from public.orders
                                       where request_id = '00000000-0000-4000-8000-0000000013d1')),
  array['RESERVATION:2', 'RESERVATION:1'], 'la reserva queda en el libro de movimientos');
select is(
  (select array_agg(sku || ' ' || quantity || ' × ' || unit_price_cents || ' = ' || line_total_cents
                    || ' ' || brand_name || ' ' || product_name order by sku)
   from public.order_lines where order_id = pg_temp.order_id('00000000-0000-4000-8000-0000000013d1')),
  array['PED-100 2 × 4995 = 9990 Marca de pedidos Perfume de pedidos',
        'PED-50 1 × 2990 = 2990 Marca de pedidos Perfume de pedidos'],
  'las líneas guardan la instantánea del catálogo');
select is(
  (select full_name || ' <' || email || '> ' || phone from public.order_contacts
   where order_id = pg_temp.order_id('00000000-0000-4000-8000-0000000013d1')),
  'Cliente de prueba <cliente@test.invalid> +34 600 000 000', 'el contacto se guarda normalizado');
select matches(pg_temp.ref('00000000-0000-4000-8000-0000000013d1'), '^[0-9]{12}$',
  'referencia de pago de 12 dígitos');
select is(
  (select count(*)::int from public.order_payment_attempts a
   where a.order_id = pg_temp.order_id('00000000-0000-4000-8000-0000000013d1')),
  1, 'el reintento no crea otro intento de pago');
select is(
  (select array_agg(kind order by id) from public.order_events
   where order_id = pg_temp.order_id('00000000-0000-4000-8000-0000000013d1')),
  array['created', 'payment_attempt'], 'la cronología empieza con la creación');
select ok(
  not exists (select 1 from public.order_events
              where detail::text ilike '%cliente@test.invalid%'
                 or detail::text ilike '%Cliente de prueba%'),
  'la cronología no guarda datos personales');

-- ---------------------------------------------------------------------------
-- Lectura por permiso
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000133', 'aal1');
select is((select count(*)::int from public.orders), 4, 'el encargado ve los pedidos');
select is((select count(*)::int from public.order_lines), 5, 'y sus líneas');
select is_empty('select 1 from public.order_contacts',
  'pero no los datos personales (sin customers.view)');
select throws_ok(
  $$insert into public.orders (request_id, locale, fulfillment, location_id, items_cents,
    total_cents, reserved_until)
    values (gen_random_uuid(), 'es', 'click_collect', pg_temp.location_id(), 1, 1, now())$$,
  '42501', null, 'nadie inserta pedidos directamente');
select pg_temp.act_as('00000000-0000-4000-8000-000000000132', 'aal1');
select is((select count(*)::int from public.order_contacts), 4,
  'el administrador de la tienda ve el contacto');
select throws_ok(
  $$update public.orders set status = 'paid'
    where request_id = '00000000-0000-4000-8000-0000000013d1'$$,
  '42501', null, 'ni cambia el estado sin pasar por la función');
select pg_temp.act_as('00000000-0000-4000-8000-000000000134', 'aal2');
select is_empty('select 1 from public.orders', 'un usuario sin personal no ve pedidos');
select is_empty('select 1 from public.order_payments', 'ni cobros');
reset role;

-- ---------------------------------------------------------------------------
-- Cobros (servidor): misma decisión que planCardPaymentConfirmation
-- ---------------------------------------------------------------------------

set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select is(
  public.web_order_record_payment('redsys', pg_temp.ref('00000000-0000-4000-8000-0000000013d1'),
                                  'tx-a1', 'succeeded', 0, 'EUR') ->> 'reason',
  'invalid_data', 'un importe no positivo se rechaza sin registrar nada');
select is(
  public.web_order_record_payment('redsys', '999999999999', 'tx-x', 'succeeded', 12980, 'EUR')
    ->> 'reason',
  'wrong_payment', 'una referencia desconocida se rechaza');
select is(
  public.web_order_record_payment('otro_tpv', pg_temp.ref('00000000-0000-4000-8000-0000000013d1'),
                                  'tx-x', 'succeeded', 12980, 'EUR') ->> 'reason',
  'wrong_payment', 'la referencia es de otro proveedor');
select is(
  pg_temp.pay('00000000-0000-4000-8000-0000000013d1', 'tx-a0', 'declined', 12980) ->> 'reason',
  'not_paid', 'un rechazo no confirma');
select is(
  pg_temp.pay('00000000-0000-4000-8000-0000000013d1', 'tx-a1', 'succeeded', 12980) ->> 'action',
  'confirm', 'el cobro correcto confirma el pedido');
select is(
  pg_temp.pay('00000000-0000-4000-8000-0000000013d1', 'tx-a1', 'succeeded', 12980) ->> 'reason',
  'already_recorded', 'repetir la notificación no tiene efectos');
select is(
  pg_temp.pay('00000000-0000-4000-8000-0000000013d1', 'tx-a0', 'declined', 12980) ->> 'reason',
  'already_recorded', 'tampoco repetir un rechazo antiguo');
select is(
  pg_temp.pay('00000000-0000-4000-8000-0000000013d1', 'tx-a2', 'succeeded', 12980) ->> 'reason',
  'additional_payment', 'un segundo cobro distinto queda como incidencia');
-- B: importe alterado.
select is(
  pg_temp.pay('00000000-0000-4000-8000-0000000013d2', 'tx-b1', 'succeeded', 299) ->> 'reason',
  'amount_mismatch', 'un importe distinto va a revisión');
reset role;

select is(
  (select status || '/' || reservation || '/' || received_transaction_id || '/' || (paid_at is not null)
   from public.orders where request_id = '00000000-0000-4000-8000-0000000013d1'),
  'paid/committed/tx-a1/true', 'A pagado, con la reserva comprometida');
select is(
  (select array_agg(outcome || ':' || decision || ':' || coalesce(reason, '-') order by id)
   from public.order_payments
   where order_id = pg_temp.order_id('00000000-0000-4000-8000-0000000013d1')),
  array['declined:ignore:not_paid', 'succeeded:confirm:-', 'succeeded:review:additional_payment'],
  'cada notificación se guarda una vez');
select is(
  (select count(*)::int from public.order_events
   where order_id = pg_temp.order_id('00000000-0000-4000-8000-0000000013d1')
     and kind = 'payment_confirmed'),
  1, 'una sola confirmación en la cronología');
select is(pg_temp.level('00000000-0000-4000-8000-0000000013c1'), '10/3',
  'pagar no mueve el stock: la reserva sigue retenida hasta la entrega');
select is(
  (select status || '/' || reservation || '/' || received_transaction_id
   from public.orders where request_id = '00000000-0000-4000-8000-0000000013d2'),
  'needs_attention/active/tx-b1', 'B queda en incidencias, con su reserva');

-- ---------------------------------------------------------------------------
-- Caducidad y pago tardío
-- ---------------------------------------------------------------------------

update public.orders set reserved_until = now() - interval '1 minute'
  where request_id in ('00000000-0000-4000-8000-0000000013d2',
                       '00000000-0000-4000-8000-0000000013d3');
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select is(public.web_order_release_expired(), 1,
  'libera solo la reserva caducada pendiente de pago (C), no la de B en incidencias');
select is(public.web_order_release_expired(), 0, 'una segunda pasada no libera nada');
select throws_ok(
  $$select public.web_order_new_attempt(pg_temp.order_id('00000000-0000-4000-8000-0000000013d3'), 'redsys')$$,
  '55000', 'order_not_payable', 'sin reserva no se vuelve al banco');
select public.web_order_new_attempt(
  pg_temp.order_id('00000000-0000-4000-8000-0000000013d4'), 'redsys');
select is(
  (select count(distinct reference)::int from public.order_payment_attempts
   where order_id = pg_temp.order_id('00000000-0000-4000-8000-0000000013d4')),
  2, 'con la reserva en pie, D vuelve al banco con una referencia nueva');
select is(
  pg_temp.pay('00000000-0000-4000-8000-0000000013d3', 'tx-c1', 'succeeded', 4995) ->> 'reason',
  'reservation_unavailable', 'el pago tardío va a revisión, no a pagado');
reset role;

select is(pg_temp.level('00000000-0000-4000-8000-0000000013c1'), '10/2',
  'la unidad de C vuelve a estar disponible');
select is(
  (select status || '/' || reservation from public.orders
   where request_id = '00000000-0000-4000-8000-0000000013d3'),
  'needs_attention/released', 'C queda en incidencias sin reserva');

-- ---------------------------------------------------------------------------
-- Transiciones del personal
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000133', 'aal2');
select throws_ok(
  $$select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'processing', pg_temp.rev('00000000-0000-4000-8000-0000000013d1'))$$,
  '42501', 'forbidden', 'el encargado no prepara pedidos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000132', 'aal1');
select throws_ok(
  $$select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'processing', pg_temp.rev('00000000-0000-4000-8000-0000000013d1'))$$,
  '42501', 'forbidden', 'preparar exige MFA');
select pg_temp.act_as('00000000-0000-4000-8000-000000000132', 'aal2');
select throws_ok(
  $$select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'processing', 1)$$,
  '55000', 'stale_revision', 'una revisión antigua no cambia el pedido');
select throws_ok(
  $$select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d4'),
    'paid', pg_temp.rev('00000000-0000-4000-8000-0000000013d4'))$$,
  '42501', 'forbidden', 'el personal no marca un pedido como pagado');
select throws_ok(
  $$select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'completed', pg_temp.rev('00000000-0000-4000-8000-0000000013d1'))$$,
  '22023', 'invalid_transition', 'no se salta pasos');
select is(
  (public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'processing', pg_temp.rev('00000000-0000-4000-8000-0000000013d1'))).status,
  'processing', 'el administrador de la tienda con MFA prepara el pedido');
select throws_ok(
  $$select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'shipped', pg_temp.rev('00000000-0000-4000-8000-0000000013d1'))$$,
  '22023', 'wrong_fulfillment', 'un pedido de recogida no se envía');
select is(
  (public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'ready_for_pickup', pg_temp.rev('00000000-0000-4000-8000-0000000013d1'))).status,
  'ready_for_pickup', 'listo para recoger');
select is(
  (public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'completed', pg_temp.rev('00000000-0000-4000-8000-0000000013d1'))).reservation,
  'consumed', 'la entrega convierte la reserva en venta');
select throws_ok(
  $$select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d1'),
    'refunded', pg_temp.rev('00000000-0000-4000-8000-0000000013d1'))$$,
  '0A000', 'refund_unavailable', 'sin adaptador del proveedor no se marca reembolsado');
-- Incidencias: B conserva su reserva; C necesita reservar de nuevo.
select is(
  (public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d2'),
    'paid', pg_temp.rev('00000000-0000-4000-8000-0000000013d2'))).reservation,
  'committed', 'resolver B compromete su reserva');
select is(
  (public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000013d3'),
    'paid', pg_temp.rev('00000000-0000-4000-8000-0000000013d3'))).reservation,
  'committed', 'resolver C vuelve a reservar si hay stock');
reset role;

select is(pg_temp.level('00000000-0000-4000-8000-0000000013c1'), '8/1',
  '100 ml: dos vendidas por A y una reservada otra vez por C');
select is(pg_temp.level('00000000-0000-4000-8000-0000000013c2'), '4/2',
  '50 ml: una vendida por A; B y D siguen reservadas');
select is(
  (select array_agg(type || ':' || quantity order by id) from public.inventory_movements
   where reference = 'Pedido web ' || (select number from public.orders
                                       where request_id = '00000000-0000-4000-8000-0000000013d1')
     and type <> 'RESERVATION'),
  array['SALE_CLICK_COLLECT:2', 'SALE_CLICK_COLLECT:1'], 'la recogida descuenta con su tipo');
select is(
  (select array_agg(from_status || '→' || to_status order by id) from public.order_events
   where order_id = pg_temp.order_id('00000000-0000-4000-8000-0000000013d1')
     and kind = 'status_changed' and actor_id = '00000000-0000-4000-8000-000000000132'),
  array['paid→processing', 'processing→ready_for_pickup', 'ready_for_pickup→completed'],
  'la cronología guarda quién movió cada paso');
select is(
  (select count(*)::int from public.audit_log where action = 'orders.transition'),
  5, 'y la auditoría también');

-- Solo inserción
select throws_ok('update public.order_events set kind = kind', '42501', null,
  'nadie reescribe la cronología');
select throws_ok('delete from public.order_payments', '42501', null,
  'nadie borra cobros');

select * from finish();
rollback;
