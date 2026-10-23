-- Liberar a mano la reserva de un pedido sin pagar (DECISIONS §164): solo
-- orders.fulfill con MFA, el mismo efecto que la caducidad (las unidades
-- vuelven al stock y el pedido queda pendiente sin reserva), y un cobro
-- posterior entra como incidencia que se puede dar por pagada. Datos
-- ficticios; se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(25);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000221', 'tienda-reserva@test.invalid'),
  ('00000000-0000-4000-8000-000000000222', 'encargado-reserva@test.invalid');
insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000221', 'store_admin'),
  ('00000000-0000-4000-8000-000000000222', 'viewer');

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000022b1', 'marca-reservas', 'Marca de reservas');
insert into public.products (id, brand_id, slug, name) values
  ('00000000-0000-4000-8000-0000000022a1', '00000000-0000-4000-8000-0000000022b1',
   'perfume-reservas', 'Perfume de reservas');
insert into public.product_variants (id, product_id, size_ml, retail_price_cents) values
  ('00000000-0000-4000-8000-0000000022c1', '00000000-0000-4000-8000-0000000022a1', 100, 4000);
update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000022a1';
insert into public.inventory_levels (variant_id, location_id, on_hand)
select '00000000-0000-4000-8000-0000000022c1', id, 5
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
-- Liberar con la revisión actual (o la dada).
create function pg_temp.release_sql(p uuid, revision integer default null) returns text
language sql as $$
  select format('select public.admin_release_order_reservation(%L, %s)',
                pg_temp.oid(p), coalesce(revision, pg_temp.rev(p)));
$$;
create function pg_temp.pay(p uuid) returns text
language sql as $$
  select public.web_order_record_payment('redsys', a.reference, a.reference || '/1',
    'succeeded', o.total_cents, 'EUR') ->> 'action'
  from public.orders o join public.order_payment_attempts a on a.order_id = o.id
  where o.request_id = p order by a.created_at desc limit 1;
$$;
create function pg_temp.stock() returns text
language sql as $$
  select on_hand || '/' || reserved from public.inventory_levels
  where variant_id = '00000000-0000-4000-8000-0000000022c1';
$$;
grant execute on function pg_temp.act_as(text, text), pg_temp.as_server(), pg_temp.oid(uuid),
  pg_temp.rev(uuid), pg_temp.status(uuid), pg_temp.release_sql(uuid, integer),
  pg_temp.pay(uuid), pg_temp.stock() to service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Permisos
-- ---------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon',
    'public.admin_release_order_reservation(uuid, integer)', 'execute'),
  'la tienda anónima no libera reservas');
select ok(
  has_function_privilege('authenticated',
    'public.admin_release_order_reservation(uuid, integer)', 'execute'),
  'el personal llama a la función, que comprueba el permiso por dentro');

-- Pedidos: A (2 uds.), B (1 ud., se paga) y C (1 ud., caducará después).
set local role service_role;
select pg_temp.as_server();
select public.web_order_create(r, 'es', 'click_collect', null,
  jsonb_build_array(jsonb_build_object(
    'variant_id', '00000000-0000-4000-8000-0000000022c1', 'quantity', q)),
  '{"full_name": "Cliente", "email": "cliente-reserva@test.invalid"}', 'redsys', 30)
from (values ('00000000-0000-4000-8000-0000000022d1'::uuid, 2),
             ('00000000-0000-4000-8000-0000000022d2'::uuid, 1),
             ('00000000-0000-4000-8000-0000000022d3'::uuid, 1)) as v(r, q);
select is(pg_temp.pay('00000000-0000-4000-8000-0000000022d2'), 'confirm', 'B pagado');
reset role;
select is(pg_temp.stock(), '5/4', 'cuatro unidades reservadas (A, B y C)');
-- Sin MFA el personal no lee el pedido: la llamada se prepara antes.
create temp table sin_mfa on commit drop as
select pg_temp.release_sql('00000000-0000-4000-8000-0000000022d1') as sql;
grant select on sin_mfa to authenticated;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000222', 'aal2');
select throws_ok(pg_temp.release_sql('00000000-0000-4000-8000-0000000022d1'),
  '42501', 'forbidden', 'el encargado (solo lectura) no libera reservas');
select pg_temp.act_as('00000000-0000-4000-8000-000000000221', 'aal1');
select throws_ok((select sql from sin_mfa),
  '42501', 'forbidden', 'sin MFA, tampoco el administrador de la tienda');

-- ---------------------------------------------------------------------------
-- Liberar A
-- ---------------------------------------------------------------------------

select pg_temp.act_as('00000000-0000-4000-8000-000000000221', 'aal2');
select throws_ok(
  pg_temp.release_sql('00000000-0000-4000-8000-0000000022d1',
                      pg_temp.rev('00000000-0000-4000-8000-0000000022d1') - 1),
  '55000', 'stale_revision', 'con una revisión vieja (otra pantalla) no se libera');
