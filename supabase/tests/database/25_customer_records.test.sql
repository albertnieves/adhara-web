-- Ficha de cliente del panel (A7, DECISIONS §184): la lista y la ficha solo
-- con customers.view y MFA; la exportación, con customers.manage y MFA, deja
-- constancia en la auditoría sin el email. El cliente es su email en
-- minúsculas y el panel lo nombra por una clave opaca. Datos ficticios; la
-- transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(39);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000251', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000252', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000253', 'sistemas@test.invalid'),
  ('00000000-0000-4000-8000-000000000254', 'ana@fichas.invalid'),
  ('00000000-0000-4000-8000-000000000255', 'visita@test.invalid');
insert into public.staff_members (user_id, role, display_name) values
  ('00000000-0000-4000-8000-000000000251', 'store_admin', 'Tienda'),
  ('00000000-0000-4000-8000-000000000252', 'viewer', 'Encargado'),
  ('00000000-0000-4000-8000-000000000253', 'system_admin', null);
insert into public.customer_accounts (user_id, full_name, phone, locale) values
  ('00000000-0000-4000-8000-000000000254', 'Ana Cuenta', '600000001', 'ca');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000025b1', 'marca-fichas', 'Marca de fichas');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000025a1', '00000000-0000-4000-8000-0000000025b1',
   'perfume-fichas', 'Perfume de fichas');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000025c1', '00000000-0000-4000-8000-0000000025a1', 100, 5000);

-- Ana: un pedido pagado con una devolución aceptada y otro sin pagar, con el
-- email escrito de dos formas; una consulta abierta; el Club; y su cuenta.
insert into public.orders (id, request_id, locale, status, fulfillment, location_id,
  items_cents, total_cents, reservation, reserved_until, paid_at, customer_id, created_at)
select '00000000-0000-4000-8000-0000000025d1', gen_random_uuid(), 'es', 'partially_refunded',
  'click_collect', l.id, 5000, 5000, 'consumed', now(), now() - interval '3 days',
  '00000000-0000-4000-8000-000000000254', now() - interval '3 days'
from public.stock_locations l where l.code = 'castelldefels';
insert into public.orders (id, request_id, locale, fulfillment, location_id,
  items_cents, total_cents, reservation, reserved_until, created_at)
select '00000000-0000-4000-8000-0000000025d2', gen_random_uuid(), 'es',
  'click_collect', l.id, 3000, 3000, 'released', now(), now() - interval '1 day'
from public.stock_locations l where l.code = 'castelldefels';
insert into public.order_contacts (order_id, full_name, email, phone) values
  ('00000000-0000-4000-8000-0000000025d1', 'Ana Pedido', 'Ana@Fichas.invalid', '600000001'),
  ('00000000-0000-4000-8000-0000000025d2', 'Ana Segunda', 'ana@FICHAS.invalid', null);
insert into public.order_lines (order_id, variant_id, brand_name, product_name, size_ml,
  quantity, unit_price_cents, line_total_cents) values
  ('00000000-0000-4000-8000-0000000025d1', '00000000-0000-4000-8000-0000000025c1',
   'Marca de fichas', 'Perfume de fichas', 100, 1, 5000, 5000);
insert into public.order_payment_attempts (id, order_id, provider, reference, amount_cents)
values ('00000000-0000-4000-8000-0000000025e1', '00000000-0000-4000-8000-0000000025d1',
        'redsys', '000000002501', 5000);
insert into public.order_payments (order_id, attempt_id, provider, transaction_id, outcome,
  amount_cents, currency, decision)
values ('00000000-0000-4000-8000-0000000025d1', '00000000-0000-4000-8000-0000000025e1',
        'redsys', 'transaccion-fichas', 'succeeded', 5000, 'EUR', 'confirm');
insert into public.order_refunds (order_id, payment_id, request_id, to_status, amount_cents,
  provider, reference, status, resolved_at)
select '00000000-0000-4000-8000-0000000025d1', p.id, gen_random_uuid(), 'partially_refunded',
  1000, 'redsys', '000000002501', 'succeeded', now()
from public.order_payments p where p.transaction_id = 'transaccion-fichas';

insert into public.conversations (id, channel, status, subject, locale, last_message_at,
  created_at) values
  ('00000000-0000-4000-8000-0000000025f1', 'web_form', 'open', 'Mi pedido', 'es',
   now() - interval '2 hours', now() - interval '2 days'),
  ('00000000-0000-4000-8000-0000000025f2', 'email', 'spam', 'Oferta', 'en',
   now() - interval '1 hour', now() - interval '1 hour');
insert into public.conversation_contacts (conversation_id, full_name, email) values
  ('00000000-0000-4000-8000-0000000025f1', 'Ana Mensaje', 'ana@fichas.invalid'),
  ('00000000-0000-4000-8000-0000000025f2', null, 'spam@fichas.invalid');
