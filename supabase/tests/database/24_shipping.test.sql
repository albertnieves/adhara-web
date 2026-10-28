-- Envíos multitransportista (20261025120000, DECISIONS §171–176): precio por
-- peso y servicio calculado en la base, costes solo en internal, permisos del
-- panel con MFA, etiqueta, recogida o punto de entrega y seguimiento firmado
-- que avanza el pedido. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(81);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000241', 'sistema-envios@test.invalid'),
  ('00000000-0000-4000-8000-000000000242', 'tienda-envios@test.invalid'),
  ('00000000-0000-4000-8000-000000000243', 'encargado-envios@test.invalid'),
  ('00000000-0000-4000-8000-000000000244', 'cliente-envios@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000241', 'system_admin'),
  ('00000000-0000-4000-8000-000000000242', 'store_admin'),
  ('00000000-0000-4000-8000-000000000243', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000024b1', 'marca-pesos', 'Marca de pesos');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000024a1', '00000000-0000-4000-8000-0000000024b1',
   'perfume-pesos', 'Perfume de pesos');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents, shipping_weight_g) values
  ('00000000-0000-4000-8000-0000000024c1', '00000000-0000-4000-8000-0000000024a1', 100, 3000, 450),
  ('00000000-0000-4000-8000-0000000024c2', '00000000-0000-4000-8000-0000000024a1', 30, 1500, null);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000024a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select v.id, l.id, 30
from (values ('00000000-0000-4000-8000-0000000024c1'::uuid),
             ('00000000-0000-4000-8000-0000000024c2'::uuid)) v(id)
cross join public.stock_locations l where l.code = 'castelldefels';

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
create function pg_temp.as_server() returns void
language sql as $$
  select set_config('request.jwt.claims', '{"role": "service_role"}', true);
$$;
create function pg_temp.items(units integer, light integer default 0) returns jsonb
language sql immutable as $$
  select jsonb_agg(i) from (
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000024c1', 'quantity', units) i
    where units > 0
    union all
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000024c2', 'quantity', light)
    where light > 0
  ) x;
$$;
create function pg_temp.ship(p_request uuid, p_items jsonb, p_service uuid, cp text default '08860')
returns jsonb
language sql as $$
  select public.web_order_create(
    p_request, 'es', 'shipping', null, p_items,
    jsonb_build_object('full_name', 'Cliente de pesos', 'email', 'pesos@test.invalid',
      'phone', '600000000', 'address_line1', 'Carrer de Prova 1',
      'postal_code', cp, 'city', 'Ciutat'),
    'redsys', 30, p_shipping_service_id => p_service);
$$;
create function pg_temp.pay(p_request uuid) returns text
language sql as $$
  select public.web_order_record_payment('redsys', a.reference, a.reference || '/1',
    'succeeded', o.total_cents, 'EUR') ->> 'action'
  from public.orders o
  join public.order_payment_attempts a on a.order_id = o.id
  where o.request_id = p_request
  order by a.created_at desc limit 1;
$$;
create function pg_temp.order_of(p_request uuid) returns public.orders
language sql as $$ select * from public.orders where request_id = p_request; $$;
grant execute on function
  pg_temp.items(integer, integer), pg_temp.ship(uuid, jsonb, uuid, text),
  pg_temp.pay(uuid), pg_temp.order_of(uuid)
  to service_role, authenticated, anon;

-- ---------------------------------------------------------------------------
-- Esquema: costes fuera de la API y nada escribible directamente
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.shipping_services', 'select')
  and not has_table_privilege('anon', 'public.shipments', 'select')
  and not has_table_privilege('anon', 'public.shipping_settings', 'select'),
  'un visitante no lee servicios, envíos ni ajustes');
