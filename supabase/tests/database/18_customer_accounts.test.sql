-- Cuenta de cliente (PLAN_CUENTA_CLIENTE, C01; DECISIONS §142–146): con el
-- alta abierta, una sesión no significa «personal». Una cuenta de cliente (con
-- o sin aal2) no ve en ninguna tabla pública más que un visitante, no pasa
-- ninguna función del panel y solo lee su ficha y sus pedidos: los vinculados
-- al hacerlos y los de invitado con su email, si lo tiene verificado, con el
-- descuento si llevaban código (§152).
-- Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(54);

insert into auth.users (id, email, email_confirmed_at) values
  ('00000000-0000-4000-8000-000000000181', 'sistema@test.invalid', now()),
  ('00000000-0000-4000-8000-000000000182', 'cliente-a@test.invalid', now()),
  ('00000000-0000-4000-8000-000000000183', 'cliente-b@test.invalid', null),
  ('00000000-0000-4000-8000-000000000184', 'cliente-c@test.invalid', now());

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000181', 'system_admin');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000018b1', 'marca-cuentas', 'Marca de cuentas');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000018a1', '00000000-0000-4000-8000-0000000018b1',
   'perfume-cuentas', 'Perfume de cuentas');
insert into public.product_variants (id, product_id, sku, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000018c1', '00000000-0000-4000-8000-0000000018a1',
   'CTA-100', 100, 4995);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000018a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000018c1', l.id, 20
from public.stock_locations l where l.code = 'castelldefels';

-- Datos sensibles para que la comparación con el visitante signifique algo.
insert into public.discount_codes (code, kind, amount_cents)
values ('CUENTAS-5', 'amount', 500);
insert into public.newsletter_subscribers (email, locale, consent_version, source)
values ('suscriptor@test.invalid', 'es', 'v1', 'footer');
insert into public.audit_log (actor_id, action, entity)
values ('00000000-0000-4000-8000-000000000181', 'prueba.cuentas', 'auth');

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
create function pg_temp.order_for(
  p_request uuid, p_email text, p_customer uuid default null,
  p_code text default null
) returns bigint
language sql as $$
  select (public.web_order_create(
    p_request, 'es', 'click_collect', null,
    '[{"variant_id": "00000000-0000-4000-8000-0000000018c1", "quantity": 1}]',
    jsonb_build_object('full_name', 'Cliente de prueba', 'email', p_email,
                       'phone', '600000000'),
    'redsys', 30, p_discount_code => p_code, p_customer_id => p_customer)
    ->> 'number')::bigint;
$$;
-- Números de los pedidos, copiados por postgres: un cliente no lee orders.
create temp table numbers (request uuid primary key, number bigint);
create function pg_temp.number_of(p_request uuid) returns bigint
language sql as $$
  select number from numbers where request = p_request;
$$;
-- Filas que ve el rol actual en cada tabla pública (-1 sin privilegio).
create function pg_temp.visible_rows() returns table (rel text, n bigint)
language plpgsql as $$
declare
  r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind in ('r', 'p') order by 1
  loop
    rel := r.relname;
    begin
      execute format('select count(*) from public.%I', r.relname) into n;
    exception when insufficient_privilege then
      n := -1;
    end;
    return next;
  end loop;
end;
$$;
create temp table seen (who text, rel text, n bigint);
grant select, insert on seen to anon, authenticated;
grant select on numbers to anon, authenticated, service_role;
grant execute on function pg_temp.act_as(text, text), pg_temp.visible_rows(),
  pg_temp.number_of(uuid)
  to anon, authenticated;
grant execute on function pg_temp.order_for(uuid, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Superficie
-- ---------------------------------------------------------------------------

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname like 'customer\_%'),
  array['customer_order', 'customer_orders', 'customer_save_account'],
  'tres funciones del cliente');
select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'customer\_%'
      and (has_function_privilege('anon', p.oid, 'execute')
           or not has_function_privilege('authenticated', p.oid, 'execute'))$$,
  'solo una sesión ejecuta las funciones del cliente; un visitante no');
select ok(
  not has_function_privilege('authenticated', 'private.customer_order_ids()', 'execute')
  and not has_function_privilege('service_role', 'private.customer_order_ids()', 'execute'),
  'nadie llama directamente al auxiliar de pedidos de la cuenta');
select ok(
  not has_table_privilege('anon', 'public.customer_accounts', 'select,insert,update,delete')
  and not has_table_privilege('authenticated', 'public.customer_accounts',
                              'insert,update,delete,truncate'),
  'la ficha solo se lee (anon ni eso) y solo se escribe con customer_save_account');
