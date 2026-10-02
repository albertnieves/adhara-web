-- Asistente: informes diarios (lectura con agent.use, escritura solo del
-- servidor), registro de uso de solo inserción y pedidos abiertos sin
-- proveedor ni costes. La tarea programada (service_role) lee el vigilante.
-- Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(24);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000061', 'sistema@test.invalid'),
  ('00000000-0000-4000-8000-000000000062', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000063', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000064', 'cliente@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000061', 'system_admin'),
  ('00000000-0000-4000-8000-000000000062', 'store_admin'),
  ('00000000-0000-4000-8000-000000000063', 'viewer');

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;

create function pg_temp.location_id() returns uuid
language sql as $$
  select id from public.stock_locations where code = 'castelldefels';
$$;
grant execute on function pg_temp.location_id() to authenticated, anon, service_role;

insert into public.daily_reports (location_id, report_date, facts, summary)
values (pg_temp.location_id(), '2026-10-01', '{"version": 1}', '- Nada urgente.');

insert into internal.suppliers (id, name, lead_time_days) values
  ('00000000-0000-4000-8000-0000000006d1', 'Proveedor secreto', 3);
insert into internal.purchase_orders (id, number, supplier_id, location_id, status, expected_on)
values ('00000000-0000-4000-8000-0000000006e1', 'PC-ASIST-1',
        '00000000-0000-4000-8000-0000000006d1', pg_temp.location_id(), 'ordered',
        '2026-09-28');

-- Anónimo: nada.
set local role anon;
select throws_ok(
  $$select count(*) from public.daily_reports$$,
  '42501', null, 'anon no lee informes diarios'
);
select throws_ok(
  $$select * from public.admin_open_purchase_orders(pg_temp.location_id())$$,
  '42501', null, 'anon no ejecuta admin_open_purchase_orders'
);

-- Usuario sin ficha de personal: ni informes ni pedidos.
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000064', 'aal2');
select is(
  (select count(*)::integer from public.daily_reports), 0,
  'un usuario que no es personal no ve informes'
);
select throws_ok(
  $$select * from public.admin_open_purchase_orders(pg_temp.location_id())$$,
  '42501', null, 'un usuario que no es personal no ve pedidos abiertos'
);

-- Encargado (agent.use): lee, pero no escribe informes.
select pg_temp.act_as('00000000-0000-4000-8000-000000000063', 'aal2');
select is(
  (select summary from public.daily_reports where report_date = '2026-10-01'),
  '- Nada urgente.', 'el encargado lee el informe diario'
);
select throws_ok(
  $$insert into public.daily_reports (location_id, report_date, facts)
    values (pg_temp.location_id(), '2026-10-02', '{}')$$,
  '42501', null, 'nadie inserta informes por la API'
);
select throws_ok(
  $$update public.daily_reports set summary = 'falso'$$,
  '42501', null, 'nadie cambia el resumen por la API'
);
select throws_ok(
  $$delete from public.daily_reports$$,
  '42501', null, 'nadie borra informes por la API'
);
select is(
  (select count(*)::integer from public.admin_open_purchase_orders(pg_temp.location_id())),
  1, 'el encargado ve los pedidos abiertos'
);
select is(
  (select number || '|' || units_ordered from public.admin_open_purchase_orders(pg_temp.location_id())),
  'PC-ASIST-1|0', 'sin líneas cuenta 0 unidades'
);
select hasnt_column(
  'public', 'daily_reports', 'cost_net_cents', 'el informe no tiene columnas de coste'
);

-- Registro de uso: cada persona registra el suyo, solo «chat».
select lives_ok(
  $$insert into public.assistant_usage (kind, model, input_tokens, output_tokens)
    values ('chat', 'claude-opus-5-5', 100, 20)$$,
  'el encargado registra su consulta'
);
select is(
  (select user_id::text from public.assistant_usage order by id desc limit 1),
  '00000000-0000-4000-8000-000000000063', 'el registro queda a su nombre'
);
select throws_ok(
  $$insert into public.assistant_usage (user_id, kind, model)
    values ('00000000-0000-4000-8000-000000000062', 'chat', 'claude-opus-5-5')$$,
  '42501', null, 'no se registra uso a nombre de otra persona'
);
select throws_ok(
  $$insert into public.assistant_usage (kind, model)
    values ('daily_summary', 'claude-opus-5-5')$$,
  '42501', null, 'el resumen diario solo lo registra el servidor'
);
select throws_ok(
  $$update public.assistant_usage set input_tokens = 0$$,
  '42501', null, 'el registro de uso no se modifica'
);

-- Sin MFA (aal1) se lee pero no se registra (escritura de personal).
select pg_temp.act_as('00000000-0000-4000-8000-000000000062', 'aal1');
select throws_ok(
  $$insert into public.assistant_usage (kind, model) values ('chat', 'claude-opus-5-5')$$,
  '42501', null, 'sin MFA no se registra uso'
);

-- Cada persona ve solo su uso; staff.manage lo ve todo.
select pg_temp.act_as('00000000-0000-4000-8000-000000000062', 'aal2');
select is(
  (select count(*)::integer from public.assistant_usage), 0,
  'la tienda no ve el uso de otras personas'
);
select pg_temp.act_as('00000000-0000-4000-8000-000000000061', 'aal2');
select is(
  (select count(*)::integer from public.assistant_usage), 1,
  'el administrador del sistema ve todo el uso'
);

-- Tarea programada: lee el vigilante y los pedidos sin sesión de personal.
reset role;
set local role service_role;
select set_config('request.jwt.claims', '{"role": "service_role"}', true);
select lives_ok(
  $$select * from public.admin_stock_watch_facts(pg_temp.location_id())$$,
  'la tarea programada lee el vigilante'
);
select is(
  (select count(*)::integer from public.admin_open_purchase_orders(pg_temp.location_id())),
  1, 'la tarea programada lee los pedidos abiertos'
);
select lives_ok(
  $$insert into public.daily_reports (location_id, report_date, facts)
    values (pg_temp.location_id(), '2026-10-02', '{"version": 1}')$$,
  'la tarea programada guarda el informe'
);
select throws_ok(
  $$delete from public.assistant_usage$$,
  '42501', null, 'ni el servidor borra el registro de uso'
);

-- Un cliente con sesión tampoco lee el vigilante.
reset role;
set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000064', 'aal2');
select throws_ok(
  $$select * from public.admin_stock_watch_facts(pg_temp.location_id())$$,
  '42501', null, 'un cliente no lee el vigilante'
);

select * from finish();
rollback;