select throws_ok(
  format('select public.admin_release_order_reservation(%L, 1)',
         '00000000-0000-4000-8000-0000000022ff'),
  '22023', 'unknown_order', 'un pedido que no existe');
select is(
  (select r.status || '/' || r.reservation
   from public.admin_release_order_reservation(
     pg_temp.oid('00000000-0000-4000-8000-0000000022d1'),
     pg_temp.rev('00000000-0000-4000-8000-0000000022d1')) r),
  'pending_payment/released',
  'liberado: sigue esperando pago, sin reserva («Sin pagar»)');
select throws_ok(pg_temp.release_sql('00000000-0000-4000-8000-0000000022d1'),
  '55000', 'not_releasable', 'una segunda vez ya no hay nada que liberar');
select throws_ok(pg_temp.release_sql('00000000-0000-4000-8000-0000000022d2'),
  '55000', 'not_releasable', 'un pedido pagado no se libera (se cancela y se devuelve)');

reset role;
select is(pg_temp.stock(), '5/2',
  'las dos unidades de A vuelven a estar disponibles; el stock físico no cambia');
select is(
  (select count(*)::integer from public.inventory_movements
   where reference = 'Pedido web ' || (select number from public.orders
                                       where request_id = '00000000-0000-4000-8000-0000000022d1')
     and type = 'RESERVATION_RELEASE'
     and actor_id = '00000000-0000-4000-8000-000000000221'),
  1, 'un movimiento de liberación con la persona que lo hizo');
select is(
  (select jsonb_build_object('reason', detail ->> 'reason', 'actor', actor_id)
   from public.order_events
   where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000022d1')
     and kind = 'reservation_released'),
  jsonb_build_object('reason', 'staff', 'actor', '00000000-0000-4000-8000-000000000221'),
  'la cronología dice que se liberó desde el panel y quién');
select is(
  (select after ->> 'reservation' from public.audit_log
   where action = 'orders.release_reservation'
     and entity_id = pg_temp.oid('00000000-0000-4000-8000-0000000022d1')::text
     and actor_id = '00000000-0000-4000-8000-000000000221'),
  'released', 'queda en la auditoría');

-- El cliente ya no puede pagarlo.
set local role service_role;
select pg_temp.as_server();
select is(
  public.web_order_status(pg_temp.oid('00000000-0000-4000-8000-0000000022d1')) ->> 'payable',
  'false', 'la página del pedido ya no ofrece pagar');
select throws_ok(
  format('select public.web_order_new_attempt(%L, %L)',
         pg_temp.oid('00000000-0000-4000-8000-0000000022d1'), 'redsys'),
  '55000', 'order_not_payable', 'ni «Volver a intentar el pago»');

-- Cobro tardío (el cliente estaba en la página del banco): incidencia.
select is(pg_temp.pay('00000000-0000-4000-8000-0000000022d1'), 'review',
  'un cobro que llega después no confirma el pedido');
select is(pg_temp.status('00000000-0000-4000-8000-0000000022d1'), 'needs_attention/released',
  'pasa a incidencias, sin reserva');
select is(
  (select reason from public.order_payments
   where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000022d1')),
  'reservation_unavailable', 'como un pago tardío tras la caducidad');

-- Desde la incidencia, «Dar por pagado» vuelve a reservar si hay stock.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000221', 'aal2');
select is(
  (select r.status || '/' || r.reservation
   from public.admin_transition_order(
     pg_temp.oid('00000000-0000-4000-8000-0000000022d1'), 'paid',
     pg_temp.rev('00000000-0000-4000-8000-0000000022d1')) r),
  'paid/committed', 'dado por pagado: vuelve a reservar las unidades');
reset role;
select is(pg_temp.stock(), '5/4', 'y el stock vuelve a contarlas como reservadas');

-- ---------------------------------------------------------------------------
-- La caducidad no vuelve a liberar lo ya liberado
-- ---------------------------------------------------------------------------

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000221', 'aal2');
select lives_ok(pg_temp.release_sql('00000000-0000-4000-8000-0000000022d3'),
  'se libera C');
reset role;
update public.orders set reserved_until = now() - interval '1 minute'
where request_id = '00000000-0000-4000-8000-0000000022d3';
set local role service_role;
select pg_temp.as_server();
select public.web_order_release_expired(100);
reset role;
select is(
  (select count(*)::integer from public.order_events
   where order_id = pg_temp.oid('00000000-0000-4000-8000-0000000022d3')
     and kind = 'reservation_released'),
  1, 'la tarea de caducidad no lo libera otra vez');
select is(pg_temp.stock(), '5/3', 'ni descuenta dos veces la reserva');

select * from finish();
rollback;
