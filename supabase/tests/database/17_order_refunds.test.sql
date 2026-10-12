-- Devoluciones (PLAN_PEDIDOS_WEB, P06): el personal con orders.refund y MFA
-- solo las solicita; el pedido cambia cuando el servidor registra la
-- respuesta del banco. Importes acotados a lo cobrado, idempotencia, una
-- abierta por pedido y cobros de más. Datos ficticios; se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(36);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000171', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000172', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000173', 'cliente@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000171', 'store_admin'),
  ('00000000-0000-4000-8000-000000000172', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000017b1', 'marca-devoluciones', 'Marca de devoluciones');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000017a1', '00000000-0000-4000-8000-0000000017b1',
   'perfume-devoluciones', 'Perfume de devoluciones');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000017c1', '00000000-0000-4000-8000-0000000017a1', 100, 5000);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000017a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000017c1', id, 10
from public.stock_locations where code = 'castelldefels';

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text, true);
$$;
create function pg_temp.as_server() returns void
language sql as $$
  select set_config('request.jwt.claims', '{"role": "service_role"}', true);
$$;
create function pg_temp.oid(p uuid) returns uuid
language sql as $$ select id from public.orders where request_id = p; $$;
create function pg_temp.rev(p uuid) returns integer
language sql as $$ select revision from public.orders where request_id = p; $$;
create function pg_temp.status(p uuid) returns text
language sql as $$ select status || '/' || reservation from public.orders where request_id = p; $$;
-- Cobro del pedido (como el banco), con el importe y la transacción dados.
create function pg_temp.pay(p uuid, amount integer default null, tx text default null)
returns text
language sql as $$
  select public.web_order_record_payment('redsys', a.reference,
    coalesce(tx, a.reference || '/1'), 'succeeded', coalesce(amount, o.total_cents), 'EUR')
    ->> 'action'
  from public.orders o join public.order_payment_attempts a on a.order_id = o.id
  where o.request_id = p order by a.created_at desc limit 1;
$$;
create function pg_temp.payment(p uuid, tx_suffix text default '/1') returns bigint
language sql as $$
  select pay.id from public.order_payments pay join public.orders o on o.id = pay.order_id
  where o.request_id = p and pay.transaction_id like '%' || tx_suffix order by pay.id limit 1;
$$;
create function pg_temp.reserved() returns integer
language sql as $$
  select reserved from public.inventory_levels
  where variant_id = '00000000-0000-4000-8000-0000000017c1';
$$;
grant execute on function pg_temp.act_as(text, text), pg_temp.as_server(), pg_temp.oid(uuid),
  pg_temp.rev(uuid), pg_temp.status(uuid), pg_temp.pay(uuid, integer, text),
  pg_temp.payment(uuid, text), pg_temp.reserved() to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon',
    'public.admin_request_refund(uuid, bigint, text, integer, uuid, integer)', 'execute')
  and not has_function_privilege('authenticated',
    'public.web_order_refund_result(uuid, text, text, text)', 'execute')
  and not has_function_privilege('anon',
    'public.web_order_refund_result(uuid, text, text, text)', 'execute'),
  'la tienda no pide devoluciones y el personal no registra lo que dice el banco');
select ok(
  not has_table_privilege('authenticated', 'public.order_refunds', 'insert')
  and not has_table_privilege('authenticated', 'public.order_refunds', 'update'),
  'nadie escribe devoluciones directamente');

-- Pedidos: A pagado (recogida), B entregado, C pagado con un cobro de más.
set local role service_role;
select pg_temp.as_server();
select public.web_order_create(r, 'es', 'click_collect', null,
  '[{"variant_id": "00000000-0000-4000-8000-0000000017c1", "quantity": 2}]',
  '{"full_name": "Cliente", "email": "cliente@test.invalid"}', 'redsys', 30)
from unnest(array['00000000-0000-4000-8000-0000000017d1',
                  '00000000-0000-4000-8000-0000000017d2',
                  '00000000-0000-4000-8000-0000000017d3']::uuid[]) r;
select pg_temp.pay(r) from unnest(array['00000000-0000-4000-8000-0000000017d1',
  '00000000-0000-4000-8000-0000000017d2', '00000000-0000-4000-8000-0000000017d3']::uuid[]) r;
select is(pg_temp.pay('00000000-0000-4000-8000-0000000017d3', 10000, 'otra/2'), 'review',
  'un segundo cobro del pedido C queda como incidencia');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000171', 'aal2');
select public.admin_transition_order(pg_temp.oid('00000000-0000-4000-8000-0000000017d2'),
  'processing', pg_temp.rev('00000000-0000-4000-8000-0000000017d2'));
select public.admin_transition_order(pg_temp.oid('00000000-0000-4000-8000-0000000017d2'),
  'ready_for_pickup', pg_temp.rev('00000000-0000-4000-8000-0000000017d2'));
