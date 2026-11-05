-- Envío gratis temporal (DECISIONS §189): solo promotions.manage con MFA lo
-- crea y lo ve; la tienda sabe, por zona, desde cuánto y hasta cuándo vale sin
-- ver su nombre interno; el pedido regala el envío cuando lo pagado por los
-- artículos (ya con el descuento) llega a su mínimo, solo en los servicios que
-- cuentan para el envío gratis, y se suma a un código. Si el envío sale más
-- caro que el enseñado, no hay pedido. Datos ficticios; la transacción se
-- revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(56);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000281', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000282', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000283', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000284', 'cliente@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000281', 'system_admin'),
  ('00000000-0000-4000-8000-000000000282', 'store_admin'),
  ('00000000-0000-4000-8000-000000000283', 'viewer');

-- Un perfume con un formato de 40 € y otro de 20 €.
insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000028b1', 'casa-envio', 'Casa del envío');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000028a1', '00000000-0000-4000-8000-0000000028b1',
   'perfume-envio', 'Perfume del envío');
insert into public.product_variants
  (id, product_id, size_ml, retail_price_cents, shipping_weight_g) values
  ('00000000-0000-4000-8000-0000000028c1', '00000000-0000-4000-8000-0000000028a1', 100, 4000, 300),
  ('00000000-0000-4000-8000-0000000028c2', '00000000-0000-4000-8000-0000000028a1', 50, 2000, 300);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000028a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select v.id, l.id, 100
from (values ('00000000-0000-4000-8000-0000000028c1'::uuid),
             ('00000000-0000-4000-8000-0000000028c2'::uuid)) v(id)
cross join public.stock_locations l where l.code = 'castelldefels';
-- La península tiene envío gratis desde 100 €; Baleares, ninguno.
insert into public.shipping_rates (zone, price_cents, free_from_cents, active) values
  ('peninsula', null, 10000, true),
  ('baleares', null, null, true)
on conflict (zone) do update
  set price_cents = null, free_from_cents = excluded.free_from_cents, active = true;
insert into public.shipping_settings (sender_name, address_line1, postal_code, city,
  phone, email, packaging_weight_g, shipping_vat_bps)
values ('Tienda del envío', 'Carrer de la Tenda 1', '08860', 'Castelldefels',
  '600000000', 'tienda-envio@test.invalid', 0, 0);
-- Estándar cuenta para el envío gratis; Urgente, no.
insert into public.shipping_services (id, provider, code, carrier_code, carrier_name,
  name, zones, active, free_eligible) values
  ('00000000-0000-4000-8000-0000000028e1', 'manual', 'prueba-28-estandar', 'prueba',
   'Transportista', 'Estándar', '{peninsula,baleares}', true, true),
  ('00000000-0000-4000-8000-0000000028e2', 'manual', 'prueba-28-urgente', 'prueba',
   'Transportista', 'Urgente', '{peninsula}', true, false);
insert into internal.shipping_service_rates (service_id, zone, min_weight_g, max_weight_g, cost_cents) values
  ('00000000-0000-4000-8000-0000000028e1', 'peninsula', 1, 30000, 495),
  ('00000000-0000-4000-8000-0000000028e1', 'baleares', 1, 30000, 995),
  ('00000000-0000-4000-8000-0000000028e2', 'peninsula', 1, 30000, 895);
insert into public.discount_codes (code, kind, percent_bp, once_per_email) values
  ('ENVIO10', 'percent', 1000, false),
  ('ENVIO30', 'percent', 3000, false);

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
-- Cesta con c1 (40 €) y c2 (20 €).
create function pg_temp.items(c1 integer, c2 integer) returns jsonb
language sql as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000028c1', 'quantity', c1) x
    where c1 > 0
    union all
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000028c2', 'quantity', c2)
    where c2 > 0
  ) s;
$$;
create function pg_temp.save(
  p_name text, p_min integer, p_zones text[],
  p_ends timestamptz default now() + interval '7 days',
  p_starts timestamptz default null, p_active boolean default true,
  p_id uuid default null
) returns public.shipping_promotions
language sql as $$
  select public.admin_save_shipping_promotion(
    p_id, p_name, p_min, p_zones, p_starts, p_ends, p_active);
