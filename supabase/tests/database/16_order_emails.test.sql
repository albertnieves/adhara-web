-- Correos de los pedidos (PLAN_PEDIDOS_WEB, P06): se encolan con el paso que
-- los motiva (pagado, listo para recoger, enviado), una sola vez por pedido;
-- solo el servidor los toma y registra el resultado, y el panel ve si salió
-- cada uno con orders.view. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000161', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000162', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000163', 'cliente@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000161', 'store_admin'),
  ('00000000-0000-4000-8000-000000000162', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000016b1', 'marca-correos', 'Marca de correos');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000016a1', '00000000-0000-4000-8000-0000000016b1',
   'perfume-correos', 'Perfume de correos');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000016c1', '00000000-0000-4000-8000-0000000016a1', 100, 7000);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000016a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000016c1', id, 10
from public.stock_locations where code = 'castelldefels';
insert into public.shipping_rates (zone, price_cents, active) values ('peninsula', 500, true);

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
create function pg_temp.order_id(p_request uuid) returns uuid
language sql as $$ select id from public.orders where request_id = p_request; $$;
create function pg_temp.rev(p_request uuid) returns integer
language sql as $$ select revision from public.orders where request_id = p_request; $$;
create function pg_temp.emails(p_request uuid) returns text[]
language sql as $$
  select coalesce(array_agg(e.kind || ':' || e.status order by e.id), '{}')
  from public.order_emails e join public.orders o on o.id = e.order_id
  where o.request_id = p_request;
$$;
-- Paga el último intento del pedido (como lo haría el banco).
create function pg_temp.pay(p_request uuid) returns text
language sql as $$
  select public.web_order_record_payment('redsys', a.reference, a.reference || '/1',
    'succeeded', o.total_cents, 'EUR') ->> 'action'
  from public.orders o
  join public.order_payment_attempts a on a.order_id = o.id
  where o.request_id = p_request
  order by a.created_at desc limit 1;
$$;
grant execute on function pg_temp.pay(uuid), pg_temp.order_id(uuid), pg_temp.rev(uuid),
  pg_temp.emails(uuid), pg_temp.act_as(text, text), pg_temp.as_server()
  to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.web_order_emails_claim(integer)', 'execute')
  and not has_function_privilege('authenticated', 'public.web_order_emails_claim(integer)', 'execute')
  and not has_function_privilege('authenticated',
    'public.web_order_email_result(bigint, boolean, text, text)', 'execute'),
  'ni la tienda ni el personal toman correos ni registran envíos');
select ok(
  not has_table_privilege('anon', 'public.order_emails', 'select')
  and not has_table_privilege('authenticated', 'public.order_emails', 'insert')
  and not has_table_privilege('authenticated', 'public.order_emails', 'update'),
  'nadie escribe en la cola directamente');

-- ---------------------------------------------------------------------------
-- Encolado
-- ---------------------------------------------------------------------------

set local role service_role;
select pg_temp.as_server();
select public.web_order_create('00000000-0000-4000-8000-0000000016d1', 'en', 'click_collect',
  null, '[{"variant_id": "00000000-0000-4000-8000-0000000016c1", "quantity": 2}]',
  '{"full_name": "Pickup <Customer>", "email": "pickup@test.invalid"}', 'redsys', 30);
select public.web_order_create('00000000-0000-4000-8000-0000000016d2', 'ca', 'shipping',
  null, '[{"variant_id": "00000000-0000-4000-8000-0000000016c1", "quantity": 1}]',
  '{"full_name": "Client d''enviament", "email": "envio@test.invalid", "phone": "600000000",
    "address_line1": "Carrer Major 1", "postal_code": "08860", "city": "Castelldefels"}',
  'redsys', 30);

select is(pg_temp.emails('00000000-0000-4000-8000-0000000016d1'), '{}'::text[],
  'un pedido sin pagar no manda correo');
select is(pg_temp.pay('00000000-0000-4000-8000-0000000016d1'), 'confirm', 'cobro confirmado');
select is(pg_temp.emails('00000000-0000-4000-8000-0000000016d1'),
  array['order_paid:pending'], 'el pago encola la confirmación en la misma transacción');
select is(pg_temp.pay('00000000-0000-4000-8000-0000000016d1'), 'ignore',
  'la misma notificación otra vez no hace nada');
select is(pg_temp.emails('00000000-0000-4000-8000-0000000016d1'),
  array['order_paid:pending'], 'ni encola otra confirmación');
select is(pg_temp.pay('00000000-0000-4000-8000-0000000016d2'), 'confirm', 'cobro del envío');

reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000161', 'aal2');
select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000016d1'),
  'processing', pg_temp.rev('00000000-0000-4000-8000-0000000016d1'));
select is(pg_temp.emails('00000000-0000-4000-8000-0000000016d1'),
  array['order_paid:pending'], 'empezar a preparar no manda correo');
