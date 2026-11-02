-- Promociones automáticas (DECISIONS §186): solo promotions.manage con MFA las
-- crea y las ve; la tienda pregunta las vivas sin ver su nombre interno; el
-- descuento sale de la base (porcentaje o importe desde un mínimo, de una casa
-- o de todas, sin rebajados si lo pide, con fechas) y no se suma a un código:
-- va el que más descuenta y, si empatan, la promoción. Un pedido no se crea
-- si su descuento es menor que el que se enseñó. Datos ficticios; la
-- transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(59);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000271', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000272', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000273', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000274', 'cliente@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000271', 'system_admin'),
  ('00000000-0000-4000-8000-000000000272', 'store_admin'),
  ('00000000-0000-4000-8000-000000000273', 'viewer');

-- Dos casas: A con un formato a PVP (40 €) y otro rebajado (20 €, antes 30 €);
-- B con uno a 50 €.
insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000027b1', 'casa-promo-a', 'Casa A'),
  ('00000000-0000-4000-8000-0000000027b2', 'casa-promo-b', 'Casa B');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000027a1', '00000000-0000-4000-8000-0000000027b1',
   'perfume-promo-a', 'Perfume A'),
  ('00000000-0000-4000-8000-0000000027a2', '00000000-0000-4000-8000-0000000027b2',
   'perfume-promo-b', 'Perfume B');
-- La guarda Ómnibus pide un historial de 30 días que esta base no tiene: se
-- aparta solo para estas filas.
alter table public.product_variants disable trigger compare_price_guard;
insert into public.product_variants
  (id, product_id, size_ml, retail_price_cents, compare_at_price_cents, shipping_weight_g) values
  ('00000000-0000-4000-8000-0000000027c1', '00000000-0000-4000-8000-0000000027a1', 100, 4000, null, 300),
  ('00000000-0000-4000-8000-0000000027c2', '00000000-0000-4000-8000-0000000027a1', 50, 2000, 3000, 300),
  ('00000000-0000-4000-8000-0000000027c3', '00000000-0000-4000-8000-0000000027a2', 100, 5000, null, 300);
alter table public.product_variants enable trigger compare_price_guard;
update public.products set status = 'published'
  where id in ('00000000-0000-4000-8000-0000000027a1', '00000000-0000-4000-8000-0000000027a2');
insert into public.inventory_levels (variant_id, location_id, on_hand)
select v.id, l.id, 100
from (values ('00000000-0000-4000-8000-0000000027c1'::uuid),
             ('00000000-0000-4000-8000-0000000027c2'::uuid),
             ('00000000-0000-4000-8000-0000000027c3'::uuid)) v(id)
cross join public.stock_locations l where l.code = 'castelldefels';
-- Envío gratis desde 75 € de artículos, con un servicio de tramo único.
insert into public.shipping_rates (zone, price_cents, free_from_cents, active)
values ('peninsula', null, 7500, true)
on conflict (zone) do update
  set price_cents = null, free_from_cents = 7500, active = true;
insert into public.shipping_settings (sender_name, address_line1, postal_code, city,
  phone, email, packaging_weight_g, shipping_vat_bps)
values ('Tienda de promociones', 'Carrer de la Tenda 1', '08860', 'Castelldefels',
  '600000000', 'tienda-promociones@test.invalid', 0, 0);
insert into public.shipping_services (id, provider, code, carrier_code, carrier_name,
  name, zones, active)
values ('00000000-0000-4000-8000-0000000027e1', 'manual', 'prueba-27', 'prueba',
  'Transportista', 'Estándar', '{peninsula}', true);