$$;
-- Envío a la península (08860) o a Baleares (07001) con el servicio elegido,
-- un código y el descuento y el envío enseñados.
create function pg_temp.buy(
  p_request uuid, p_items jsonb, p_postal text default '08860',
  p_service text default 'e1', p_code text default null,
  p_expected_shipping integer default null
) returns jsonb
language sql as $$
  select public.web_order_create(
    p_request, 'es', 'shipping',
    (select id from public.stock_locations where code = 'castelldefels'),
    p_items,
    jsonb_build_object('full_name', 'Cliente', 'email', 'envio@test.invalid',
      'phone', '600000000', 'address_line1', 'Carrer de Prova 1',
      'postal_code', p_postal, 'city', 'Ciudad'),
    'redsys', 30, p_code,
    p_shipping_service_id => case p_service
      when 'e1' then '00000000-0000-4000-8000-0000000028e1'::uuid
      else '00000000-0000-4000-8000-0000000028e2'::uuid end,
    p_expected_shipping_cents => p_expected_shipping);
$$;
create function pg_temp.ref(p_request uuid) returns text
language sql as $$
  select a.reference from public.order_payment_attempts a
  join public.orders o on o.id = a.order_id
  where o.request_id = p_request order by a.created_at desc limit 1;
$$;
grant execute on function
  pg_temp.items(integer, integer),
  pg_temp.save(text, integer, text[], timestamptz, timestamptz, boolean, uuid),
  pg_temp.buy(uuid, jsonb, text, text, text, integer),
  pg_temp.ref(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tabla, copia diaria y superficie
-- ---------------------------------------------------------------------------

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'shipping_promotions'
      and (not c.relrowsecurity
           or has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate')
           or has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate'))$$,
  'envío gratis con RLS, sin escritura directa y sin nada para anon');
select ok(
  (select array_agg(table_name::text order by sort_order)
   from private.control_export_tables()
   where table_name in ('promotions', 'shipping_promotions', 'orders'))
  = array['promotions', 'shipping_promotions', 'orders'],
  'la copia diaria incluye el envío gratis después de las promociones y antes que los pedidos');
select ok(
  not has_function_privilege('anon', 'private.live_shipping_promotion(text)', 'execute')
  and not has_function_privilege('service_role', 'private.live_shipping_promotion(text)', 'execute'),
  'el cálculo interno no se llama desde fuera');
select ok(
  has_function_privilege('anon', 'public.web_shipping_quote(jsonb)', 'execute'),
  'la tienda sigue preguntando las opciones de envío sin sesión');
select ok(
  not has_function_privilege('anon',
    'public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid, integer, integer)',
    'execute')
  and not has_function_privilege('authenticated',
    'public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid, integer, integer)',
    'execute')
  and has_function_privilege('service_role',
    'public.web_order_create(uuid, text, text, uuid, jsonb, jsonb, text, integer, text, uuid, uuid, integer, integer)',
    'execute'),
  'el pedido sigue siendo solo del servidor');
select ok(not has_function_privilege('anon',
  'public.admin_save_shipping_promotion(uuid, text, integer, text[], timestamptz, timestamptz, boolean)',
  'execute'), 'anon no crea promociones de envío');

-- ---------------------------------------------------------------------------
-- Panel: crear y cambiar
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000283', 'aal2');
select throws_ok($$select pg_temp.save('Lanzamiento', 3000, '{peninsula}')$$,
  '42501', 'forbidden', 'el encargado no crea promociones de envío');
select pg_temp.act_as('00000000-0000-4000-8000-000000000282', 'aal1');
select throws_ok($$select pg_temp.save('Lanzamiento', 3000, '{peninsula}')$$,
  '42501', 'forbidden', 'sin MFA tampoco');

select pg_temp.act_as('00000000-0000-4000-8000-000000000282', 'aal2');
select is((pg_temp.save(' Lanzamiento ', 3000, '{baleares,peninsula,peninsula}')).zones,
  array['peninsula', 'baleares'],
  'la tienda crea una (desde 30 €): las zonas sin repetir, la península primero');
select is((select name from public.shipping_promotions where min_items_cents = 3000),
  'Lanzamiento', 'con el nombre sin espacios');
select throws_ok($$select pg_temp.save('Sin fin', 0, '{peninsula}', null)$$,
  '22023', 'invalid_shipping_promotion', 'la fecha de fin es obligatoria');
select throws_ok(
  $$select pg_temp.save('Al revés', 0, '{peninsula}', now(), now() + interval '1 day')$$,
  '22023', 'invalid_shipping_promotion', 'el final va después del inicio');
select throws_ok($$select pg_temp.save('Sin zonas', 0, '{}')$$,
  '22023', 'invalid_shipping_promotion', 'al menos una zona');
select throws_ok($$select pg_temp.save('Canarias', 0, '{canarias}')$$,
  '22023', 'invalid_shipping_promotion', 'solo las zonas con envío');
select throws_ok($$select pg_temp.save('Nula', 0, array['peninsula', null])$$,
  '22023', 'invalid_shipping_promotion', 'sin zonas vacías');
select throws_ok($$select pg_temp.save('Negativa', -100, '{peninsula}')$$,
  '22023', 'invalid_shipping_promotion', 'el mínimo no es negativo');
select throws_ok($$select pg_temp.save('', 0, '{peninsula}')$$,
  '22023', 'invalid_shipping_promotion', 'necesita un nombre');

select pg_temp.save('Todo pedido', 0, '{baleares}', now() + interval '3 days');
select pg_temp.save('Futura', 0, '{peninsula}', now() + interval '5 days', now() + interval '1 day');
select pg_temp.save('Pasada', 0, '{peninsula}', now() - interval '1 minute', now() - interval '5 days');
select pg_temp.save('Apagada', 0, '{peninsula}', now() + interval '5 days', null, false);
select pg_temp.save('Peor', 12000, '{peninsula}', now() + interval '5 days');

select is(
  (pg_temp.save('Lanzamiento', 3000, '{peninsula,baleares}', now() + interval '10 days',
     null, true, (select id from public.shipping_promotions where name = 'Lanzamiento'))).ends_at
    > now() + interval '9 days',
  true, 'se puede cambiar (aquí, alargarla)');
select is((select count(*)::int from public.shipping_promotions), 6,
  'la tienda las ve');

select pg_temp.act_as('00000000-0000-4000-8000-000000000282', 'aal1');
select is((select count(*)::int from public.shipping_promotions), 0,
  'sin MFA no se ven');
select pg_temp.act_as('00000000-0000-4000-8000-000000000283', 'aal2');
select is((select count(*)::int from public.shipping_promotions), 0,
  'el encargado no las ve');
select throws_ok('select * from public.admin_list_shipping_promotions()',
  '42501', 'forbidden', 'ni su lista con usos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000284', 'aal2');
select is((select count(*)::int from public.shipping_promotions), 0,
  'una sesión sin ficha de personal tampoco');
select throws_ok($$update public.shipping_promotions set active = false$$,
  '42501', null, 'nadie escribe directamente');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.shipping_promotions$$,
  '42501', null, 'el público no lee la tabla');