insert into public.conversation_messages (conversation_id, kind, source, body) values
  ('00000000-0000-4000-8000-0000000025f1', 'customer', 'web_form', '¿Dónde está mi pedido?'),
  ('00000000-0000-4000-8000-0000000025f1', 'reply', 'panel', 'Sale mañana.'),
  ('00000000-0000-4000-8000-0000000025f1', 'note', 'panel', 'Llamó también por teléfono.'),
  ('00000000-0000-4000-8000-0000000025f2', 'customer', 'email', 'Compra seguidores.');

insert into public.newsletter_subscribers (email, locale, consent_version, consented_at,
  unsubscribed_at) values
  ('ana@fichas.invalid', 'es', 'club-2026-10', now() - interval '10 days', null),
  ('club@fichas.invalid', 'en', 'club-2026-10', now() - interval '20 days', now() - interval '5 days');

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;
create function pg_temp.key(p_email text) returns text
language sql as $$ select encode(sha256(convert_to(p_email, 'UTF8')), 'hex'); $$;
grant execute on function pg_temp.act_as(text, text), pg_temp.key(text)
  to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Superficie
-- ---------------------------------------------------------------------------

select is_empty(
  $$select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in ('customer_key', 'customer_emails', 'customer_email_for_key')
      and (has_function_privilege('anon', p.oid, 'execute')
           or has_function_privilege('authenticated', p.oid, 'execute'))$$,
  'las ayudas de la ficha no se llaman desde fuera');
select is_empty(
  $$select p.proname from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('admin_customers', 'admin_customer', 'admin_customer_export')
      and (has_function_privilege('anon', p.oid, 'execute')
           or not has_function_privilege('authenticated', p.oid, 'execute'))$$,
  'solo el personal autenticado llama a la ficha (y la función comprueba el permiso)');

-- ---------------------------------------------------------------------------
-- Quién ve la lista
-- ---------------------------------------------------------------------------

set local role anon;
select throws_ok($$select * from public.admin_customers()$$, '42501', null,
  'un visitante no ve clientes');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000255', 'aal2');
select throws_ok($$select * from public.admin_customers()$$, '42501', 'forbidden',
  'una cuenta de cliente no ve clientes');
select pg_temp.act_as('00000000-0000-4000-8000-000000000252', 'aal2');
select throws_ok($$select * from public.admin_customers()$$, '42501', 'forbidden',
  'el encargado no ve clientes');
select throws_ok($$select public.admin_customer(pg_temp.key('ana@fichas.invalid'))$$,
  '42501', 'forbidden', 'el encargado no abre una ficha');
select pg_temp.act_as('00000000-0000-4000-8000-000000000251', 'aal1');
select throws_ok($$select * from public.admin_customers()$$, '42501', 'forbidden',
  'sin MFA el administrador de la tienda no ve clientes');

-- ---------------------------------------------------------------------------
-- Lista
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-000000000251', 'aal2');
select results_eq(
  $$select email from public.admin_customers('fichas.invalid') order by email$$,
  $$values ('ana@fichas.invalid'), ('club@fichas.invalid')$$,
  'un cliente por email en minúsculas; quien solo envió spam no es cliente');
select is(
  (select row(orders, paid_orders, paid_cents, refunded_cents, conversations,
              open_conversations, newsletter, has_account)::text
   from public.admin_customers('fichas.invalid') where email = 'ana@fichas.invalid'),
  row(2, 1, 5000::bigint, 1000::bigint, 1, 1, 'subscribed', true)::text,
  'pedidos, cobrado y devuelto, mensajes abiertos, Club y cuenta de Ana');
select is(
  (select full_name from public.admin_customers('fichas.invalid') where email = 'ana@fichas.invalid'),
  'Ana Cuenta', 'el nombre de la cuenta manda sobre el de los pedidos');
select is(
  (select customer_key from public.admin_customers('fichas.invalid') where email = 'ana@fichas.invalid'),
  pg_temp.key('ana@fichas.invalid'), 'la clave es el sha256 del email');
select is(
  (select row(orders, conversations, newsletter, has_account)::text
   from public.admin_customers('fichas.invalid') where email = 'club@fichas.invalid'),
  row(0, 0, 'unsubscribed', false)::text, 'quien se dio de baja del Club sigue en la lista');
select is((select max(total_count) from public.admin_customers('fichas.invalid')), 2::bigint,
  'el total cuenta todos los que encajan');
select is(
  (select email from public.admin_customers('fichas.invalid') limit 1), 'ana@fichas.invalid',
  'la actividad más reciente primero');
select is((select count(*)::int from public.admin_customers('fichas.invalid', 1, 1)), 1,
  'por páginas');
select results_eq($$select email from public.admin_customers('  ANA ')$$,
  $$values ('ana@fichas.invalid')$$, 'busca en el email sin mayúsculas');
select results_eq($$select email from public.admin_customers('ana cuenta')$$,
  $$values ('ana@fichas.invalid')$$, 'y en el nombre');