select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000016d1'),
  'ready_for_pickup', pg_temp.rev('00000000-0000-4000-8000-0000000016d1'));
select is(pg_temp.emails('00000000-0000-4000-8000-0000000016d1'),
  array['order_paid:pending', 'ready_for_pickup:pending'], 'listo para recoger: aviso');
select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000016d2'),
  'processing', pg_temp.rev('00000000-0000-4000-8000-0000000016d2'));
select public.admin_transition_order(pg_temp.order_id('00000000-0000-4000-8000-0000000016d2'),
  'shipped', pg_temp.rev('00000000-0000-4000-8000-0000000016d2'), 'TRK-123');
select is(pg_temp.emails('00000000-0000-4000-8000-0000000016d2'),
  array['order_paid:pending', 'shipped:pending'], 'enviado: aviso');

-- Lectura en el panel: estado sí, contenido no hay.
select is((select count(*)::int from public.order_emails), 4,
  'el administrador de la tienda ve los cuatro correos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000162', 'aal2');
select is((select count(*)::int from public.order_emails), 4,
  'el encargado (orders.view) también ve si salieron');
select pg_temp.act_as('00000000-0000-4000-8000-000000000163', 'aal2');
select is((select count(*)::int from public.order_emails), 0, 'un cliente no ve nada');
reset role;
set local role anon;
select throws_ok('select * from public.order_emails', '42501', null, 'la tienda anónima no lee la cola');
reset role;

-- ---------------------------------------------------------------------------
-- Envío: tomar, resultado y reintentos
-- ---------------------------------------------------------------------------

set local role service_role;
select pg_temp.as_server();
create temp table lote on commit drop as
select public.web_order_emails_claim(10) as jobs;
select is((select jsonb_array_length(jobs) from lote), 4, 'toma los cuatro pendientes');
select is(
  (select j - 'id' - 'lines' from lote, jsonb_array_elements(jobs) j
   where j ->> 'kind' = 'shipped'),
  jsonb_build_object('kind', 'shipped', 'number', (select number from public.orders
      where request_id = '00000000-0000-4000-8000-0000000016d2'),
    'locale', 'ca', 'fulfillment', 'shipping', 'items_cents', 7000,
    'shipping_cents', 500, 'total_cents', 7500, 'tracking_reference', 'TRK-123',
    'full_name', 'Client d''enviament', 'email', 'envio@test.invalid',
    'address', jsonb_build_object('line1', 'Carrer Major 1', 'line2', null,
      'postal_code', '08860', 'city', 'Castelldefels', 'province', null)),
  'cada correo lleva destinatario, idioma, importes, entrega y seguimiento');
select is(
  (select j -> 'lines' from lote, jsonb_array_elements(jobs) j
   where j ->> 'kind' = 'ready_for_pickup'),
  '[{"brand": "Marca de correos", "name": "Perfume de correos", "size_ml": 100,
     "label": null, "quantity": 2, "line_total_cents": 14000}]'::jsonb,
  'y las líneas con su precio congelado');
select is(
  (select j -> 'address' from lote, jsonb_array_elements(jobs) j
   where j ->> 'kind' = 'ready_for_pickup'),
  'null'::jsonb, 'la recogida no lleva dirección');
select is(jsonb_array_length(public.web_order_emails_claim(10)), 0,
  'los que están en curso no se toman dos veces');

select public.web_order_email_result((j ->> 'id')::bigint, true, 're_123')
from lote, jsonb_array_elements(jobs) j where j ->> 'kind' = 'order_paid'
  and j ->> 'locale' = 'en';
select public.web_order_email_result((j ->> 'id')::bigint, false, null, 'http_500')
from lote, jsonb_array_elements(jobs) j where j ->> 'kind' = 'ready_for_pickup';
select is(pg_temp.emails('00000000-0000-4000-8000-0000000016d1'),
  array['order_paid:sent', 'ready_for_pickup:pending'],
  'enviado queda enviado; el fallido vuelve a la cola');
select is(
  (select array[provider_id, last_error] from public.order_emails where kind = 'ready_for_pickup'),
  array[null, 'http_500'], 'con el código del error');

-- Cinco intentos fallidos: se da por fallido y no se vuelve a tomar.
update public.order_emails set attempts = 4 where kind = 'ready_for_pickup';
select public.web_order_email_result((j ->> 'id')::bigint, false, null, 'http_500')
from jsonb_array_elements(public.web_order_emails_claim(10)) j
where j ->> 'kind' = 'ready_for_pickup';
select is((select status from public.order_emails where kind = 'ready_for_pickup'), 'failed',
  'tras cinco intentos, fallido');
select is((select jsonb_array_length(public.web_order_emails_claim(10))), 0,
  'y ya no se toma');
reset role;

select * from finish();
rollback;
