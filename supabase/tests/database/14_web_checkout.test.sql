-- Checkout (PLAN_PEDIDOS_WEB, P03): zona por código postal (península y
-- Baleares; Canarias, Ceuta y Melilla fuera), tarifas que solo cambia
-- settings.manage con MFA, lectura pública de las activas y envío calculado
-- en la base al crear el pedido. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(36);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000141', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000142', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000143', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000144', 'cliente@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000141', 'system_admin'),
  ('00000000-0000-4000-8000-000000000142', 'store_admin'),
  ('00000000-0000-4000-8000-000000000143', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000014b1', 'marca-envios', 'Marca de envíos');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000014a1', '00000000-0000-4000-8000-0000000014b1',
   'perfume-envios', 'Perfume de envíos');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000014c1', '00000000-0000-4000-8000-0000000014a1', 100, 4995);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000014a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000014c1', id, 20
from public.stock_locations where code = 'castelldefels';

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
-- Pedido de `units` unidades enviado al código postal `cp`.
create function pg_temp.ship(p_request uuid, units integer, cp text, phone text default '600000000')
returns jsonb
language sql as $$
  select public.web_order_create(
    p_request, 'es', 'shipping',
    (select id from public.stock_locations where code = 'castelldefels'),
    jsonb_build_array(jsonb_build_object(
      'variant_id', '00000000-0000-4000-8000-0000000014c1', 'quantity', units)),
    jsonb_build_object('full_name', 'Cliente de envío', 'email', 'envio@test.invalid',
      'phone', phone, 'address_line1', ' Carrer de Prova 1 ', 'address_line2', '2º 1ª',
      'postal_code', cp, 'city', 'Ciutat', 'province', 'Província'),
    'redsys', 30);