select ok(
  not has_table_privilege('authenticated', 'public.shipments', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.shipping_services', 'insert,update,delete')
  and not has_table_privilege('authenticated', 'public.shipment_events', 'insert,update,delete'),
  'el personal solo escribe con las funciones del panel');
select ok(
  not has_table_privilege('authenticated', 'internal.shipping_service_rates', 'select')
  and not has_table_privilege('authenticated', 'internal.shipment_costs', 'select'),
  'los costes de los transportistas viven en internal');
select ok(
  has_function_privilege('anon', 'public.web_shipping_quote(jsonb)', 'execute'),
  'la tienda pregunta las opciones de su cesta');
select ok(
  not has_function_privilege('anon', 'public.web_shipment_event(text, text, text, integer, text, timestamptz, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.web_shipment_event(text, text, text, integer, text, timestamptz, text, text)', 'execute'),
  'el seguimiento solo lo apunta el servidor');
select ok(
  not has_function_privilege('authenticated', 'private.shipping_advance_order(uuid, text, uuid, text)', 'execute')
  and not has_function_privilege('service_role', 'private.shipping_advance_order(uuid, text, uuid, text)', 'execute'),
  'nadie avanza un pedido llamando al auxiliar');
select is(private.shipping_price(400, 2100, 0), 484, '4,00 € sin IVA son 4,84 € con el 21 %');
select is(private.shipping_price(333, 2100, 50), 453, 'redondea al céntimo hacia arriba y suma el recargo');
select is(private.shipping_service_label('Correos', 'Correos Paq Estándar'),
  'Correos Paq Estándar', 'no repite el transportista');
select is(private.shipping_service_label('SEUR', '24 Horas'), 'SEUR · 24 Horas',
  'o lo antepone');

-- ---------------------------------------------------------------------------
-- Ajustes, zonas y servicios: settings.manage con MFA
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000242', 'aal2');
select throws_ok(
  $$select public.admin_save_shipping_settings('{"sender_name": "Tienda"}')$$,
  '42501', 'forbidden', 'el administrador de la tienda no cambia los ajustes de envío');
select pg_temp.act_as('00000000-0000-4000-8000-000000000241', 'aal1');
select throws_ok(
  $$select public.admin_shipping_services()$$,
  '42501', 'forbidden', 'sin MFA ni el administrador del sistema ve los servicios');
select pg_temp.act_as('00000000-0000-4000-8000-000000000241', 'aal2');
select throws_ok(
  $$select public.admin_save_shipping_settings('{"sender_name": "Tienda", "address_line1": "C/ 1",
    "postal_code": "8860", "city": "Castelldefels", "phone": "600000000",
    "email": "t@test.invalid", "packaging_weight_g": 100}')$$,
  '22023', 'invalid_settings', 'el código postal del remitente tiene cinco cifras');
select throws_ok(
  $$select public.admin_save_shipping_settings('{"sender_name": "Tienda", "address_line1": "C/ 1",
    "postal_code": "08860", "city": "Castelldefels", "phone": "600000000",
    "email": "t@test.invalid", "packaging_weight_g": 100, "pickup_start": "14:00",
    "pickup_end": "10:00"}')$$,
  '22023', 'invalid_settings', 'la franja de recogida termina después de empezar');
select is(
  (public.admin_save_shipping_settings('{"sender_name": "L''Atelier", "address_line1": "Carrer 1",
    "postal_code": "08860", "city": "Castelldefels", "phone": "600000000",
    "email": "Tienda@Test.invalid", "packaging_weight_g": 100}')).email,
  'tienda@test.invalid', 'con MFA guarda el remitente (email en minúsculas)');
select is((select shipping_vat_bps from public.shipping_settings), 2100,
  'por defecto el coste lleva el 21 % de IVA');

-- Servicio manual con tramos escritos a mano.
create temp table svc (id uuid) on commit drop;
grant all on svc to authenticated, service_role, anon;
insert into svc
select (public.admin_save_shipping_service(null, '{"carrier_name": "Correos",
  "name": "Paq Estándar", "zones": ["peninsula"], "transit_days": 2,
  "tracking_url_template": "https://seguimiento.example/{tracking}",
  "pickup_phone": "900 400 004"}')).id;
select is((select provider || ':' || active::text from public.shipping_services
           where id = (select id from svc)), 'manual:false',
  'un servicio nuevo es manual y empieza apagado');
select throws_ok(
  $$select public.admin_save_shipping_service((select id from svc),
    '{"name": "Paq Estándar", "zones": ["peninsula"], "active": true}')$$,
  '22023', 'service_without_rates', 'no se activa sin tramos en su zona');
select throws_ok(
  $$select public.admin_save_shipping_service_rates((select id from svc), 'peninsula',
    '[{"min_weight_g": 1, "max_weight_g": 1000, "cost_cents": 400},
      {"min_weight_g": 900, "max_weight_g": 2000, "cost_cents": 500}]')$$,
  '22023', 'invalid_rates', 'los tramos no se solapan');
select throws_ok(
  $$select public.admin_save_shipping_service_rates((select id from svc), 'peninsula',
    '[{"min_weight_g": 1, "max_weight_g": 1000, "cost_cents": -1}]')$$,
  '22023', 'invalid_rates', 'sin costes negativos');
select is(
  public.admin_save_shipping_service_rates((select id from svc), 'peninsula',
    '[{"min_weight_g": 1, "max_weight_g": 1000, "cost_cents": 400},
      {"min_weight_g": 1001, "max_weight_g": 2000, "cost_cents": 500},
      {"min_weight_g": 2001, "max_weight_g": 5000, "cost_cents": 700}]'),
  3, 'tres tramos de peso para la península');
select is(
  (public.admin_save_shipping_service((select id from svc),
    '{"name": "Paq Estándar", "zones": ["peninsula"], "active": true,
      "transit_days": 2, "surcharge_cents": 0, "free_eligible": true,
      "tracking_url_template": "https://seguimiento.example/{tracking}",
      "pickup_phone": "900 400 004"}')).active,
  true, 'con tramos se activa');
select throws_ok(
  $$select public.admin_save_shipping_service_rates((select id from svc), 'peninsula', '[]')$$,
  '22023', 'service_without_rates', 'un servicio activo no se queda sin tramos');
select is(
  (select jsonb_path_query_array(public.admin_shipping_services(), '$[*].rates[*].price_cents')),
  '[484, 605, 847]'::jsonb, 'el panel ve el precio con IVA de cada tramo');

-- Sincronización con la plataforma.
select is(
  public.admin_shipping_sync('sendcloud', '[{"code": "seur:24", "carrier_code": "seur",
    "carrier_name": "SEUR", "name": "SEUR 24", "first_mile": "pickup_dropoff",
    "dangerous_goods": false,
    "rates": [{"zone": "peninsula", "min_weight_g": 1, "max_weight_g": 2000,
               "cost_cents": 600, "lead_time_hours": 24},
              {"zone": "baleares", "min_weight_g": 1, "max_weight_g": 2000,
               "cost_cents": 1200, "lead_time_hours": 72}]}]') - 'rates',
  '{"created": 1, "updated": 0, "disabled": 0}'::jsonb,
  'la sincronización crea el servicio de la plataforma');
select is(
  (select array[active::text, array_to_string(zones, ','), transit_days::text]
   from public.shipping_services where code = 'seur:24'),
  array['false', 'baleares,peninsula', '1'],
  'entra apagado, con sus zonas y el plazo del tramo más rápido');
select throws_ok(
  $$select public.admin_save_shipping_service_rates(
    (select id from public.shipping_services where code = 'seur:24'), 'peninsula', '[]')$$,
  '22023', 'synced_service', 'los tramos de la plataforma no se escriben a mano');
select public.admin_save_shipping_service(
  (select id from public.shipping_services where code = 'seur:24'),
  '{"name": "SEUR 24", "zones": ["peninsula", "baleares"], "active": true,
    "transit_days": 1, "surcharge_cents": 100, "free_eligible": false}');
select is(
  (public.admin_save_shipping_zone('peninsula', 6000, true)).active
  and (public.admin_save_shipping_zone('baleares', null, true)).active,
  true, 'península (gratis desde 60 €) y Baleares con envío');
reset role;

-- ---------------------------------------------------------------------------
-- Pesos: catalog.edit
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000243', 'aal2');
select throws_ok(
  $$select public.admin_save_variant_weights('[{"variant_id": "00000000-0000-4000-8000-0000000024c2", "weight_g": 200}]')$$,
  '42501', 'forbidden', 'el encargado no pesa formatos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000242', 'aal2');
select throws_ok(
  $$select public.admin_save_variant_weights('[{"variant_id": "00000000-0000-4000-8000-0000000024c2", "weight_g": 0}]')$$,
  '22023', 'invalid_weights', 'sin pesos de cero gramos');
reset role;

-- ---------------------------------------------------------------------------
-- Tienda: opciones por peso y pedido con el servicio elegido
-- ---------------------------------------------------------------------------

set local role anon;
select pg_temp.as_server();
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select is(
  (public.web_shipping_quote(pg_temp.items(1)) ->> 'weight_g')::int,
  550, 'peso: 450 g del formato + 100 g de embalaje');
select is(
  (select jsonb_path_query_array(public.web_shipping_quote(pg_temp.items(1)),
     '$.zones[*] ? (@.zone == "peninsula").options[*].price_cents')),
  '[484, 826]'::jsonb, 'península: Correos 4,84 € y SEUR 8,26 € (6,00 + IVA + 1 €), del más barato al más caro');
select is(
  (select jsonb_path_query_array(public.web_shipping_quote(pg_temp.items(1)),
     '$.zones[*] ? (@.zone == "baleares").options[*].label')),
  '["SEUR 24"]'::jsonb, 'Baleares: solo el servicio que la tiene (sin repetir la marca)');
select is(
  (select jsonb_path_query_array(public.web_shipping_quote(pg_temp.items(3)),
     '$.zones[*] ? (@.zone == "peninsula").options[*].price_cents')),
  '[605, 826]'::jsonb, '1,45 kg: segundo tramo de Correos; SEUR, con su tramo hasta 2 kg');
select is(
  public.web_shipping_quote(pg_temp.items(1, 1)) ->> 'weight_g', null,
  'con un formato sin peso, no hay peso ni opciones');
select is(
  jsonb_array_length(public.web_shipping_quote(pg_temp.items(1, 1)) #> '{zones,0,options}'), 0,
  'y ninguna opción de envío');
select ok(
  public.web_shipping_quote(pg_temp.items(1))::text !~ '"cost',
  'la tienda nunca recibe costes');
reset role;

set local role service_role;
select pg_temp.as_server();
select throws_ok(
  $$select pg_temp.ship('00000000-0000-4000-8000-0000000024d9', pg_temp.items(1), null)$$,
  '22023', 'shipping_service_required', 'con envío hay que elegir servicio');
select throws_ok(
  $$select pg_temp.ship('00000000-0000-4000-8000-0000000024d9', pg_temp.items(1, 1),
    (select id from svc))$$,
  '22023', 'shipping_weight_unknown', 'un formato sin peso no se envía');
select throws_ok(
  $$select pg_temp.ship('00000000-0000-4000-8000-0000000024d9', pg_temp.items(1),
    (select id from svc), '07001')$$,
  '22023', 'shipping_service_unavailable', 'Correos no está en Baleares');
select throws_ok(
  $$select pg_temp.ship('00000000-0000-4000-8000-0000000024d9', pg_temp.items(20),
    (select id from svc))$$,
  '22023', 'shipping_service_unavailable', 'más peso que el último tramo: sin ese servicio');
select is(
  (select array[(o ->> 'items_cents')::int, (o ->> 'shipping_cents')::int, (o ->> 'total_cents')::int]
   from pg_temp.ship('00000000-0000-4000-8000-0000000024d1', pg_temp.items(1),
     (select id from svc)) o),
  array[3000, 484, 3484], 'un perfume con Correos: 30 € + 4,84 €');
select is(
  (select array[shipping_service_label, shipping_weight_g::text, shipping_zone]
   from public.orders where request_id = '00000000-0000-4000-8000-0000000024d1'),
  array['Correos · Paq Estándar', '550', 'peninsula'],
  'el pedido guarda lo que vio el cliente, el peso y la zona');
select is(
  (pg_temp.ship('00000000-0000-4000-8000-0000000024d2', pg_temp.items(2),
     (select id from svc)) ->> 'shipping_cents')::int,
  0, 'desde 60 € de artículos, Correos (cuenta para el envío gratis) sale gratis');
select is(
  (pg_temp.ship('00000000-0000-4000-8000-0000000024d3', pg_temp.items(2),
     (select id from public.shipping_services where code = 'seur:24')) ->> 'shipping_cents')::int,
  826, 'SEUR no cuenta para el envío gratis: se cobra');
select is(
  (pg_temp.ship('00000000-0000-4000-8000-0000000024d4', pg_temp.items(1),
     (select id from public.shipping_services where code = 'seur:24'), '07800') ->> 'shipping_cents')::int,
  1552, 'Eivissa con SEUR: tramo de Baleares (12,00 + IVA + 1 €)');
select is(pg_temp.pay('00000000-0000-4000-8000-0000000024d1'), 'confirm', 'se paga el pedido de Correos');
select is(pg_temp.pay('00000000-0000-4000-8000-0000000024d3'), 'confirm', 'y el de SEUR');
select is(pg_temp.pay('00000000-0000-4000-8000-0000000024d4'), 'confirm', 'y el de Eivissa');
reset role;

-- ---------------------------------------------------------------------------
-- Etiqueta: orders.fulfill con MFA; el coste solo con pricing.view_cost
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000243', 'aal2');
select throws_ok(
  $$select public.admin_record_shipment((pg_temp.order_of('00000000-0000-4000-8000-0000000024d1')).id,
    '{"provider": "manual", "weight_g": 550}')$$,
  '42501', 'forbidden', 'el encargado no crea etiquetas');
select pg_temp.act_as('00000000-0000-4000-8000-000000000242', 'aal1');
select throws_ok(
  $$select public.admin_record_shipment((pg_temp.order_of('00000000-0000-4000-8000-0000000024d1')).id,
    '{"provider": "manual", "weight_g": 550}')$$,
  '42501', 'forbidden', 'ni la tienda sin MFA');
select pg_temp.act_as('00000000-0000-4000-8000-000000000242', 'aal2');
select is(
  (public.admin_record_shipment((pg_temp.order_of('00000000-0000-4000-8000-0000000024d1')).id,
    jsonb_build_object('provider', 'manual', 'service_id', (select id from svc),
      'tracking_number', 'PQ123ES', 'weight_g', 560, 'cost_cents', 410))).tracking_url,
  'https://seguimiento.example/PQ123ES', 'etiqueta manual: el enlace sale de la plantilla');
select is((pg_temp.order_of('00000000-0000-4000-8000-0000000024d1')).status, 'processing',
  'el pedido pagado pasa a «Preparando»');
select throws_ok(
  $$select public.admin_record_shipment((pg_temp.order_of('00000000-0000-4000-8000-0000000024d1')).id,
    '{"provider": "manual", "carrier_code": "x", "carrier_name": "X", "service_name": "X", "weight_g": 550}')$$,
  '55000', 'shipment_exists', 'una sola etiqueta viva por pedido');
select throws_ok(
  $$select public.admin_record_shipment((pg_temp.order_of('00000000-0000-4000-8000-0000000024d2')).id,
    '{"provider": "manual", "carrier_code": "x", "carrier_name": "X", "service_name": "X", "weight_g": 550}')$$,
  '55000', 'shipment_unavailable', 'un pedido sin pagar no lleva etiqueta');
select is(
  (select cost_cents from public.admin_shipment_costs((pg_temp.order_of('00000000-0000-4000-8000-0000000024d1')).id)),
  410, 'con pricing.view_cost se ve lo que costó la etiqueta');
select ok(
  not exists (select 1 from public.order_events e
              where e.order_id = (pg_temp.order_of('00000000-0000-4000-8000-0000000024d1')).id
                and (e.detail::text ~* 'cost' or e.detail ->> 'amount_cents' = '410')),
  'la cronología del pedido no lleva el coste');
-- Etiqueta de la plataforma para el pedido de SEUR.
select is(
  (public.admin_record_shipment((pg_temp.order_of('00000000-0000-4000-8000-0000000024d3')).id,
    jsonb_build_object('provider', 'sendcloud',
      'service_id', (select id from public.shipping_services where code = 'seur:24'),
      'provider_shipment_id', 'sc-1', 'provider_parcel_id', '9001',
      'tracking_number', 'SEUR9001', 'tracking_url', 'https://tracking.example/SEUR9001',
      'weight_g', 1050, 'cost_cents', 590))).carrier_name,
  'SEUR', 'etiqueta de la plataforma con el transportista del servicio');
select is(
  (public.admin_record_shipment((pg_temp.order_of('00000000-0000-4000-8000-0000000024d4')).id,
    jsonb_build_object('provider', 'sendcloud',
      'service_id', (select id from public.shipping_services where code = 'seur:24'),
      'provider_parcel_id', '9002', 'tracking_number', 'SEUR9002',
      'weight_g', 550))).status,
  'label_created', 'otra para Eivissa');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000243', 'aal2');
select throws_ok(
  $$select * from public.admin_shipment_costs((pg_temp.order_of('00000000-0000-4000-8000-0000000024d1')).id)$$,
  '42501', 'forbidden', 'el encargado no ve costes de envío');
select is(
  (select count(*)::int from public.shipments), 3, 'pero sí ve los envíos (orders.view)');

-- ---------------------------------------------------------------------------
-- Recogida en la tienda y punto de entrega
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-000000000242', 'aal2');
select throws_ok(
  $$select public.admin_record_pickup(
    jsonb_build_object('provider', 'sendcloud', 'carrier_code', 'correos', 'carrier_name', 'Correos',
      'status', 'requested', 'window_start', '2026-10-27T09:00:00Z', 'window_end', '2026-10-27T12:00:00Z'),
    array[(select id from public.shipments where tracking_number = 'SEUR9001')])$$,
  '22023', 'pickup_shipments_invalid', 'una recogida es de un solo transportista');
select is(
  (public.admin_record_pickup(
    jsonb_build_object('provider', 'sendcloud', 'carrier_code', 'seur', 'carrier_name', 'SEUR',
      'provider_pickup_id', '77', 'status', 'requested',
      'window_start', '2026-10-27T09:00:00Z', 'window_end', '2026-10-27T12:00:00Z'),
    array(select id from public.shipments where carrier_code = 'seur' order by id))).parcels,
  2, 'una recogida para los dos paquetes de SEUR');
select is(
  (select array_agg(handover order by id) from public.shipments where carrier_code = 'seur'),
  array['pickup', 'pickup'], 'los dos quedan pendientes de recogida');
select throws_ok(
  $$select public.admin_record_dropoff((select id from public.shipments where tracking_number = 'PQ123ES'),
    jsonb_build_object('name', repeat('x', 130)))$$,
  '22023', 'invalid_point', 'el punto se guarda con datos cortos');
select is(
  (public.admin_record_dropoff((select id from public.shipments where tracking_number = 'PQ123ES'),
    '{"name": "Oficina de Correos", "address": "Av. 1, Castelldefels", "id": "CO-1"}')).status,
  'shipped', 'dejado en el punto de entrega: el pedido pasa a «Enviado»');
select is(
  (select array[o.tracking_reference, o.reservation] from public.orders o
   where o.request_id = '00000000-0000-4000-8000-0000000024d1'),
  array['PQ123ES', 'consumed'], 'con el seguimiento de la etiqueta y las unidades descontadas');
select is(
  (select e.kind || ':' || e.status from public.order_emails e
   join public.orders o on o.id = e.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000024d1' and e.kind = 'shipped'),
  'shipped:pending', 'y el correo de «enviado» en la cola');
select throws_ok(
  $$select public.admin_cancel_shipment((select id from public.shipments where tracking_number = 'PQ123ES'))$$,
  '55000', 'shipment_not_cancellable', 'una etiqueta enviada no se cancela');
reset role;

-- ---------------------------------------------------------------------------
-- Seguimiento del proveedor
-- ---------------------------------------------------------------------------

set local role service_role;
select pg_temp.as_server();
select throws_ok(
  $$select public.web_shipment_event('sendcloud', '9001', 'perdido', 1, 'x', now())$$,
  '22023', 'invalid_event', 'solo estados conocidos');
select is(
  public.web_shipment_event('sendcloud', '404404', 'in_transit', 3, 'En camino', now()) ->> 'known',
  'false', 'un paquete que no es de la tienda se ignora');
-- Las horas de los avisos van después de la de la etiqueta (now() de la
-- transacción): con fechas fijas, la prueba caducaba al pasar esas fechas.
select is(
  public.web_shipment_event('sendcloud', '9001', 'in_transit', 22,
    'Shipment picked up by driver', now() + interval '1 hour') ->> 'order_status',
  'shipped', 'el transportista lo recoge: el pedido de SEUR pasa a «Enviado» solo');
select is(
  public.web_shipment_event('sendcloud', '9001', 'in_transit', 22,
    'Shipment picked up by driver', now() + interval '1 hour') ->> 'recorded',
  'false', 'el mismo aviso otra vez no se repite');
select is(
  public.web_shipment_event('sendcloud', '9001', 'delivered', 11, 'Delivered',
    now() + interval '3 hours') ->> 'order_status',
  'completed', 'entregado: el pedido se completa');
select is(
  public.web_shipment_event('sendcloud', '9001', 'out_for_delivery', 92, 'Driver en route',
    now() + interval '2 hours') ->> 'status',
  'delivered', 'un aviso atrasado no deshace el estado');
select is(
  (select array[(s.delivered_at = now() + interval '3 hours')::text,
                (select count(*)::text from public.shipment_events e where e.shipment_id = s.id)]
   from public.shipments s where s.provider_parcel_id = '9001'),
  array['true', '4'], 'se guarda la hora de entrega y los avisos (etiqueta + 3)');
select is(
  public.web_shipment_event('sendcloud', '9002', 'exception', 80, 'Unable to deliver',
    now() + interval '1 day') ->> 'order_status',
  'processing', 'una incidencia no cambia el pedido');
select is(
  (select e.kind from public.order_events e join public.orders o on o.id = e.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000024d4' order by e.id desc limit 1),
  'shipment_status', 'pero queda en su cronología');
select is(
  (select (public.web_order_status(o.id) -> 'shipment') ->> 'tracking_url'
   from public.orders o where o.request_id = '00000000-0000-4000-8000-0000000024d3'),
  'https://tracking.example/SEUR9001', 'el cliente ve el enlace de seguimiento');
select ok(
  (select public.web_order_status(o.id)::text !~ 'cost'
   from public.orders o where o.request_id = '00000000-0000-4000-8000-0000000024d3'),
  'y nunca el coste');
reset role;

select is(
  (select count(*)::int from public.audit_log where action like 'orders.shipment_%'),
  4, 'etiquetas y recogida quedan en la auditoría (3 + 1)');

select * from finish();
rollback;
