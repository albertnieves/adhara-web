-- Códigos de descuento (DECISIONS §149–152): solo promotions.manage con MFA
-- crea y ve códigos; la tienda los comprueba en el servidor; el descuento
-- sale de la base (porcentaje o importe, compra mínima, fechas, usos máximos,
-- un uso por email, rebajados fuera si el código lo pide) y el envío gratis
-- se calcula ya descontado. Datos ficticios; la transacción se revierte.
-- (18 queda para la cuenta de cliente de la PR #37.)
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(49);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000191', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000192', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000193', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000194', 'cliente@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000191', 'system_admin'),
  ('00000000-0000-4000-8000-000000000192', 'store_admin'),
  ('00000000-0000-4000-8000-000000000193', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000019b1', 'marca-descuentos', 'Marca de descuentos');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000019a1', '00000000-0000-4000-8000-0000000019b1',
   'perfume-descuentos', 'Perfume de descuentos');
-- c1 a PVP; c2 rebajado (precio tachado). La guarda Ómnibus pide un
-- historial de 30 días que esta base no tiene: se aparta solo para esta fila.
alter table public.product_variants disable trigger compare_price_guard;
insert into public.product_variants
  (id, product_id, size_ml, retail_price_cents, compare_at_price_cents) values
  ('00000000-0000-4000-8000-0000000019c1', '00000000-0000-4000-8000-0000000019a1', 100, 4995, null),
  ('00000000-0000-4000-8000-0000000019c2', '00000000-0000-4000-8000-0000000019a1', 50, 2990, 3990);
alter table public.product_variants enable trigger compare_price_guard;
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000019a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select v.id, l.id, 50
from (values ('00000000-0000-4000-8000-0000000019c1'::uuid),
             ('00000000-0000-4000-8000-0000000019c2'::uuid)) v(id)
cross join public.stock_locations l where l.code = 'castelldefels';
insert into public.shipping_rates (zone, price_cents, free_from_cents, active)
values ('peninsula', 495, 7500, true)
on conflict (zone) do update
  set price_cents = 495, free_from_cents = 7500, active = true;

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
create function pg_temp.items(c1 integer, c2 integer) returns jsonb
language sql as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000019c1', 'quantity', c1) x
    where c1 > 0
    union all
    select jsonb_build_object('variant_id', '00000000-0000-4000-8000-0000000019c2', 'quantity', c2)
    where c2 > 0
  ) s;
$$;
-- Código de prueba con valores por defecto razonables.
create function pg_temp.save(
  p_code text, p_kind text, p_value integer,
  p_min integer default null, p_starts timestamptz default null,
  p_ends timestamptz default null, p_max integer default null,
  p_once boolean default true, p_exclude boolean default false,
  p_active boolean default true, p_id uuid default null
) returns public.discount_codes
language sql as $$
  select public.admin_save_discount_code(
    p_id, p_code, 'Campaña de prueba', p_kind,
    case when p_kind = 'percent' then p_value end,
    case when p_kind = 'amount' then p_value end,
    p_min, p_starts, p_ends, p_max, p_once, p_exclude, p_active);
$$;
create function pg_temp.quote(p_code text, p_items jsonb) returns jsonb
language sql as $$
  select public.web_order_discount_quote(p_code, p_items);
$$;
-- Recogida (o envío a la península) con un email y un código.
create function pg_temp.buy(
  p_request uuid, p_items jsonb, p_email text, p_code text,
  p_fulfillment text default 'click_collect'
) returns jsonb
language sql as $$
  select public.web_order_create(
    p_request, 'es', p_fulfillment,
    (select id from public.stock_locations where code = 'castelldefels'),
    p_items,
    jsonb_build_object('full_name', 'Cliente', 'email', p_email, 'phone', '600000000',
      'address_line1', 'Carrer de Prova 1', 'postal_code', '08860', 'city', 'Castelldefels'),
    'redsys', 30, p_code);
$$;
create function pg_temp.ref(p_request uuid) returns text
language sql as $$
  select a.reference from public.order_payment_attempts a
  join public.orders o on o.id = a.order_id
  where o.request_id = p_request order by a.created_at desc limit 1;