-- ---------------------------------------------------------------------------
-- Tienda: lo que enseñan la cesta y «Finalizar compra»
-- ---------------------------------------------------------------------------

select is(
  public.web_shipping_quote(pg_temp.items(1, 0)) #>> '{zones,0,promotion,min_items_cents}',
  '3000',
  'en la península vale la de mínimo más bajo que mejora el de la zona (30 € frente a 100 €)');
select ok(
  (public.web_shipping_quote(pg_temp.items(1, 0)) #>> '{zones,0,promotion,ends_at}')::timestamptz
    > now() + interval '9 days',
  'con su final, para decir «hasta el…»');
select is(
  public.web_shipping_quote(pg_temp.items(1, 0)) #>> '{zones,0,free_from_cents}', '10000',
  'el mínimo de la zona sigue ahí');
select is(
  public.web_shipping_quote(pg_temp.items(1, 0)) #>> '{zones,1,promotion,min_items_cents}', '0',
  'en Baleares vale la de cualquier pedido');
select ok(
  public.web_shipping_quote(pg_temp.items(1, 0))::text !~ '(Lanzamiento|Todo pedido|"name")',
  'sin el nombre interno');

-- ---------------------------------------------------------------------------
-- Tienda: pedidos con el envío regalado
-- ---------------------------------------------------------------------------

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select results_eq(
  $$select (s ->> 'shipping_cents')::int, (s ->> 'total_cents')::int
    from pg_temp.buy('00000000-0000-4000-8000-0000000028d1', pg_temp.items(1, 0)) s$$,
  $$values (0, 4000)$$,
  '40 € a la península pasan de 30 €: el envío es gratis');
select results_eq(
  $$select shipping_promotion_name, shipping_promotion_cents, shipping_service_label
    from public.orders where request_id = '00000000-0000-4000-8000-0000000028d1'$$,
  $$values ('Lanzamiento'::text, 495, 'Transportista · Estándar'::text)$$,
  'el pedido anota la promoción y lo que habría costado');
select is(
  (select detail ->> 'shipping_promotion' from public.order_events e
   join public.orders o on o.id = e.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000028d1' and e.kind = 'created'),
  'Lanzamiento', 'la cronología la cuenta');
select ok(
  public.web_order_status(
    (select id from public.orders where request_id = '00000000-0000-4000-8000-0000000028d1'))::text
    !~ '(Lanzamiento|shipping_promotion)',
  'la página del pedido no ve el nombre interno');

-- El pedido se lee en otra sentencia: la que lo crea no lo ve (§136).
select pg_temp.buy('00000000-0000-4000-8000-0000000028d2', pg_temp.items(0, 1));
select results_eq(
  $$select shipping_cents, shipping_promotion_id from public.orders
    where request_id = '00000000-0000-4000-8000-0000000028d2'$$,
  $$values (495, null::uuid)$$,
  'con 20 € no llega: se cobra el envío');
select pg_temp.buy('00000000-0000-4000-8000-0000000028d3', pg_temp.items(1, 0), '08860', 'e2');
select results_eq(
  $$select shipping_cents, shipping_promotion_id from public.orders
    where request_id = '00000000-0000-4000-8000-0000000028d3'$$,
  $$values (895, null::uuid)$$,
  'un servicio que no cuenta para el envío gratis se cobra siempre');
select pg_temp.buy('00000000-0000-4000-8000-0000000028d4', pg_temp.items(3, 0));
select results_eq(
  $$select shipping_cents, shipping_promotion_id from public.orders
    where request_id = '00000000-0000-4000-8000-0000000028d4'$$,
  $$values (0, null::uuid)$$,
  'con 120 € ya lo regala la zona: el pedido no anota la promoción');
select pg_temp.buy('00000000-0000-4000-8000-0000000028d5', pg_temp.items(1, 0),
  '08860', 'e1', 'ENVIO10');
select results_eq(
  $$select discount_cents, shipping_cents, total_cents, shipping_promotion_name
    from public.orders where request_id = '00000000-0000-4000-8000-0000000028d5'$$,
  $$values (400, 0, 3600, 'Lanzamiento'::text)$$,
  'se suma a un código: 36 € pagados siguen pasando de 30 €');
select results_eq(
  $$select (s ->> 'discount_cents')::int, (s ->> 'shipping_cents')::int
    from pg_temp.buy('00000000-0000-4000-8000-0000000028d6', pg_temp.items(1, 0),
      '08860', 'e1', 'ENVIO30') s$$,
  $$values (1200, 495)$$,
  'el mínimo mira lo pagado tras el descuento: 28 € no llegan');
select pg_temp.buy('00000000-0000-4000-8000-0000000028d7', pg_temp.items(0, 1), '07001');
select results_eq(
  $$select shipping_cents, shipping_promotion_name, shipping_promotion_cents
    from public.orders where request_id = '00000000-0000-4000-8000-0000000028d7'$$,
  $$values (0, 'Todo pedido'::text, 995)$$,
  'en Baleares, cualquier pedido va gratis');

-- Lo enseñado manda: nunca se cobra más envío.
select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000028d8', pg_temp.items(0, 1),
      '08860', 'e1', null, 0)$$,
  '22023', 'shipping_changed', 'si el envío sale más caro que el enseñado, no hay pedido');