$$;
grant execute on function pg_temp.ship(uuid, integer, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Zonas por código postal
-- ---------------------------------------------------------------------------

select is(private.shipping_zone('08860'), 'peninsula', '08860 (Castelldefels): península');
select is(private.shipping_zone('28001'), 'peninsula', '28001 (Madrid): península');
select is(private.shipping_zone('50001'), 'peninsula', '50001 (Zaragoza): península');
select is(private.shipping_zone('07001'), 'baleares', '07001 (Palma): Baleares');
select is(private.shipping_zone('07800'), 'baleares', '07800 (Eivissa): Baleares');
select is(
  array[private.shipping_zone('35001'), private.shipping_zone('38001'),
        private.shipping_zone('51001'), private.shipping_zone('52001')],
  array[null, null, null, null]::text[],
  'Canarias, Ceuta y Melilla: sin envío');
select is(
  array[private.shipping_zone('00123'), private.shipping_zone('53000'),
        private.shipping_zone('0886'), private.shipping_zone('08860a'),
        private.shipping_zone(null)],
  array[null, null, null, null, null]::text[],
  'códigos postales que no existen: sin zona');
select ok(
  not has_function_privilege('authenticated', 'private.shipping_zone(text)', 'execute')
  and not has_function_privilege('anon', 'private.shipping_zone(text)', 'execute'),
  'la zona solo la calcula la base');

-- ---------------------------------------------------------------------------
-- Tarifas: solo settings.manage con MFA
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000142', 'aal2');
select throws_ok(
  $$select public.admin_save_shipping_rate('peninsula', 495, 6000, true)$$,
  '42501', 'forbidden', 'el administrador de la tienda no fija tarifas');
select pg_temp.act_as('00000000-0000-4000-8000-000000000141', 'aal1');
select throws_ok(
  $$select public.admin_save_shipping_rate('peninsula', 495, 6000, true)$$,
  '42501', 'forbidden', 'sin MFA ni el administrador del sistema');
select pg_temp.act_as('00000000-0000-4000-8000-000000000141', 'aal2');
select throws_ok(
  $$select public.admin_save_shipping_rate('canarias', 495, null, true)$$,
  '22023', 'invalid_zone', 'Canarias no es una zona con tarifa');
select throws_ok(
  $$select public.admin_save_shipping_rate('peninsula', -1, null, true)$$,
  '22023', 'invalid_amount', 'sin precios negativos');
select throws_ok(
  $$select public.admin_save_shipping_rate('peninsula', 495, 0, true)$$,
  '22023', 'invalid_amount', 'el envío gratis empieza en un importe positivo');
select is(
  (public.admin_save_shipping_rate('peninsula', 495, 6000, true)).price_cents,
  495, 'el administrador del sistema con MFA fija la tarifa de la península');
select is(
  (public.admin_save_shipping_rate('baleares', 995, null, false)).active,
  false, 'y deja la de Baleares apagada');
select throws_ok(
  $$update public.shipping_rates set price_cents = 0$$,
  '42501', null, 'nadie cambia las tarifas sin pasar por la función');
reset role;
select is(
  (select array_agg(entity_id order by id) from public.audit_log
   where action = 'settings.shipping_rate'),
  array['peninsula', 'baleares'], 'cada cambio de tarifa queda en la auditoría');

-- Lectura: la tienda solo ve las activas; el personal, todas.
set local role anon;
select is(
  (select array_agg(zone order by zone) from public.shipping_rates),
  array['peninsula'], 'anon solo ve las tarifas activas');
select throws_ok(
  $$insert into public.shipping_rates (zone, price_cents) values ('baleares', 1)$$,
  '42501', null, 'anon no escribe tarifas');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000144', 'aal2');
select is(
  (select array_agg(zone order by zone) from public.shipping_rates),
  array['peninsula'], 'un usuario sin personal tampoco ve las apagadas');
-- private.is_staff() exige MFA, como todo el panel.
select pg_temp.act_as('00000000-0000-4000-8000-000000000143', 'aal2');
select is(
  (select array_agg(zone order by zone) from public.shipping_rates),
  array['baleares', 'peninsula'], 'el personal (con MFA) ve también las apagadas');
reset role;

-- ---------------------------------------------------------------------------
-- Pedido con envío (servidor)
-- ---------------------------------------------------------------------------

set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select throws_ok(
  $$select pg_temp.ship('00000000-0000-4000-8000-0000000014d9', 1, '35001')$$,
  '22023', 'shipping_zone_unavailable', 'no se envía a Canarias');
select throws_ok(
  $$select pg_temp.ship('00000000-0000-4000-8000-0000000014d9', 1, '07001')$$,
  '22023', 'shipping_unavailable', 'Baleares sin tarifa activa: no se envía');
select throws_ok(
  $$select pg_temp.ship('00000000-0000-4000-8000-0000000014d9', 1, '08860', null)$$,
  '22023', 'invalid_address', 'el envío exige teléfono');
select throws_ok(
  $$select pg_temp.ship('00000000-0000-4000-8000-0000000014d9', 1, '8860')$$,
  '22023', 'invalid_address', 'y un código postal de cinco cifras');
select is(
  (select array[(o ->> 'items_cents')::int, (o ->> 'shipping_cents')::int,
                (o ->> 'total_cents')::int]
   from pg_temp.ship('00000000-0000-4000-8000-0000000014d1', 1, '08860') o),
  array[4995, 495, 5490], 'un perfume a la península: 49,95 + 4,95 de envío');
select is(
  (select array[(o ->> 'items_cents')::int, (o ->> 'shipping_cents')::int,
                (o ->> 'total_cents')::int]
   from pg_temp.ship('00000000-0000-4000-8000-0000000014d2', 2, '28001') o),
  array[9990, 0, 9990], 'desde 60 € de artículos, envío gratis');
reset role;

select is(
  (select address_line1 || ' | ' || address_line2 || ' | ' || postal_code || ' ' || city
          || ' | ' || province || ' | ' || country
   from public.order_contacts c join public.orders o on o.id = c.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000014d1'),
  'Carrer de Prova 1 | 2º 1ª | 08860 Ciutat | Província | ES',
  'la dirección se guarda limpia y en España');
select is(
  (select detail ->> 'zone' from public.order_events e join public.orders o on o.id = e.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000014d1' and e.kind = 'created'),
  'peninsula', 'la cronología anota la zona, no la dirección');
select ok(
  not exists (select 1 from public.order_events where detail::text ilike '%Prova%'),
  'la cronología no guarda la dirección');

-- Baleares activada: se envía con su tarifa, sin envío gratis.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000141', 'aal2');
select public.admin_save_shipping_rate('baleares', 995, null, true);
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select is(
  (pg_temp.ship('00000000-0000-4000-8000-0000000014d3', 2, '07001') ->> 'shipping_cents')::int,
  995, 'Baleares activada: su tarifa, sin envío gratis');
-- Recogida: sin envío y sin guardar una dirección aunque llegue.
select is(
  (public.web_order_create(
    '00000000-0000-4000-8000-0000000014d4', 'ca', 'click_collect',
    (select id from public.stock_locations where code = 'castelldefels'),
    '[{"variant_id": "00000000-0000-4000-8000-0000000014c1", "quantity": 1}]',
    '{"full_name": "Client", "email": "client@test.invalid", "address_line1": "No cal",
      "postal_code": "08860", "city": "Castelldefels"}',
    'redsys', 30) ->> 'shipping_cents')::int,
  0, 'la recogida en tienda no paga envío');
-- Sin ubicación: la tienda (el checkout no lee tablas con la clave privilegiada).
select public.web_order_create(
  '00000000-0000-4000-8000-0000000014d5', 'en', 'click_collect', null,
  '[{"variant_id": "00000000-0000-4000-8000-0000000014c1", "quantity": 1}]',
  '{"full_name": "Client", "email": "client@test.invalid"}', 'redsys', 30);
select is(
  (select l.code from public.orders o join public.stock_locations l on l.id = o.location_id
   where o.request_id = '00000000-0000-4000-8000-0000000014d5'),
  'castelldefels', 'sin ubicación, el pedido reserva en la tienda');
reset role;
select is(
  (select coalesce(address_line1, '-') || coalesce(postal_code, '-') || coalesce(country, '-')
   from public.order_contacts c join public.orders o on o.id = c.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000014d4'),
  '---', 'ni guarda la dirección');
select is(
  (select total_cents - items_cents - shipping_cents from public.orders
   where request_id = '00000000-0000-4000-8000-0000000014d3'),
  0, 'el total es artículos más envío');
select is(
  (select reserved from public.inventory_levels
   where variant_id = '00000000-0000-4000-8000-0000000014c1'),
  7, 'los envíos también reservan en la tienda (1 + 2 + 2 + 1 + 1)');
select * from finish();
rollback;