-- Toda función que una sesión puede llamar comprueba permiso o MFA, o es una de
-- las públicas por diseño (tienda y cuenta de cliente, que solo ven lo suyo).
select is_empty(
  $$select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('authenticated', p.oid, 'execute')
      and p.prosrc !~ '(has_permission|is_staff|require_[a-z_]+|is_service_role|is_control_owner|current_aal|check_[a-z_]+_access)'
      and p.proname not in ('customer_order', 'customer_orders', 'customer_save_account',
                            'newsletter_subscribe', 'storefront_availability',
                            'track_product_event')$$,
  'ninguna función sin guarda de permiso fuera de las públicas por diseño');
-- Detrás de los códigos de descuento (DECISIONS §152): una sola versión, con
-- los dos parámetros opcionales.
select is(
  (select array_agg(pg_get_function_identity_arguments(p.oid)) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'web_order_create'),
  array['p_request_id uuid, p_locale text, p_fulfillment text, p_location_id uuid, '
        'p_items jsonb, p_contact jsonb, p_provider text, p_hold_minutes integer, '
        'p_discount_code text, p_customer_id uuid'],
  'una sola web_order_create, con el código y la cuenta');

-- ---------------------------------------------------------------------------
-- Pedidos de prueba (servidor)
-- ---------------------------------------------------------------------------

set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select throws_ok(
  $$select pg_temp.order_for('00000000-0000-4000-8000-0000000018d9', 'x@test.invalid',
                             '00000000-0000-4000-8000-0000000018ff')$$,
  '22023', 'unknown_customer', 'no se vincula un pedido a una cuenta que no existe');
-- 1: invitado con el email de A (verificado).
select pg_temp.order_for('00000000-0000-4000-8000-0000000018d1', ' Cliente-A@Test.invalid ');
-- 2: con la sesión de A y otro email de contacto.
select pg_temp.order_for('00000000-0000-4000-8000-0000000018d2', 'regalo@test.invalid',
                         '00000000-0000-4000-8000-000000000182');
-- 3: invitado con el email de B (sin verificar).
select pg_temp.order_for('00000000-0000-4000-8000-0000000018d3', 'cliente-b@test.invalid');
-- 4: con la sesión de C y un código de descuento.
select pg_temp.order_for('00000000-0000-4000-8000-0000000018d4', 'cliente-c@test.invalid',
                         '00000000-0000-4000-8000-000000000184', 'cuentas-5');
-- 5: de A, sin pagar y con la reserva ya liberada.
select pg_temp.order_for('00000000-0000-4000-8000-0000000018d5', 'cliente-a@test.invalid');
reset role;
insert into numbers select request_id, number from public.orders;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select is(
  (select customer_id from public.orders
   where request_id = '00000000-0000-4000-8000-0000000018d2'),
  '00000000-0000-4000-8000-000000000182'::uuid, 'el pedido guarda la cuenta de la sesión');
select is(
  (public.web_order_create('00000000-0000-4000-8000-0000000018d1', 'es', 'click_collect',
    null, '[{"variant_id": "00000000-0000-4000-8000-0000000018c1", "quantity": 1}]',
    '{"full_name": "Otro", "email": "otro@test.invalid"}', 'redsys', 30,
    p_customer_id => '00000000-0000-4000-8000-000000000184') ->> 'number')::bigint,
  pg_temp.number_of('00000000-0000-4000-8000-0000000018d1'),
  'repetir la petición devuelve el mismo pedido');
select is(
  (select customer_id from public.orders
   where request_id = '00000000-0000-4000-8000-0000000018d1'),
  null, 'y no lo vincula a otra cuenta');
select is(
  (select count(*)::int from public.order_events e join public.orders o on o.id = e.order_id
   where o.request_id = '00000000-0000-4000-8000-0000000018d2'
     and e.kind = 'created' and (e.detail ->> 'with_account')::boolean),
  1, 'la cronología dice que se hizo con cuenta (sin decir cuál)');
select is(
  (select row(customer_id, discount_code, discount_cents, total_cents)::text
   from public.orders where request_id = '00000000-0000-4000-8000-0000000018d4'),
  '(00000000-0000-4000-8000-000000000184,CUENTAS-5,500,4495)',
  'un pedido con cuenta y código guarda los dos');
-- El 1 se paga; el 5 caduca.
select public.web_order_record_payment('redsys', a.reference, 'tx-cuentas-1', 'succeeded',
                                       4995, 'EUR')
from public.order_payment_attempts a join public.orders o on o.id = a.order_id
where o.request_id = '00000000-0000-4000-8000-0000000018d1';
reset role;
update public.orders set reserved_until = now() - interval '1 minute'
  where request_id = '00000000-0000-4000-8000-0000000018d5';
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select ok(public.web_order_release_expired() >= 1, 'la reserva del 5 caduca');
reset role;