insert into internal.shipping_service_rates (service_id, zone, min_weight_g, max_weight_g, cost_cents)
values ('00000000-0000-4000-8000-0000000027e1', 'peninsula', 1, 30000, 495);

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
-- Cesta con a1 (40 €), a2 (rebajado, 20 €) y b1 (50 €).
create function pg_temp.items(a1 integer, a2 integer, b1 integer) returns jsonb
language sql as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000027c1', 'quantity', a1) x
    where a1 > 0
    union all
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000027c2', 'quantity', a2)
    where a2 > 0
    union all
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000027c3', 'quantity', b1)
    where b1 > 0
  ) s;
$$;
create function pg_temp.save(
  p_name text, p_kind text, p_value integer, p_min integer,
  p_brand uuid default null, p_exclude boolean default false,
  p_starts timestamptz default null, p_ends timestamptz default null,
  p_active boolean default true, p_id uuid default null
) returns public.promotions
language sql as $$
  select public.admin_save_promotion(
    p_id, p_name, p_kind,
    case when p_kind = 'percent' then p_value end,
    case when p_kind = 'amount' then p_value end,
    p_min, p_brand, p_exclude, p_starts, p_ends, p_active);
$$;
-- Lo que la tienda enseña de una promoción para una cesta.
create function pg_temp.quote(p_name text, p_items jsonb) returns jsonb
language sql as $$
  select q from jsonb_array_elements(public.web_promotions_quote(p_items)) q
  where (q ->> 'id')::uuid = (select id from public.promotions where name = p_name);
$$;
-- Recogida (o envío a la península) con un código y el descuento enseñado.
create function pg_temp.buy(
  p_request uuid, p_items jsonb, p_code text default null,
  p_expected integer default null, p_fulfillment text default 'click_collect'
) returns jsonb
language sql as $$
  select public.web_order_create(
    p_request, 'es', p_fulfillment,
    (select id from public.stock_locations where code = 'castelldefels'),
    p_items,
    jsonb_build_object('full_name', 'Cliente', 'email', 'promo@test.invalid',
      'phone', '600000000', 'address_line1', 'Carrer de Prova 1',
      'postal_code', '08860', 'city', 'Castelldefels'),
    'redsys', 30, p_code,
    p_shipping_service_id => case when p_fulfillment = 'shipping'
      then '00000000-0000-4000-8000-0000000027e1'::uuid end,
    p_expected_discount_cents => p_expected);
$$;
create function pg_temp.ref(p_request uuid) returns text
language sql as $$
  select a.reference from public.order_payment_attempts a
  join public.orders o on o.id = a.order_id
  where o.request_id = p_request order by a.created_at desc limit 1;