select public.admin_transition_order(pg_temp.oid('00000000-0000-4000-8000-0000000017d2'),
  'completed', pg_temp.rev('00000000-0000-4000-8000-0000000017d2'));
select is(pg_temp.status('00000000-0000-4000-8000-0000000017d2'), 'completed/consumed',
  'B entregado');
select is(pg_temp.reserved(), 4, 'A y C retienen 4 unidades');

select pg_temp.act_as('00000000-0000-4000-8000-000000000172', 'aal2');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'cancelled', 10000,
    '00000000-0000-4000-8000-0000000017e1', pg_temp.rev('00000000-0000-4000-8000-0000000017d1'))$$,
  '42501', 'forbidden', 'el encargado no devuelve dinero');
select pg_temp.act_as('00000000-0000-4000-8000-000000000171', 'aal1');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'cancelled', 10000,
    '00000000-0000-4000-8000-0000000017e1', pg_temp.rev('00000000-0000-4000-8000-0000000017d1'))$$,
  '42501', 'forbidden', 'devolver exige MFA');

-- ---------------------------------------------------------------------------
-- Cancelar y devolver (A)
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-000000000171', 'aal2');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'cancelled', 10000,
    '00000000-0000-4000-8000-0000000017e1', 1)$$,
  '55000', 'stale_revision', 'con la ficha desactualizada no se pide');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'cancelled', 5000,
    '00000000-0000-4000-8000-0000000017e1', pg_temp.rev('00000000-0000-4000-8000-0000000017d1'))$$,
  '22023', 'invalid_amount', 'cancelar devuelve todo lo cobrado, ni más ni menos');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'refunded', 10000,
    '00000000-0000-4000-8000-0000000017e1', pg_temp.rev('00000000-0000-4000-8000-0000000017d1'))$$,
  '22023', 'invalid_transition', 'un pedido pagado sin entregar se cancela, no se «reembolsa»');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d2'), 'cancelled', 10000,
    '00000000-0000-4000-8000-0000000017e1', pg_temp.rev('00000000-0000-4000-8000-0000000017d1'))$$,
  '22023', 'invalid_payment', 'el cobro tiene que ser de ese pedido');

create temp table sol on commit drop as
select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
  pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'cancelled', 10000,
  '00000000-0000-4000-8000-0000000017e1', pg_temp.rev('00000000-0000-4000-8000-0000000017d1')) as r;
grant select on sol to service_role, authenticated;
select is((select r ->> 'status' from sol), 'requested', 'solicitada');
select is((select (r ->> 'amount_cents')::int from sol), 10000, 'por todo lo cobrado');
select is(pg_temp.status('00000000-0000-4000-8000-0000000017d1'), 'paid/committed',
  'pedirla no cambia el pedido ni el stock');
select is(
  (public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'cancelled', 10000,
    '00000000-0000-4000-8000-0000000017e1', 1)) ->> 'refund_id',
  (select r ->> 'refund_id' from sol), 'el doble clic devuelve la misma solicitud');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'cancelled', 10000,
    '00000000-0000-4000-8000-0000000017e2', pg_temp.rev('00000000-0000-4000-8000-0000000017d1'))$$,
  '55000', 'refund_in_progress', 'una sola devolución abierta por pedido');
select throws_ok(
  $$select public.web_order_refund_result((select (r ->> 'refund_id')::uuid from sol), 'succeeded')$$,
  '42501', null, 'el personal no da por hecha una devolución');

reset role;
set local role service_role;
select pg_temp.as_server();
select is(public.web_order_refund_result((select (r ->> 'refund_id')::uuid from sol),
  'failed', '0190') ->> 'status', 'failed', 'el banco la rechaza');
select is(pg_temp.status('00000000-0000-4000-8000-0000000017d1'), 'paid/committed',
  'rechazada: el pedido sigue igual');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000171', 'aal2');
create temp table sol2 on commit drop as
select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d1'),
  pg_temp.payment('00000000-0000-4000-8000-0000000017d1'), 'cancelled', 10000,
  '00000000-0000-4000-8000-0000000017e3', pg_temp.rev('00000000-0000-4000-8000-0000000017d1')) as r;
grant select on sol2 to service_role, authenticated;
reset role;
set local role service_role;
select pg_temp.as_server();
select is(public.web_order_refund_result((select (r ->> 'refund_id')::uuid from sol2),
  'succeeded', '0900') ->> 'changed', 'true', 'tras un rechazo se puede volver a pedir y el banco la acepta');
select is(pg_temp.status('00000000-0000-4000-8000-0000000017d1'), 'cancelled/released',
  'aceptada: cancelado y las unidades vuelven a la tienda');
select is(pg_temp.reserved(), 2, 'solo queda reservado lo de C');
select is(public.web_order_refund_result((select (r ->> 'refund_id')::uuid from sol2),
  'succeeded', '0900') ->> 'changed', 'false', 'repetir la respuesta no hace nada');