$$;
grant execute on function
  pg_temp.items(integer, integer),
  pg_temp.save(text, text, integer, integer, timestamptz, timestamptz, integer,
               boolean, boolean, boolean, uuid),
  pg_temp.quote(text, jsonb),
  pg_temp.buy(uuid, jsonb, text, text, text),
  pg_temp.ref(uuid)
  to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Panel: crear y cambiar códigos
-- ---------------------------------------------------------------------------

select ok(not has_function_privilege('anon',
  'public.admin_save_discount_code(uuid, text, text, text, integer, integer, integer, timestamptz, timestamptz, integer, boolean, boolean, boolean)',
  'execute'), 'anon no crea códigos');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000193', 'aal2');
select throws_ok($$select pg_temp.save('CLUB10', 'percent', 1000)$$,
  '42501', 'forbidden', 'el encargado no crea códigos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000192', 'aal1');
select throws_ok($$select pg_temp.save('CLUB10', 'percent', 1000)$$,
  '42501', 'forbidden', 'sin MFA no se crean códigos');

select pg_temp.act_as('00000000-0000-4000-8000-000000000192', 'aal2');
select is((pg_temp.save(' club10 ', 'percent', 1000)).code, 'CLUB10',
  'la tienda crea un código y se guarda en mayúsculas');
select throws_ok($$select pg_temp.save('CLUB10', 'amount', 500)$$,
  '23505', 'code_taken', 'no hay dos códigos iguales');
select throws_ok($$select pg_temp.save('MUCHO', 'percent', 9500)$$,
  '22023', 'invalid_discount', 'como mucho un 90 %');
select throws_ok($$select pg_temp.save('CERO', 'amount', null)$$,
  '22023', 'invalid_discount', 'un importe fijo necesita su importe');
select throws_ok($$select pg_temp.save('CON ESPACIO', 'percent', 1000)$$,
  '22023', 'invalid_discount', 'solo letras, números y guiones');
select throws_ok(
  $$select pg_temp.save('FECHAS', 'percent', 1000, null, now(), now() - interval '1 day')$$,
  '22023', 'invalid_discount', 'el final va después del inicio');

select pg_temp.save('MENOS5', 'amount', 500, 3000);
select pg_temp.save('GRANDE', 'amount', 5000);
select pg_temp.save('SOLO1', 'percent', 2000, null, null, null, 1, false);
select pg_temp.save('RAPIDO', 'percent', 1000, null, now() + interval '1 day');
select pg_temp.save('VIEJO', 'percent', 1000, null, null, now() - interval '1 minute');
select pg_temp.save('NOREBAJA', 'percent', 1000, null, null, null, null, true, true);
select pg_temp.save('APAGADO', 'percent', 1000, null, null, null, null, true, false, false);

select throws_ok(
  $$select pg_temp.save('CLUB11', 'percent', 1000, null, null, null, null, true, false, true,
    (select id from public.discount_codes where code = 'CLUB10'))$$,
  '22023', 'code_immutable', 'el texto del código no cambia después de crearlo');
select is(
  (pg_temp.save('CLUB10', 'percent', 1000, null, null, null, null, true, false, true,
    (select id from public.discount_codes where code = 'CLUB10'))).description,
  'Campaña de prueba', 'se puede cambiar el resto');
select is((select count(*)::int from public.discount_codes), 8,
  'la tienda ve los códigos');

select pg_temp.act_as('00000000-0000-4000-8000-000000000192', 'aal1');
select is((select count(*)::int from public.discount_codes), 0,
  'sin MFA no se ven los códigos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000193', 'aal2');
select is((select count(*)::int from public.discount_codes), 0,
  'el encargado no ve los códigos');
select throws_ok('select * from public.admin_list_discount_codes()',
  '42501', 'forbidden', 'ni su lista con usos');
select pg_temp.act_as('00000000-0000-4000-8000-000000000194', 'aal2');
select is((select count(*)::int from public.discount_codes), 0,
  'una sesión sin ficha de personal tampoco');
select throws_ok($$update public.discount_codes set active = false$$,
  '42501', null, 'nadie escribe directamente');