$$;
grant execute on function
  pg_temp.items(integer, integer, integer),
  pg_temp.save(text, text, integer, integer, uuid, boolean, timestamptz, timestamptz,
               boolean, uuid),
  pg_temp.quote(text, jsonb),
  pg_temp.buy(uuid, jsonb, text, integer, text),
  pg_temp.ref(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Tabla y copia diaria
-- ---------------------------------------------------------------------------

select is_empty(
  $$select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'promotions'
      and (not c.relrowsecurity
           or has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate')
           or has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate'))$$,
  'promociones con RLS, sin escritura directa y sin nada para anon');
select ok(
  (select array_agg(table_name::text order by sort_order)
   from private.control_export_tables()
   where table_name in ('brands', 'promotions', 'orders'))
  = array['brands', 'promotions', 'orders'],
  'la copia diaria incluye las promociones después de las casas y antes que los pedidos');
select ok(
  not has_function_privilege('anon', 'private.promotion_quotes(jsonb)', 'execute')
  and not has_function_privilege('service_role', 'private.best_promotion(jsonb)', 'execute'),
  'el cálculo interno no se llama desde fuera');

-- ---------------------------------------------------------------------------
-- Panel: crear y cambiar promociones
-- ---------------------------------------------------------------------------

select ok(not has_function_privilege('anon',
  'public.admin_save_promotion(uuid, text, text, integer, integer, integer, uuid, boolean, timestamptz, timestamptz, boolean)',
  'execute'), 'anon no crea promociones');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000273', 'aal2');
select throws_ok($$select pg_temp.save('Todo 10', 'percent', 1000, 10000)$$,
  '42501', 'forbidden', 'el encargado no crea promociones');
select pg_temp.act_as('00000000-0000-4000-8000-000000000272', 'aal1');
select throws_ok($$select pg_temp.save('Todo 10', 'percent', 1000, 10000)$$,
  '42501', 'forbidden', 'sin MFA no se crean promociones');

select pg_temp.act_as('00000000-0000-4000-8000-000000000272', 'aal2');
select is((pg_temp.save(' Todo 10 ', 'percent', 1000, 10000)).name, 'Todo 10',
  'la tienda crea una promoción (−10 % desde 100 €)');
select throws_ok($$select pg_temp.save('Mucho', 'percent', 9500, 10000)$$,
  '22023', 'invalid_promotion', 'como mucho un 90 %');
select throws_ok($$select pg_temp.save('Sin mínimo', 'percent', 1000, null)$$,
  '22023', 'invalid_promotion', 'el importe mínimo es obligatorio');
select throws_ok($$select pg_temp.save('Gratis', 'amount', 5000, 4000)$$,
  '22023', 'invalid_promotion', 'un importe fijo tiene que quedar por debajo del mínimo');
select throws_ok($$select pg_temp.save('', 'percent', 1000, 10000)$$,
  '22023', 'invalid_promotion', 'necesita un nombre');
select throws_ok(
  $$select pg_temp.save('Fechas', 'percent', 1000, 10000, null, false, now(), now() - interval '1 day')$$,
  '22023', 'invalid_promotion', 'el final va después del inicio');
select throws_ok(
  $$select pg_temp.save('Casa rara', 'percent', 1000, 10000, gen_random_uuid())$$,
  '22023', 'unknown_brand', 'la casa tiene que existir');

select pg_temp.save('Casa A 15', 'percent', 1500, 6000,
  '00000000-0000-4000-8000-0000000027b1', true);
select pg_temp.save('Casa B 5', 'amount', 500, 5000, '00000000-0000-4000-8000-0000000027b2');
select pg_temp.save('Futura', 'percent', 2000, 1000, null, false, now() + interval '1 day');
select pg_temp.save('Pasada', 'percent', 2000, 1000, null, false, null, now() - interval '1 minute');
select pg_temp.save('Apagada', 'percent', 2000, 1000, null, false, null, null, false);

select is(
  (pg_temp.save('Casa B 5', 'amount', 500, 5000, '00000000-0000-4000-8000-0000000027b2',
     false, null, now() + interval '30 days', true,
     (select id from public.promotions where name = 'Casa B 5'))).ends_at is not null,
  true, 'se puede cambiar (aquí, ponerle fin)');
select is((select count(*)::int from public.promotions), 6,
  'la tienda ve las promociones');
select is(
  (select brand_name from public.admin_list_promotions() where name = 'Casa A 15'),
  'Casa A', 'la lista del panel lleva el nombre de la casa');

select pg_temp.act_as('00000000-0000-4000-8000-000000000272', 'aal1');
select is((select count(*)::int from public.promotions), 0,
  'sin MFA no se ven las promociones');
select pg_temp.act_as('00000000-0000-4000-8000-000000000273', 'aal2');
select is((select count(*)::int from public.promotions), 0,
  'el encargado no ve las promociones');
select throws_ok('select * from public.admin_list_promotions()',
  '42501', 'forbidden', 'ni su lista con usos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000274', 'aal2');
select is((select count(*)::int from public.promotions), 0,
  'una sesión sin ficha de personal tampoco');
select throws_ok($$update public.promotions set active = false$$,
  '42501', null, 'nadie escribe directamente');
reset role;
set local role anon;
select throws_ok($$select count(*) from public.promotions$$,
  '42501', null, 'el público no lee la tabla');

-- ---------------------------------------------------------------------------
-- Tienda: lo que enseñan la cesta y «Finalizar compra»
-- ---------------------------------------------------------------------------

select is(jsonb_array_length(public.web_promotions_quote(pg_temp.items(1, 0, 0))), 3,
  'el público ve solo las vivas: ni las futuras, ni las pasadas, ni las apagadas');
select ok(
  not exists (
    select 1 from jsonb_array_elements(public.web_promotions_quote(pg_temp.items(1, 0, 0))) q
    where q ? 'name' or q ? 'created_by' or q ? 'active'),
  'sin el nombre interno ni datos del personal');

-- El resto, desde el servidor (pg_temp.quote busca la promoción por nombre).
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select is(pg_temp.quote('Casa A 15', pg_temp.items(1, 0, 0)) ->> 'brand_name', 'Casa A',
  'dice de qué casa es');
select results_eq(
  $$select (q ->> 'eligible_cents')::int, (q ->> 'discount_cents')::int
    from pg_temp.quote('Todo 10', pg_temp.items(1, 0, 0)) q$$,
  $$values (4000, 0)$$,
  'con 40 € no llega a los 100 €: no descuenta y cuenta lo que hay');
select is(
  (pg_temp.quote('Casa A 15', pg_temp.items(2, 0, 0)) ->> 'discount_cents')::int, 1200,
  '80 € de la casa A pasan de 60 €: 15 % son 12 €');
select is(
  (pg_temp.quote('Casa A 15', pg_temp.items(1, 1, 0)) ->> 'discount_cents')::int, 0,
  'los rebajados no cuentan para llegar al mínimo si la promoción los excluye');
select is(
  (pg_temp.quote('Casa A 15', pg_temp.items(1, 0, 5)) ->> 'eligible_cents')::int, 4000,
  'los perfumes de otra casa no cuentan');
select is(
  (pg_temp.quote('Todo 10', pg_temp.items(2, 1, 0)) ->> 'discount_cents')::int, 1000,
  'sin casa ni exclusión cuentan todos, también los rebajados');
select is(
  (pg_temp.quote('Casa B 5', pg_temp.items(0, 0, 1)) ->> 'discount_cents')::int, 500,
  'un importe fijo desde 50 € en la casa B');
select is(
  public.web_promotions_quote(pg_temp.items(3, 0, 1)) -> 0 ->> 'discount_cents', '1800',
  'la que más descuenta va primero (15 % de 120 € frente a 10 % de 170 €)');

-- ---------------------------------------------------------------------------
-- Tienda: pedidos con promoción
-- ---------------------------------------------------------------------------

-- Un código del 5 %, otro del 50 % y uno de 12 € para comparar.
reset role;
insert into public.discount_codes (code, kind, percent_bp, amount_cents, once_per_email) values
  ('PROMO5', 'percent', 500, null, false),
  ('PROMO50', 'percent', 5000, null, false),
  ('PROMO12', 'amount', null, 1200, false);
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select pg_temp.buy('00000000-0000-4000-8000-0000000027d1', pg_temp.items(2, 0, 0), null, 1200);
select results_eq(
  $$select o.discount_code, p.name, o.promotion_name, o.discount_cents, o.total_cents
    from public.orders o join public.promotions p on p.id = o.promotion_id
    where o.request_id = '00000000-0000-4000-8000-0000000027d1'$$,
  $$values (null::text, 'Casa A 15'::text, 'Casa A 15'::text, 1200, 6800)$$,
  'sin código, el pedido lleva la mejor promoción y su nombre copiado');
select is(
  (select detail ->> 'promotion' from public.order_events e
   join public.orders o on o.id = e.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000027d1' and e.kind = 'created'),
  'Casa A 15', 'la cronología la cuenta');
select results_eq(
  $$select (s ->> 'discount_cents')::int, s ->> 'discount_code'
    from public.web_order_status(
      (select id from public.orders where request_id = '00000000-0000-4000-8000-0000000027d1')) s$$,
  $$values (1200, null::text)$$,
  'la página del pedido ve el descuento, sin código');
select ok(
  not (public.web_order_status(
    (select id from public.orders where request_id = '00000000-0000-4000-8000-0000000027d1'))
    ? 'promotion_name'),
  'ni el nombre interno de la promoción');

select pg_temp.buy('00000000-0000-4000-8000-0000000027d2', pg_temp.items(2, 0, 0), 'promo5');
select results_eq(
  $$select discount_code, promotion_name, discount_cents from public.orders
    where request_id = '00000000-0000-4000-8000-0000000027d2'$$,
  $$values (null::text, 'Casa A 15'::text, 1200)$$,
  'con un código que descuenta menos (4 €), va la promoción (12 €): no se suman');
select is(
  (select count(*)::int from public.orders o
   join public.discount_codes d on d.id = o.discount_code_id where d.code = 'PROMO5'),
  0, 'y el código no se gasta');

select pg_temp.buy('00000000-0000-4000-8000-0000000027d3', pg_temp.items(2, 0, 0), 'PROMO50');
select results_eq(
  $$select discount_code, promotion_id, discount_cents, total_cents from public.orders
    where request_id = '00000000-0000-4000-8000-0000000027d3'$$,
  $$values ('PROMO50'::text, null::uuid, 4000, 4000)$$,
  'con un código que descuenta más (40 €), va el código');

select pg_temp.buy('00000000-0000-4000-8000-0000000027d4', pg_temp.items(2, 0, 0), 'PROMO12');
select results_eq(
  $$select discount_code, promotion_name, discount_cents from public.orders
    where request_id = '00000000-0000-4000-8000-0000000027d4'$$,
  $$values (null::text, 'Casa A 15'::text, 1200)$$,
  'si empatan, va la promoción y el código queda libre');

select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000027d5', pg_temp.items(2, 0, 0), 'NOEXISTE')$$,
  '22023', 'discount_invalid', 'un código malo sigue rechazándose aunque haya promoción');

select pg_temp.buy('00000000-0000-4000-8000-0000000027d6', pg_temp.items(2, 0, 0), null, 0);
select is(
  (select discount_cents from public.orders
   where request_id = '00000000-0000-4000-8000-0000000027d6'),
  1200, 'si descuenta más de lo que se enseñó, el pedido sale (nunca se cobra más)');
select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000027d7', pg_temp.items(2, 0, 0), null, 1500)$$,
  '22023', 'discount_changed', 'si descuenta menos de lo que se enseñó, no hay pedido');
select is(
  (select count(*)::int from public.orders
   where request_id = '00000000-0000-4000-8000-0000000027d7'),
  0, 'ni deja nada a medias');

-- Envío gratis desde 75 €: con la promoción ya descontada.
select results_eq(
  $$select (s ->> 'discount_cents')::int, (s ->> 'shipping_cents')::int,
           (s ->> 'total_cents')::int
    from pg_temp.buy('00000000-0000-4000-8000-0000000027d8', pg_temp.items(2, 0, 0),
      null, null, 'shipping') s$$,
  $$values (1200, 495, 7295)$$,
  'con la promoción los artículos bajan a 68 € y el envío se cobra');
select results_eq(
  $$select (s ->> 'discount_cents')::int, (s ->> 'shipping_cents')::int
    from pg_temp.buy('00000000-0000-4000-8000-0000000027d9', pg_temp.items(0, 0, 2),
      null, null, 'shipping') s$$,
  $$values (1000, 0)$$,
  'con 100 € de la casa B gana el 10 % de todo (10 €) a los 5 € de la casa, y el envío sigue gratis');

-- Cobro por el importe con la promoción.
select is(
  public.web_order_record_payment('redsys',
    pg_temp.ref('00000000-0000-4000-8000-0000000027d1'), 'tx-promo-1', 'succeeded', 6800, 'EUR')
  ->> 'action',
  'confirm', 'el banco cobra el total con la promoción y el pedido queda pagado');
select results_eq(
  $$select (j ->> 'discount_cents')::int, j ->> 'discount_code'
    from jsonb_array_elements(public.web_order_emails_claim(50)) j
    where (j ->> 'number')::bigint = (select number from public.orders
      where request_id = '00000000-0000-4000-8000-0000000027d1')$$,
  $$values (1200, null::text)$$,
  'el correo de confirmación lleva el descuento, sin código');

-- Una promoción que termina: el pedido que la esperaba no sale.
reset role;
update public.promotions set active = false where name = 'Casa A 15';
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000027da', pg_temp.items(2, 0, 0), null, 1200)$$,
  '22023', 'discount_changed', 'apagada la promoción, el pedido que la enseñaba no sale');