select is(
  (select count(*)::int from public.orders
   where request_id = '00000000-0000-4000-8000-0000000028d8'),
  0, 'ni deja nada a medias');
select is(
  (pg_temp.buy('00000000-0000-4000-8000-0000000028d9', pg_temp.items(1, 0),
     '08860', 'e1', null, 495) ->> 'shipping_cents')::int,
  0, 'si sale más barato que el enseñado, el pedido sale');
select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000028da', pg_temp.items(1, 0),
      '08860', 'e1', null, -1)$$,
  '22023', 'invalid_order', 'el envío enseñado no es negativo');

-- Cobro por el total con el envío regalado.
select is(
  public.web_order_record_payment('redsys',
    pg_temp.ref('00000000-0000-4000-8000-0000000028d1'), 'tx-envio-1', 'succeeded', 4000, 'EUR')
  ->> 'action',
  'confirm', 'el banco cobra el total sin envío y el pedido queda pagado');

-- Una promoción que termina: el pedido que la enseñaba no sale.
reset role;
update public.shipping_promotions set active = false where name = 'Lanzamiento';
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000028db', pg_temp.items(1, 0),
      '08860', 'e1', null, 0)$$,
  '22023', 'shipping_changed', 'apagada la promoción, el pedido que la enseñaba no sale');