reset role;
set local role anon;
select is((select count(*)::int from public.discount_codes), 0, 'el público no ve los códigos');
select throws_ok($$select pg_temp.quote('CLUB10', pg_temp.items(1, 0))$$,
  '42501', null, 'ni los comprueba sin el servidor');

-- ---------------------------------------------------------------------------
-- Tienda: comprobar un código antes de pagar
-- ---------------------------------------------------------------------------

reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);

select is(pg_temp.quote(' club10 ', pg_temp.items(1, 0)) ->> 'discount_cents', '500',
  '10 % de 49,95 € son 5,00 € (al céntimo más cercano), sin distinguir mayúsculas');
select is(pg_temp.quote('CLUB10', pg_temp.items(1, 0)) ->> 'code', 'CLUB10',
  'devuelve el código tal y como está guardado');
select throws_ok($$select pg_temp.quote('NOEXISTE', pg_temp.items(1, 0))$$,
  '22023', 'discount_invalid', 'un código que no existe');
select throws_ok($$select pg_temp.quote('APAGADO', pg_temp.items(1, 0))$$,
  '22023', 'discount_invalid', 'un código apagado es como si no existiera');
select throws_ok($$select pg_temp.quote('RAPIDO', pg_temp.items(1, 0))$$,
  '22023', 'discount_not_started', 'un código que aún no empieza');
select throws_ok($$select pg_temp.quote('VIEJO', pg_temp.items(1, 0))$$,
  '22023', 'discount_expired', 'un código caducado');
select throws_ok($$select pg_temp.quote('MENOS5', pg_temp.items(0, 1))$$,
  '22023', 'discount_minimum', 'por debajo de la compra mínima');
select is(pg_temp.quote('MENOS5', pg_temp.items(1, 0)) ->> 'discount_cents', '500',
  'por encima, 5 € menos');
select throws_ok($$select pg_temp.quote('GRANDE', pg_temp.items(1, 0))$$,
  '22023', 'discount_minimum', 'un importe fijo nunca deja el pedido a cero');
select throws_ok($$select pg_temp.quote('NOREBAJA', pg_temp.items(0, 1))$$,
  '22023', 'discount_not_applicable', 'solo rebajados y el código los excluye');
select is(pg_temp.quote('NOREBAJA', pg_temp.items(1, 1)) ->> 'discount_cents', '500',
  'con rebajados en la cesta, el descuento solo cuenta los demás');
select is(pg_temp.quote('CLUB10', pg_temp.items(1, 1)) ->> 'discount_cents', '799',
  'sin exclusión, cuenta también los rebajados');

-- ---------------------------------------------------------------------------
-- Tienda: pedidos con código
-- ---------------------------------------------------------------------------

select pg_temp.buy('00000000-0000-4000-8000-0000000019d1', pg_temp.items(1, 0),
  'una@test.invalid', 'club10');
select results_eq(
  $$select discount_code, discount_cents, items_cents, shipping_cents, total_cents
    from public.orders where request_id = '00000000-0000-4000-8000-0000000019d1'$$,
  $$values ('CLUB10'::text, 500, 4995, 0, 4495)$$,
  'el pedido guarda el código y cobra los artículos menos el descuento');
select is(
  (select detail ->> 'discount_cents' from public.order_events e
   join public.orders o on o.id = e.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000019d1' and e.kind = 'created'),
  '500', 'la cronología lo cuenta');
select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000019d2', pg_temp.items(1, 0),
    ' UNA@test.invalid ', 'CLUB10')$$,
  '22023', 'discount_used', 'un uso por email (sin distinguir mayúsculas)');
select is(
  pg_temp.buy('00000000-0000-4000-8000-0000000019d1', pg_temp.items(1, 0),
    'una@test.invalid', 'CLUB10') ->> 'discount_cents',
  '500', 'repetir la misma petición devuelve el mismo pedido, sin contarlo dos veces');
select is(
  pg_temp.buy('00000000-0000-4000-8000-0000000019d3', pg_temp.items(1, 0),
    'otra@test.invalid', 'CLUB10') ->> 'total_cents',
  '4495', 'otro email sí puede usarlo');