select is(
  (select array_agg(kind order by id) from public.order_events
   where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000017d1') and kind like 'refund%'),
  array['refund_requested', 'refund_failed', 'refund_requested', 'refund_succeeded'],
  'la cronología cuenta cada solicitud y lo que dijo el banco');

-- ---------------------------------------------------------------------------
-- Devolución parcial y total de un pedido entregado (B)
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000171', 'aal2');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d2'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d2'), 'partially_refunded', 10000,
    '00000000-0000-4000-8000-0000000017e4', pg_temp.rev('00000000-0000-4000-8000-0000000017d2'))$$,
  '22023', 'invalid_amount', 'una parcial es menos que lo cobrado');
create temp table parcial on commit drop as
select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d2'),
  pg_temp.payment('00000000-0000-4000-8000-0000000017d2'), 'partially_refunded', 3000,
  '00000000-0000-4000-8000-0000000017e4', pg_temp.rev('00000000-0000-4000-8000-0000000017d2')) as r;
grant select on parcial to service_role, authenticated;
reset role;
set local role service_role;
select pg_temp.as_server();
select public.web_order_refund_result((select (r ->> 'refund_id')::uuid from parcial), 'succeeded', '0900');
select is(pg_temp.status('00000000-0000-4000-8000-0000000017d2'), 'partially_refunded/consumed',
  'parcialmente reembolsado; lo entregado no vuelve al stock');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000171', 'aal2');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d2'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d2'), 'refunded', 10000,
    '00000000-0000-4000-8000-0000000017e5', pg_temp.rev('00000000-0000-4000-8000-0000000017d2'))$$,
  '22023', 'invalid_amount', 'el resto es lo cobrado menos lo ya devuelto');
create temp table resto on commit drop as
select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d2'),
  pg_temp.payment('00000000-0000-4000-8000-0000000017d2'), 'refunded', 7000,
  '00000000-0000-4000-8000-0000000017e5', pg_temp.rev('00000000-0000-4000-8000-0000000017d2')) as r;
grant select on resto to service_role, authenticated;
reset role;
set local role service_role;
select pg_temp.as_server();
-- Sin respuesta clara: se reintenta tras comprobarlo.
select is(public.web_order_refund_result((select (r ->> 'refund_id')::uuid from resto),
  'unknown', null, 'network') ->> 'status', 'unknown', 'sin respuesta del banco');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000171', 'aal2');
select is(public.admin_retry_refund((select (r ->> 'refund_id')::uuid from resto)) ->> 'status',
  'requested', 'se vuelve a enviar');
select throws_ok(
  $$select public.admin_retry_refund((select (r ->> 'refund_id')::uuid from resto))$$,
  '55000', 'refund_not_retryable', 'solo las que quedaron sin respuesta');
reset role;
set local role service_role;
select pg_temp.as_server();
select public.web_order_refund_result((select (r ->> 'refund_id')::uuid from resto), 'succeeded', '0900');
select is(pg_temp.status('00000000-0000-4000-8000-0000000017d2'), 'refunded/consumed',
  'reembolsado del todo');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000171', 'aal2');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d2'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d2'), 'refunded', 1,
    '00000000-0000-4000-8000-0000000017e6', pg_temp.rev('00000000-0000-4000-8000-0000000017d2'))$$,
  '55000', 'nothing_to_refund', 'no se devuelve más de lo cobrado');

-- ---------------------------------------------------------------------------
-- Cobro de más (C): se devuelve entero sin tocar el pedido
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d3'),
    pg_temp.payment('00000000-0000-4000-8000-0000000017d3'), null, 10000,
    '00000000-0000-4000-8000-0000000017e7', pg_temp.rev('00000000-0000-4000-8000-0000000017d3'))$$,
  '22023', 'invalid_transition', 'el cobro del pedido no se devuelve «aparte»');
create temp table extra on commit drop as
select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000017d3'),
  pg_temp.payment('00000000-0000-4000-8000-0000000017d3', '/2'), null, 10000,
  '00000000-0000-4000-8000-0000000017e7', pg_temp.rev('00000000-0000-4000-8000-0000000017d3')) as r;
grant select on extra to service_role, authenticated;
reset role;
set local role service_role;
select pg_temp.as_server();
select public.web_order_refund_result((select (r ->> 'refund_id')::uuid from extra), 'succeeded', '0900');
select is(pg_temp.status('00000000-0000-4000-8000-0000000017d3'), 'paid/committed',
  'devuelto el cobro de más, el pedido sigue pagado');

-- ---------------------------------------------------------------------------
-- Lectura
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000172', 'aal2');
select is((select count(*)::int from public.order_refunds), 5, 'el encargado ve las devoluciones');
select pg_temp.act_as('00000000-0000-4000-8000-000000000173', 'aal2');
select is((select count(*)::int from public.order_refunds), 0, 'un cliente no');
reset role;

select * from finish();
rollback;