-- ---------------------------------------------------------------------------
-- Lo que ve un visitante y lo que ve una cuenta de cliente
-- ---------------------------------------------------------------------------

set local role anon;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
insert into seen select 'anon', v.rel, v.n from pg_temp.visible_rows() v;
select throws_ok('select * from public.customer_accounts', '42501', null,
  'un visitante no lee fichas de cliente');
select throws_ok('select public.customer_orders()', '42501', null,
  'ni pide pedidos de una cuenta');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000184', 'aal1');
select lives_ok(
  $$select public.customer_save_account('Cliente C', null, 'ca', null)$$,
  'C guarda su ficha');
select pg_temp.act_as('00000000-0000-4000-8000-000000000182', 'aal1');
select lives_ok(
  $$select public.customer_save_account(' Cliente A ', '+34 600 000 000', 'es',
    '{"address_line1": " Calle Mayor 1 ", "postal_code": "08860", "city": "Castelldefels"}')$$,
  'A guarda su ficha con la dirección');
insert into seen select 'cliente', v.rel, v.n from pg_temp.visible_rows() v;
-- Un cliente no tiene segundo factor, pero aunque la sesión dijera aal2:
select pg_temp.act_as('00000000-0000-4000-8000-000000000182', 'aal2');
insert into seen select 'cliente_aal2', v.rel, v.n from pg_temp.visible_rows() v;
reset role;

select cmp_ok(
  (select count(*)::int from seen where who = 'anon'), '>=', 30,
  'se comparan todas las tablas públicas');
select is(
  (select count(*)::int from seen where who = 'anon' and n > 0
   and rel in ('staff_members', 'audit_log', 'orders', 'order_contacts',
               'newsletter_subscribers', 'customer_accounts', 'discount_codes')),
  0, 'un visitante no ve personal, auditoría, pedidos, contactos, suscriptores, fichas ni códigos');
select is_empty(
  $$select c.who || ': ' || c.rel from seen c
    join seen a on a.rel = c.rel and a.who = 'anon'
    where c.who in ('cliente', 'cliente_aal2') and c.rel <> 'customer_accounts'
      and c.n > greatest(a.n, 0)$$,
  'una cuenta de cliente no ve en ninguna tabla pública más que un visitante');
select is(
  (select n from seen where who = 'cliente' and rel = 'customer_accounts'), 1::bigint,
  'y de las fichas solo ve la suya');

-- ---------------------------------------------------------------------------
-- Funciones del panel con una sesión de cliente (incluso con aal2)
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000182', 'aal2');
select throws_ok('select public.admin_list_staff()', '42501', null,
  'un cliente no lista el personal');
select throws_ok('select public.admin_variant_costs(array[]::uuid[])', '42501', null,
  'ni lee costes');
select throws_ok('select public.admin_control_tasks()', '42501', null,
  'ni entra en la consola');
select throws_ok($$select public.admin_get_content('home', 'es')$$, '42501', null,
  'ni lee borradores de contenido');
select throws_ok(
  $$select public.admin_transition_order(
    (select o.id from public.orders o limit 1), 'processing', 1, null)$$,
  '42501', null, 'ni cambia pedidos');
select throws_ok(
  $$select public.record_audit_event('prueba', 'auth')$$, '42501', null,
  'ni escribe en la auditoría');
select is(public.control_access(), false, 'control_access le dice que no');
select throws_ok(
  $$select public.web_order_create(gen_random_uuid(), 'es', 'click_collect', null,
    '[{"variant_id": "00000000-0000-4000-8000-0000000018c1", "quantity": 1}]',
    '{"full_name": "A", "email": "cliente-a@test.invalid"}', 'redsys', 30,
    p_customer_id => '00000000-0000-4000-8000-000000000182')$$,
  '42501', null, 'ni crea pedidos por la API');
reset role;

-- ---------------------------------------------------------------------------
-- Pedidos de la cuenta
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000182', 'aal1');
select results_eq(
  'select number from public.customer_orders() order by number',
  format('select unnest(array[%s, %s]::bigint[])',
    pg_temp.number_of('00000000-0000-4000-8000-0000000018d1'),
    pg_temp.number_of('00000000-0000-4000-8000-0000000018d2')),
  'A ve el de invitado con su email verificado y el vinculado; ni el de C ni el caducado');
select is(
  (select status from public.customer_orders()
   where number = pg_temp.number_of('00000000-0000-4000-8000-0000000018d1')),
  'paid', 'con su estado');
select is(
  (select units from public.customer_orders()
   where number = pg_temp.number_of('00000000-0000-4000-8000-0000000018d2')),
  1, 'y sus unidades');
