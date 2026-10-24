-- Arreglos de las devoluciones (DECISIONS §168): la petición repetida no se
-- vuelve a mandar al banco, una devolución atascada se reenvía o se resuelve
-- tras mirar el portal del banco, y con una devolución abierta el pedido no
-- cambia de estado. Datos ficticios; se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(34);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000231', 'tienda-devol@test.invalid'),
  ('00000000-0000-4000-8000-000000000232', 'encargado-devol@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000231', 'store_admin'),
  ('00000000-0000-4000-8000-000000000232', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000023b1', 'marca-arreglos', 'Marca de arreglos');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000023a1', '00000000-0000-4000-8000-0000000023b1',
   'perfume-arreglos', 'Perfume de arreglos');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000023c1', '00000000-0000-4000-8000-0000000023a1', 100, 4000);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000023a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000023c1', id, 10
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
create function pg_temp.pay(p uuid) returns text
language sql as $$
  select public.web_order_record_payment('redsys', a.reference, a.reference || '/1',
    'succeeded', o.total_cents, 'EUR') ->> 'action'
  from public.orders o join public.order_payment_attempts a on a.order_id = o.id
  where o.request_id = p order by a.created_at desc limit 1;
$$;
create function pg_temp.payment(p uuid) returns bigint
language sql as $$
  select pay.id from public.order_payments pay join public.orders o on o.id = pay.order_id
  where o.request_id = p order by pay.id limit 1;
$$;
create function pg_temp.refund(p uuid, request uuid) returns jsonb
language sql as $$
  select public.admin_request_refund(pg_temp.oid(p), pg_temp.payment(p), 'cancelled',
    (select total_cents from public.orders where request_id = p), request, pg_temp.rev(p));
$$;
create function pg_temp.reserved() returns integer
language sql as $$
  select reserved from public.inventory_levels
  where variant_id = '00000000-0000-4000-8000-0000000023c1';
$$;
grant execute on function pg_temp.act_as(text, text), pg_temp.as_server(), pg_temp.oid(uuid),
  pg_temp.rev(uuid), pg_temp.status(uuid), pg_temp.pay(uuid), pg_temp.payment(uuid),
  pg_temp.refund(uuid, uuid), pg_temp.reserved() to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.admin_resolve_refund(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.admin_resolve_refund(uuid, text)', 'execute'),
  'resolver una devolución es del panel, no de la tienda');
select ok(
  not has_function_privilege('authenticated',
    'private.apply_refund_outcome(uuid, text, text, text, uuid, text)', 'execute')
  and not has_function_privilege('anon',
    'private.apply_refund_outcome(uuid, text, text, text, uuid, text)', 'execute')
  and not has_function_privilege('authenticated',
    'private.refund_stalled(public.order_refunds)', 'execute'),
  'nadie aplica el resultado de una devolución sin pasar por las funciones con permiso');
select ok(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'public.admin_resolve_refund(uuid, text)'::regprocedure)
  and (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'private.apply_refund_outcome(uuid, text, text, text, uuid, text)'::regprocedure),
  'security definer con search_path vacío');

-- Tres pedidos de recogida, pagados: A (petición repetida y paso bloqueado),
-- B (atascada y resuelta como no hecha) y C (atascada y hecha en el portal).
set local role service_role;
select pg_temp.as_server();
select public.web_order_create(r, 'es', 'click_collect', null,
  '[{"variant_id": "00000000-0000-4000-8000-0000000023c1", "quantity": 1}]',
  '{"full_name": "Cliente", "email": "cliente-devol@test.invalid"}', 'redsys', 30)
from unnest(array['00000000-0000-4000-8000-0000000023d1',
                  '00000000-0000-4000-8000-0000000023d2',
                  '00000000-0000-4000-8000-0000000023d3']::uuid[]) r;
select pg_temp.pay(r) from unnest(array['00000000-0000-4000-8000-0000000023d1',
  '00000000-0000-4000-8000-0000000023d2', '00000000-0000-4000-8000-0000000023d3']::uuid[]) r;
select is(pg_temp.reserved(), 3, 'los tres pedidos pagados retienen sus unidades');

-- ---------------------------------------------------------------------------
-- 1. La petición repetida no se vuelve a mandar
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000231', 'aal2');
create temp table a1 on commit drop as
select pg_temp.refund('00000000-0000-4000-8000-0000000023d1',
  '00000000-0000-4000-8000-0000000023e1') as r;