select pg_temp.buy('00000000-0000-4000-8000-0000000028dc', pg_temp.items(1, 0));
select results_eq(
  $$select shipping_cents, shipping_promotion_id from public.orders
    where request_id = '00000000-0000-4000-8000-0000000028dc'$$,
  $$values (495, null::uuid)$$,
  'al volver a confirmar sin ella, se cobra el envío');
select ok(
  public.web_shipping_quote(pg_temp.items(1, 0)) #> '{zones,0,promotion}' = 'null'::jsonb,
  'y la tienda ya no la enseña (la que queda no mejora los 100 € de la zona)');
select is(
  (select shipping_promotion_name from public.orders
   where request_id = '00000000-0000-4000-8000-0000000028d1'),
  'Lanzamiento', 'los pedidos hechos la conservan');

-- ---------------------------------------------------------------------------
-- Usos en el panel e integridad
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000282', 'aal2');
select results_eq(
  $$select uses, paid_uses, paid_waived_cents
    from public.admin_list_shipping_promotions() where name = 'Lanzamiento'$$,
  $$values (3, 1, 495::bigint)$$,
  'la lista cuenta los pedidos vivos, los cobrados y el envío regalado en ellos');
select is(
  (pg_temp.save('Lanzamiento bis', 3000, '{peninsula}', now() + interval '10 days',
     null, false, (select id from public.shipping_promotions where name = 'Lanzamiento'))).name,
  'Lanzamiento bis', 'cambiar el nombre después');
select is(
  (select shipping_promotion_name from public.orders
   where request_id = '00000000-0000-4000-8000-0000000028d1'),
  'Lanzamiento', 'no reescribe los pedidos');

reset role;
select is(
  (select array_agg(action order by id) from public.audit_log
   where entity = 'shipping_promotion'
     and entity_id = (select id::text from public.shipping_promotions where name = 'Lanzamiento bis')),
  array['promotions.shipping_promotion_create', 'promotions.shipping_promotion_update',
        'promotions.shipping_promotion_update'],
  'el alta y los cambios quedan en la auditoría');
select throws_ok(
  $$update public.orders set shipping_promotion_name = null
    where request_id = '00000000-0000-4000-8000-0000000028d1'$$,
  '23514', null, 'una promoción de envío no va sin su nombre copiado');
select throws_ok(
  $$update public.orders
    set shipping_promotion_id = (select id from public.shipping_promotions where name = 'Todo pedido'),
        shipping_promotion_name = 'Todo pedido', shipping_promotion_cents = 495
    where request_id = '00000000-0000-4000-8000-0000000028d2'$$,
  '23514', null, 'ni en un pedido que paga el envío');
select throws_ok(
  $$delete from public.shipping_promotions where name = 'Lanzamiento bis'$$,
  '23503', null, 'una promoción con pedidos no se borra: se apaga');

select * from finish();
rollback;