select is_empty($$select 1 from public.admin_customers('spam@fichas')$$,
  'el spam no sale ni buscándolo');
select throws_ok($$select * from public.admin_customers(null, 0, 0)$$, '22023', 'invalid_page',
  'una página sin filas no es válida');
select throws_ok($$select * from public.admin_customers(null, 500, 0)$$, '22023', 'invalid_page',
  'como mucho 200 por página');

-- ---------------------------------------------------------------------------
-- Ficha
-- ---------------------------------------------------------------------------

select throws_ok($$select public.admin_customer('ana@fichas.invalid')$$, '22023',
  'invalid_customer', 'la ficha se pide por la clave, no por el email');
select is(public.admin_customer(pg_temp.key('nadie@fichas.invalid')), null,
  'una clave que no es de nadie no da ficha');
select is(
  jsonb_array_length(public.admin_customer(pg_temp.key('ana@fichas.invalid')) -> 'orders'), 2,
  'la ficha de Ana trae sus dos pedidos');
select is(
  public.admin_customer(pg_temp.key('ana@fichas.invalid')) #>> '{orders,0,full_name}',
  'Ana Segunda', 'el pedido más reciente primero, con el nombre con el que se hizo');
select is(
  (public.admin_customer(pg_temp.key('ana@fichas.invalid')) #>> '{orders,1,refunded_cents}')::int,
  1000, 'con lo devuelto');
select is(
  public.admin_customer(pg_temp.key('ana@fichas.invalid')) #>> '{account,phone}',
  '600000001', 'con los datos de su cuenta');
select is(
  public.admin_customer(pg_temp.key('ana@fichas.invalid')) #>> '{newsletter,consent_version}',
  'club-2026-10', 'y la versión y fecha del consentimiento del Club');
select is(
  public.admin_customer(pg_temp.key('spam@fichas.invalid')) #>> '{conversations,0,status}',
  'spam', 'por su clave se ve también quien solo envió spam');
select ok(
  strpos(public.admin_customer(pg_temp.key('ana@fichas.invalid'))::text, 'Llamó también') = 0,
  'la ficha cuenta los mensajes pero no copia sus textos');

-- ---------------------------------------------------------------------------
-- Exportación
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-000000000251', 'aal1');
select throws_ok($$select public.admin_customer_export(pg_temp.key('ana@fichas.invalid'))$$,
  '42501', 'forbidden', 'sin MFA no se exporta');
select pg_temp.act_as('00000000-0000-4000-8000-000000000252', 'aal2');
select throws_ok($$select public.admin_customer_export(pg_temp.key('ana@fichas.invalid'))$$,
  '42501', 'forbidden', 'el encargado no exporta');
select pg_temp.act_as('00000000-0000-4000-8000-000000000251', 'aal2');
select throws_ok($$select public.admin_customer_export(pg_temp.key('nadie@fichas.invalid'))$$,
  '22023', 'unknown_customer', 'no se exporta a nadie que no exista');

create temp table export as
  select public.admin_customer_export(pg_temp.key('ana@fichas.invalid')) as data;
select is(
  (select row(jsonb_array_length(data -> 'orders'), jsonb_array_length(data -> 'conversations'),
              data #>> '{account,full_name}', data #>> '{newsletter,email}')::text
   from export),
  row(2, 1, 'Ana Cuenta', 'ana@fichas.invalid')::text,
  'la exportación trae pedidos, mensajes, cuenta y Club');
select is(
  (select data #>> '{orders,0,lines,0,product}' from export), 'Perfume de fichas',
  'con lo comprado en cada pedido');
select is(
  (select row(data #>> '{orders,0,payments,0,amount_cents}',
              data #>> '{orders,0,refunds,0,status}')::text from export),
  row('5000', 'succeeded')::text, 'con los cobros y las devoluciones');
select is(
  (select jsonb_agg(m -> 'kind' order by m ->> 'created_at')
   from export, jsonb_array_elements(data #> '{conversations,0,messages}') m),
  '["customer", "reply", "note"]'::jsonb,
  'con los mensajes, también las notas internas marcadas para revisarlas');
select ok(
  (select strpos(data::text, '00000000-0000-4000-8000-0000000025') = 0
          and strpos(data::text, 'transaccion-fichas') = 0
          and strpos(data::text, '000000002501') = 0
   from export),
  'sin ids internos ni referencias del banco');
-- La auditoría se lee como postgres (su lectura tiene su propio permiso).
reset role;
select is(
  (select count(*)::int from public.audit_log
   where action = 'customers.export' and entity = 'customer'
     and entity_id = pg_temp.key('ana@fichas.invalid')
     and actor_id = '00000000-0000-4000-8000-000000000251'),
  1, 'la exportación queda en la auditoría con la clave');
select ok(
  (select bool_and(strpos(coalesce(entity_id, '') || coalesce(after::text, ''), '@') = 0)
   from public.audit_log where action = 'customers.export'),
  'la auditoría no guarda el email');

select * from finish();
rollback;