grant select on a1 to service_role, authenticated;
select is((select r ->> 'created' from a1), 'true', 'la primera petición crea la devolución');
select is(
  (public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000023d1'),
    pg_temp.payment('00000000-0000-4000-8000-0000000023d1'), 'cancelled', 4000,
    '00000000-0000-4000-8000-0000000023e1', 1)) ->> 'created',
  'false', 'la misma clave otra vez no crea nada: el servidor no la manda al banco');
select is((select count(*)::int from public.order_refunds
           where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000023d1')), 1,
  'una sola devolución');

-- ---------------------------------------------------------------------------
-- 3. Con una devolución abierta, el pedido no cambia de estado
-- ---------------------------------------------------------------------------

select throws_ok(
  $$select public.admin_transition_order(pg_temp.oid('00000000-0000-4000-8000-0000000023d1'),
    'processing', pg_temp.rev('00000000-0000-4000-8000-0000000023d1'))$$,
  '55000', 'refund_in_progress', 'enviada al banco: no se empieza a preparar');
reset role;
set local role service_role;
select pg_temp.as_server();
select public.web_order_refund_result((select (r ->> 'refund_id')::uuid from a1),
  'unknown', null, 'network');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000231', 'aal2');
select throws_ok(
  $$select public.admin_transition_order(pg_temp.oid('00000000-0000-4000-8000-0000000023d1'),
    'processing', pg_temp.rev('00000000-0000-4000-8000-0000000023d1'))$$,
  '55000', 'refund_in_progress', 'sin respuesta clara: tampoco');
reset role;
set local role service_role;
select pg_temp.as_server();
select public.web_order_refund_result((select (r ->> 'refund_id')::uuid from a1),
  'failed', '0190');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000231', 'aal2');
select lives_ok(
  $$select public.admin_transition_order(pg_temp.oid('00000000-0000-4000-8000-0000000023d1'),
    'processing', pg_temp.rev('00000000-0000-4000-8000-0000000023d1'))$$,
  'con la devolución rechazada, el pedido sigue su curso');
select is(pg_temp.status('00000000-0000-4000-8000-0000000023d1'), 'processing/committed',
  'en preparación');

-- ---------------------------------------------------------------------------
-- 2. Atascada: reenviar o resolver tras mirar el portal (B)
-- ---------------------------------------------------------------------------

create temp table b1 on commit drop as
select pg_temp.refund('00000000-0000-4000-8000-0000000023d2',
  '00000000-0000-4000-8000-0000000023e2') as r;
grant select on b1 to service_role, authenticated;
select throws_ok(
  $$select public.admin_retry_refund((select (r ->> 'refund_id')::uuid from b1))$$,
  '55000', 'refund_not_retryable', 'recién enviada: puede estar en camino, no se reenvía');
select throws_ok(
  $$select public.admin_resolve_refund((select (r ->> 'refund_id')::uuid from b1), 'failed')$$,
  '55000', 'refund_not_resolvable', 'ni se resuelve a mano');

-- Quedó a medias: enviada hace más de 10 minutos y sin respuesta guardada.
reset role;
update public.order_refunds set sent_at = now() - interval '11 minutes'
where id = (select (r ->> 'refund_id')::uuid from b1);
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000231', 'aal2');
select throws_ok(
  $$select public.admin_request_refund(pg_temp.oid('00000000-0000-4000-8000-0000000023d2'),
    pg_temp.payment('00000000-0000-4000-8000-0000000023d2'), 'cancelled', 4000,
    '00000000-0000-4000-8000-0000000023e3', pg_temp.rev('00000000-0000-4000-8000-0000000023d2'))$$,
  '55000', 'refund_in_progress', 'atascada, sigue bloqueando otra devolución');
select is(public.admin_retry_refund((select (r ->> 'refund_id')::uuid from b1)) ->> 'created',
  'true', 'a medias: se puede volver a enviar');
select ok((select sent_at > now() - interval '1 minute' from public.order_refunds
           where id = (select (r ->> 'refund_id')::uuid from b1)),
  'al reenviarla cuenta de nuevo el plazo');
select throws_ok(
  $$select public.admin_retry_refund((select (r ->> 'refund_id')::uuid from b1))$$,
  '55000', 'refund_not_retryable', 'un segundo reenvío seguido no sale');

reset role;
update public.order_refunds set sent_at = now() - interval '11 minutes'
where id = (select (r ->> 'refund_id')::uuid from b1);
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000232', 'aal2');
select throws_ok(
  $$select public.admin_resolve_refund((select (r ->> 'refund_id')::uuid from b1), 'failed')$$,
  '42501', 'forbidden', 'el encargado no resuelve devoluciones');
select pg_temp.act_as('00000000-0000-4000-8000-000000000231', 'aal1');
select throws_ok(
  $$select public.admin_resolve_refund((select (r ->> 'refund_id')::uuid from b1), 'failed')$$,
  '42501', 'forbidden', 'resolver exige MFA');
select pg_temp.act_as('00000000-0000-4000-8000-000000000231', 'aal2');
select throws_ok(
  $$select public.admin_resolve_refund((select (r ->> 'refund_id')::uuid from b1), 'unknown')$$,
  '22023', 'invalid_status', 'se resuelve como hecha o como no hecha');
select is(public.admin_resolve_refund((select (r ->> 'refund_id')::uuid from b1), 'failed')
  ->> 'status', 'failed', 'no consta en el portal: no se hizo');
select is(
  (select status || '/' || response_code from public.order_refunds
   where id = (select (r ->> 'refund_id')::uuid from b1)),
  'failed/portal', 'queda como comprobada en el portal');
select is(pg_temp.status('00000000-0000-4000-8000-0000000023d2'), 'paid/committed',
  'el pedido sigue pagado y con sus unidades');
select is(
  (select detail ->> 'source' || '/' || (actor_id = '00000000-0000-4000-8000-000000000231')::text
   from public.order_events
   where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000023d2')
     and kind = 'refund_failed'),
  'portal/true', 'la cronología dice que se comprobó en el portal y quién');
-- La auditoría solo la lee el administrador del sistema: se mira sin rol.
reset role;
select ok(exists (select 1 from public.audit_log
                  where action = 'orders.refund_resolve'
                    and actor_id = '00000000-0000-4000-8000-000000000231'
                    and entity_id = pg_temp.oid('00000000-0000-4000-8000-0000000023d2')::text
                    and after ->> 'refund_status' = 'failed'),
  'y la auditoría también');
set local role authenticated;
select is(pg_temp.refund('00000000-0000-4000-8000-0000000023d2',
  '00000000-0000-4000-8000-0000000023e4') ->> 'created', 'true',
  'resuelta, el pedido admite otra devolución');
reset role;
set local role service_role;
select pg_temp.as_server();
select is(public.web_order_refund_result((select (r ->> 'refund_id')::uuid from b1),
  'succeeded', '0900') ->> 'changed', 'false',
  'una respuesta tardía del banco sobre la resuelta no cambia nada');

-- ---------------------------------------------------------------------------
-- Hecha en el portal (C): el pedido cambia como con la respuesta del banco
-- ---------------------------------------------------------------------------

reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000231', 'aal2');
create temp table c1 on commit drop as
select pg_temp.refund('00000000-0000-4000-8000-0000000023d3',
  '00000000-0000-4000-8000-0000000023e5') as r;
grant select on c1 to service_role, authenticated;
reset role;
set local role service_role;
select pg_temp.as_server();
select public.web_order_refund_result((select (r ->> 'refund_id')::uuid from c1),
  'unknown', null, 'http_502');
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000231', 'aal2');
select is(public.admin_resolve_refund((select (r ->> 'refund_id')::uuid from c1), 'succeeded')
  ->> 'changed', 'true', 'sin respuesta clara: consta en el portal y se da por hecha');
select is(pg_temp.status('00000000-0000-4000-8000-0000000023d3'), 'cancelled/released',
  'cancelado y la unidad vuelve a la tienda');
select is(pg_temp.reserved(), 2, 'quedan reservadas las de A y B');
select is(
  (select array_agg(kind || coalesce('/' || (detail ->> 'source'), '') order by id)
   from public.order_events
   where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000023d3')
     and kind in ('refund_succeeded', 'status_changed')),
  array['refund_succeeded/portal', 'status_changed'],
  'la cronología cuenta la devolución comprobada y el cambio de estado');
select is(
  (select actor_id from public.order_events
   where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000023d3')
     and kind = 'status_changed' order by id desc limit 1),
  '00000000-0000-4000-8000-000000000231'::uuid, 'el cambio lo firma quien la resolvió');
select throws_ok(
  $$select public.admin_resolve_refund((select (r ->> 'refund_id')::uuid from c1), 'failed')$$,
  '55000', 'refund_not_resolvable', 'una devolución cerrada no se vuelve a resolver');
select is(
  (select (r ->> 'refunded_cents')::int from (
     select jsonb_build_object('refunded_cents', coalesce(sum(amount_cents), 0)) as r
     from public.order_refunds
     where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000023d3')
       and status = 'succeeded') s),
  4000, 'cuenta como devuelta en lo ya devuelto del cobro');
reset role;

select * from finish();
rollback;