select pg_temp.buy('00000000-0000-4000-8000-0000000019d4', pg_temp.items(1, 0),
  'solo@test.invalid', 'SOLO1');
select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000019d5', pg_temp.items(1, 0),
    'segundo@test.invalid', 'SOLO1')$$,
  '22023', 'discount_exhausted', 'con todos sus usos gastados, no vale más');
select throws_ok(
  $$select pg_temp.buy('00000000-0000-4000-8000-0000000019d5', pg_temp.items(1, 0),
    'segundo@test.invalid', 'NOEXISTE')$$,
  '22023', 'discount_invalid', 'un código malo no crea pedido');
select is(
  (select count(*)::int from public.orders
   where request_id = '00000000-0000-4000-8000-0000000019d5'),
  0, 'ni deja nada a medias');

-- Un pedido que caduca sin pagar devuelve su uso.
reset role;
update public.orders set reserved_until = now() - interval '1 minute'
  where request_id = '00000000-0000-4000-8000-0000000019d4';
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select public.web_order_release_expired();
select is(
  pg_temp.buy('00000000-0000-4000-8000-0000000019d6', pg_temp.items(1, 0),
    'segundo@test.invalid', 'SOLO1') ->> 'discount_cents',
  '999', 'el uso de un pedido caducado sin pagar vuelve a estar libre');

-- Envío gratis desde 75 €: con el descuento ya aplicado.
select is(
  pg_temp.buy('00000000-0000-4000-8000-0000000019d7', pg_temp.items(1, 1),
    'envio@test.invalid', null, 'shipping') ->> 'shipping_cents',
  '0', 'sin código, 79,85 € de artículos tienen el envío gratis');
select results_eq(
  $$select (s ->> 'discount_cents')::int, (s ->> 'shipping_cents')::int,
           (s ->> 'total_cents')::int
    from pg_temp.buy('00000000-0000-4000-8000-0000000019d8', pg_temp.items(1, 1),
      'envio2@test.invalid', 'CLUB10', 'shipping') s$$,
  $$values (799, 495, 7681)$$,
  'con el código bajan a 71,86 € y el envío se cobra');

-- Cobro por el importe con descuento.
select is(
  public.web_order_record_payment('redsys',
    pg_temp.ref('00000000-0000-4000-8000-0000000019d1'), 'tx-desc-1', 'succeeded', 4495, 'EUR')
  ->> 'action',
  'confirm', 'el banco cobra el total con descuento y el pedido queda pagado');
select is(
  (public.web_order_status(
    (select id from public.orders where request_id = '00000000-0000-4000-8000-0000000019d1'))
   ->> 'discount_cents'),
  '500', 'la página del pedido ve el descuento');
select is(
  (select j ->> 'discount_code'
   from jsonb_array_elements(public.web_order_emails_claim(50)) j
   where (j ->> 'number')::bigint = (select number from public.orders
     where request_id = '00000000-0000-4000-8000-0000000019d1')),
  'CLUB10', 'el correo de confirmación lleva el código');

-- ---------------------------------------------------------------------------
-- Usos en el panel e integridad
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000192', 'aal2');
select results_eq(
  $$select uses, paid_uses, paid_discount_cents
    from public.admin_list_discount_codes() where code = 'CLUB10'$$,
  $$values (3, 1, 500::bigint)$$,
  'la lista cuenta los usos, los cobrados y lo descontado');

reset role;
select is(
  (select count(*)::int from public.audit_log where entity = 'discount_code'),
  9, 'cada alta y cada cambio quedan en la auditoría');
select throws_ok(
  $$update public.orders set discount_cents = items_cents,
      total_cents = shipping_cents
    where request_id = '00000000-0000-4000-8000-0000000019d1'$$,
  '23514', null, 'un descuento nunca deja los artículos a cero');
select throws_ok(
  $$update public.orders set discount_cents = 10, total_cents = total_cents - 10
    where request_id = '00000000-0000-4000-8000-0000000019d7'$$,
  '23514', null, 'no hay descuento sin código');

select * from finish();
rollback;