select results_eq(
  $$select (s ->> 'discount_cents')::int, (s ->> 'total_cents')::int
    from pg_temp.buy('00000000-0000-4000-8000-0000000027db', pg_temp.items(2, 0, 0)) s$$,
  $$values (0, 8000)$$,
  'al volver a confirmar sin ella, se cobra el precio completo');
select is(
  (select promotion_id from public.orders
   where request_id = '00000000-0000-4000-8000-0000000027d1')
  = (select id from public.promotions where name = 'Casa A 15'),
  true, 'los pedidos hechos la conservan');

-- ---------------------------------------------------------------------------
-- Usos en el panel e integridad
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000272', 'aal2');
select results_eq(
  $$select uses, paid_uses, paid_discount_cents
    from public.admin_list_promotions() where name = 'Casa A 15'$$,
  $$values (5, 1, 1200::bigint)$$,
  'la lista cuenta los pedidos vivos, los cobrados y lo descontado');
select is(
  (pg_temp.save('Casa A 15 bis', 'percent', 1500, 6000, '00000000-0000-4000-8000-0000000027b1',
     true, null, null, false,
     (select id from public.promotions where name = 'Casa A 15'))).name,
  'Casa A 15 bis', 'cambiar el nombre después');
select is(
  (select promotion_name from public.orders
   where request_id = '00000000-0000-4000-8000-0000000027d1'),
  'Casa A 15', 'no reescribe los pedidos');