select is(
  public.customer_order(pg_temp.number_of('00000000-0000-4000-8000-0000000018d1'))
    #>> '{lines,0,product_name}',
  'Perfume de cuentas', 'la ficha de su pedido lleva los artículos');
select is(
  public.customer_order(pg_temp.number_of('00000000-0000-4000-8000-0000000018d1'))
    #>> '{contact,email}',
  'cliente-a@test.invalid', 'y el contacto que dio');
select ok(
  not (public.customer_order(pg_temp.number_of('00000000-0000-4000-8000-0000000018d1'))
       ?| array['order_id', 'request_id', 'events', 'payments', 'location_id',
                'received_transaction_id', 'revision']),
  'sin identificadores internos, cobros ni cronología');
select ok(
  public.customer_order(pg_temp.number_of('00000000-0000-4000-8000-0000000018d1'))
    @> '{"discount_code": null, "discount_cents": 0, "total_cents": 4995}',
  'sin código, ni código ni descuento');
select is(
  public.customer_order(pg_temp.number_of('00000000-0000-4000-8000-0000000018d4')),
  null, 'el pedido de otra cuenta no existe para A');
select is(
  public.customer_order(pg_temp.number_of('00000000-0000-4000-8000-0000000018d5')),
  null, 'ni el que nunca se pagó');
select is(public.customer_order(999999999), null, 'ni uno que no existe');

select pg_temp.act_as('00000000-0000-4000-8000-000000000183', 'aal1');
select is_empty('select * from public.customer_orders()',
  'B no ve el pedido de su email mientras no lo verifique');
select pg_temp.act_as('00000000-0000-4000-8000-000000000184', 'aal1');
select results_eq(
  'select number from public.customer_orders()',
  format('select %s::bigint', pg_temp.number_of('00000000-0000-4000-8000-0000000018d4')),
  'C solo ve el suyo');
select ok(
  public.customer_order(pg_temp.number_of('00000000-0000-4000-8000-0000000018d4'))
    @> '{"discount_code": "CUENTAS-5", "discount_cents": 500, "items_cents": 4995,
         "total_cents": 4495}',
  'y en su ficha, el código y lo descontado');
reset role;

-- ---------------------------------------------------------------------------
-- Ficha
-- ---------------------------------------------------------------------------

select is(
  (select row(full_name, phone, locale, address_line1, postal_code, city, province)::text
   from public.customer_accounts where user_id = '00000000-0000-4000-8000-000000000182'),
  '("Cliente A","+34 600 000 000",es,"Calle Mayor 1",08860,Castelldefels,)',
  'la ficha se guarda limpia');

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000182', 'aal1');
select throws_ok(
  $$select public.customer_save_account('A', null, 'es',
    '{"address_line1": "Calle Mayor 1", "postal_code": "8860", "city": "Castelldefels"}')$$,
  '22023', 'invalid_address', 'un código postal que no es de cinco cifras no vale');
select throws_ok(
  $$select public.customer_save_account('A', null, 'es', '{"city": "Castelldefels"}')$$,
  '22023', 'invalid_address', 'una dirección a medias tampoco');
select throws_ok(
  $$select public.customer_save_account('A', 'llámame', 'es', null)$$,
  '22023', 'invalid_account', 'ni un teléfono que no lo es');
select throws_ok(
  $$select public.customer_save_account('A', null, 'fr', null)$$,
  '22023', 'invalid_account', 'ni un idioma que la tienda no tiene');
select lives_ok(
  $$select public.customer_save_account('A', null, 'en', '{}')$$,
  'quitar la dirección');
select is(
  (select address_line1 from public.customer_accounts), null,
  'la dirección queda vacía (y A solo ve su ficha)');
select throws_ok(
  $$update public.customer_accounts set full_name = 'Otro'$$, '42501', null,
  'la ficha no se escribe directamente');
-- Una sesión sin usuario (solo el rol) no guarda nada.
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
select throws_ok(
  $$select public.customer_save_account('A', null, 'es', null)$$,
  '42501', 'forbidden', 'sin usuario no se guarda nada');
select is_empty('select * from public.customer_orders()', 'ni se ve ningún pedido');
reset role;

-- ---------------------------------------------------------------------------
-- Borrar la cuenta
-- ---------------------------------------------------------------------------

delete from auth.users where id = '00000000-0000-4000-8000-000000000182';
select is(
  (select count(*)::int from public.customer_accounts
   where user_id = '00000000-0000-4000-8000-000000000182'),
  0, 'al borrar la cuenta se borra su ficha');
select is(
  (select count(*)::int from public.orders
   where request_id = '00000000-0000-4000-8000-0000000018d2' and customer_id is null),
  1, 'y el pedido se conserva sin el vínculo');

select * from finish();
rollback;
