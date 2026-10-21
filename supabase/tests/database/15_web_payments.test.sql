-- Pago con tarjeta (PLAN_PEDIDOS_WEB, P04): la página de vuelta del banco lee
-- el estado del pedido con web_order_status, solo con la clave privilegiada y
-- sin datos personales. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(13);

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000015b1', 'marca-pagos', 'Marca de pagos');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000015a1', '00000000-0000-4000-8000-0000000015b1',
   'perfume-pagos', 'Perfume de pagos');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000015c1', '00000000-0000-4000-8000-0000000015a1', 100, 6500);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000015a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000015c1', id, 5
from public.stock_locations where code = 'castelldefels';

-- ---------------------------------------------------------------------------
-- Solo el servidor
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.web_order_status(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.web_order_status(uuid)', 'execute'),
  'ni la tienda anónima ni el personal llaman a web_order_status');
select ok(
  has_function_privilege('service_role', 'public.web_order_status(uuid)', 'execute'),
  'el servidor sí');

set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

create temp table pago on commit drop as
select public.web_order_create(
  '00000000-0000-4000-8000-0000000015d1', 'ca', 'click_collect', null,
  jsonb_build_array(jsonb_build_object(
    'variant_id', '00000000-0000-4000-8000-0000000015c1', 'quantity', 2)),
  jsonb_build_object('full_name', 'Clienta de pagos', 'email', 'pagos@test.invalid'),
  'redsys', 30) as summary;

select is(public.web_order_status('00000000-0000-4000-8000-0000000015ff'), null,
  'un pedido que no existe: null');

select is(
  (select array(select jsonb_object_keys(
     public.web_order_status((summary ->> 'order_id')::uuid)) order by 1)
   from pago),
  array['currency', 'discount_cents', 'discount_code', 'fulfillment', 'items_cents',
        'locale', 'number', 'order_id', 'paid_at', 'payable', 'reservation',
        'reserved_until', 'shipping_cents', 'status', 'total_cents'],
  'solo estado e importes: sin nombre, email, teléfono ni dirección');

select is(
  (select public.web_order_status((summary ->> 'order_id')::uuid)
          - 'order_id' - 'number' - 'reserved_until' from pago),
  jsonb_build_object(
    'status', 'pending_payment', 'fulfillment', 'click_collect', 'locale', 'ca',
    'items_cents', 13000, 'shipping_cents', 0, 'total_cents', 13000,
    'discount_code', null, 'discount_cents', 0,
    'currency', 'EUR', 'reservation', 'active', 'paid_at', null, 'payable', true),
  'recién creado: pendiente, con la reserva y pagable');

select ok(
  (select position('pagos@test.invalid' in
     public.web_order_status((summary ->> 'order_id')::uuid)::text) = 0 from pago),
  'el email del cliente no aparece');

-- Un pago rechazado no cambia nada: se puede volver a intentar.
select is(
  (select public.web_order_record_payment('redsys', summary ->> 'payment_reference',
     (summary ->> 'payment_reference') || '/r0190', 'declined', 13000, 'EUR') ->> 'action'
   from pago),
  'ignore', 'pago denegado: sin efecto');
select is(
  (select public.web_order_status((summary ->> 'order_id')::uuid) ->> 'payable' from pago),
  'true', 'tras un pago denegado sigue pagable');

-- Reintento: referencia nueva y el mismo importe.
create temp table reintento on commit drop as
select public.web_order_new_attempt((summary ->> 'order_id')::uuid, 'redsys') as summary
from pago;
select isnt(
  (select summary ->> 'payment_reference' from reintento),
  (select summary ->> 'payment_reference' from pago),
  'el reintento lleva otra referencia (el banco no repite números de pedido)');

-- Cobro correcto del reintento: pagado y ya no pagable.
select is(
  (select public.web_order_record_payment('redsys', r.summary ->> 'payment_reference',
     (r.summary ->> 'payment_reference') || '/123456', 'succeeded', 13000, 'EUR') ->> 'action'
   from reintento r),
  'confirm', 'el cobro del reintento confirma el pedido');
select is(
  (select jsonb_build_array(s -> 'status', s -> 'payable')
   from pago, public.web_order_status((summary ->> 'order_id')::uuid) as s),
  '["paid", false]'::jsonb,
  'pagado: ya no se puede volver a pagar');
select ok(
  (select (public.web_order_status((summary ->> 'order_id')::uuid) ->> 'paid_at') is not null
   from pago),
  'con la fecha del pago');

-- Caducada sin pagar: no pagable.
create temp table caducado on commit drop as
select public.web_order_create(
  '00000000-0000-4000-8000-0000000015d2', 'es', 'click_collect', null,
  jsonb_build_array(jsonb_build_object(
    'variant_id', '00000000-0000-4000-8000-0000000015c1', 'quantity', 1)),
  jsonb_build_object('full_name', 'Otra clienta', 'email', 'otra@test.invalid'),
  'redsys', 30) as summary;
reset role;
update public.orders set reserved_until = now() - interval '1 minute'
where id = (select (summary ->> 'order_id')::uuid from caducado);
set local role service_role;
select is(
  (select public.web_order_status((summary ->> 'order_id')::uuid) ->> 'payable'
   from caducado),
  'false', 'con la reserva vencida ya no se paga aunque siga pendiente');
reset role;

select * from finish();
rollback;