reset role;
select is(
  (select array_agg(action order by id) from public.audit_log
   where entity = 'promotion'
     and entity_id = (select id::text from public.promotions where name = 'Casa B 5')),
  array['promotions.promotion_create', 'promotions.promotion_update'],
  'el alta y el cambio quedan en la auditoría');
select throws_ok(
  $$update public.orders
    set discount_code_id = (select id from public.discount_codes where code = 'PROMO5'),
        discount_code = 'PROMO5'
    where request_id = '00000000-0000-4000-8000-0000000027d1'$$,
  '23514', null, 'un pedido no lleva a la vez código y promoción');
select throws_ok(
  $$update public.orders set promotion_name = null
    where request_id = '00000000-0000-4000-8000-0000000027d1'$$,
  '23514', null, 'ni una promoción sin su nombre copiado');
select throws_ok(
  $$delete from public.promotions where name = 'Todo 10'$$,
  '23503', null, 'una promoción con pedidos no se borra: se apaga');
insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000027b3', 'casa-promo-c', 'Casa C');
insert into public.promotions (name, kind, percent_bp, min_items_cents, brand_id, active)
values ('Casa C', 'percent', 1000, 5000, '00000000-0000-4000-8000-0000000027b3', false);
select throws_ok(
  $$delete from public.brands where id = '00000000-0000-4000-8000-0000000027b3'$$,
  '23503', null, 'ni la casa de una promoción, aunque no tenga perfumes');

select * from finish();
rollback;
