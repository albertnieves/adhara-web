-- Métricas por producto de la consola del titular: solo el titular con MFA,
-- serie densa por tramos de Europe/Madrid (unidades, importes, coste de lo
-- vendido, existencias, días con existencias, PVP y coste al cierre) e
-- historial de PVP y coste. Datos ficticios; la transacción se revierte.
begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;

select plan(49);

insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-000000000101', 'titular@test.invalid'),
  ('00000000-0000-4000-8000-000000000102', 'tienda@test.invalid'),
  ('00000000-0000-4000-8000-000000000103', 'encargado@test.invalid'),
  ('00000000-0000-4000-8000-000000000104', 'otro-sistema@test.invalid');

insert into public.staff_members (user_id, role) values
  ('00000000-0000-4000-8000-000000000101', 'system_admin'),
  ('00000000-0000-4000-8000-000000000102', 'store_admin'),
  ('00000000-0000-4000-8000-000000000103', 'viewer'),
  ('00000000-0000-4000-8000-000000000104', 'system_admin');

insert into internal.control_owners (user_id) values
  ('00000000-0000-4000-8000-000000000101');

-- A y B: formatos del mismo perfume; C: formato inactivo de un perfume
-- archivado; D: solo tiene un movimiento justo al final del periodo; E: sin
-- movimientos; F: en dos ubicaciones y en horario de invierno. Sin PVP al
-- crearlos, para que el historial sea solo el de abajo.
insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-0000000010b1', 'marca-metricas', 'Marca de métricas');
insert into public.products (id, brand_id, slug, name, status) values
  ('00000000-0000-4000-8000-0000000010a1', '00000000-0000-4000-8000-0000000010b1',
   'perfume-metricas', 'Perfume de métricas', 'draft'),
  ('00000000-0000-4000-8000-0000000010a2', '00000000-0000-4000-8000-0000000010b1',
   'archivado-metricas', 'Archivado de métricas', 'archived');
insert into public.product_variants (id, product_id, size_ml, active) values
  ('00000000-0000-4000-8000-0000000010c1', '00000000-0000-4000-8000-0000000010a1', 100, true),
  ('00000000-0000-4000-8000-0000000010c2', '00000000-0000-4000-8000-0000000010a1', 50, true),
  ('00000000-0000-4000-8000-0000000010c3', '00000000-0000-4000-8000-0000000010a2', 30, false),
  ('00000000-0000-4000-8000-0000000010c4', '00000000-0000-4000-8000-0000000010a1', 10, true),
  ('00000000-0000-4000-8000-0000000010c5', '00000000-0000-4000-8000-0000000010a1', 5, true),
  ('00000000-0000-4000-8000-0000000010c6', '00000000-0000-4000-8000-0000000010a1', 75, true);
insert into public.stock_locations (code, name, kind) values
  ('almacen-metricas', 'Almacén de métricas', 'warehouse');

create function pg_temp.act_as(user_id text, aal text) returns void
language sql as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'aal', aal, 'role', 'authenticated')::text,
    true
  );
$$;

create function pg_temp.location_id(p_code text default 'castelldefels') returns uuid
language sql as $$
  select id from public.stock_locations where code = p_code;
$$;

-- Movimiento con fecha explícita y saldos coherentes por ubicación (se
-- insertan en orden cronológico): inventory_movements es de solo inserción,
-- pero el propietario puede insertar.
create function pg_temp.move(
  p_variant uuid, p_type text, p_quantity integer, p_at timestamptz,
  p_location text default 'castelldefels'
) returns bigint
language sql as $$
  insert into public.inventory_movements (
    variant_id, location_id, type, quantity, delta_on_hand, delta_reserved,
    on_hand_after, reserved_after, created_at
  )
  select p_variant, pg_temp.location_id(p_location), p_type, p_quantity,
         e.on_hand * p_quantity, e.reserved * p_quantity,
         coalesce(s.on_hand, 0) + e.on_hand * p_quantity,
         coalesce(s.reserved, 0) + e.reserved * p_quantity,
         p_at
  from private.movement_effect(p_type) e
  cross join lateral (
    select sum(m.delta_on_hand) as on_hand, sum(m.delta_reserved) as reserved
    from public.inventory_movements m
    where m.variant_id = p_variant and m.location_id = pg_temp.location_id(p_location)
  ) s
  returning id;
$$;

-- Venta o devolución de mostrador con su línea y su precio cobrado.
create function pg_temp.counter(
  p_variant uuid, p_kind text, p_quantity integer, p_price integer, p_retail integer,
  p_at timestamptz
) returns void
language plpgsql as $$
declare
  v_move bigint;
  v_sale bigint;
begin
  v_move := pg_temp.move(p_variant,
    case p_kind when 'sale' then 'SALE_STORE' else 'RETURN' end, p_quantity, p_at);
  insert into public.store_sales (request_id, location_id, kind, units, created_at)
  values (gen_random_uuid(), pg_temp.location_id(), p_kind, p_quantity, p_at)
  returning id into v_sale;
  insert into public.store_sale_lines (
    sale_id, variant_id, quantity, movement_id, unit_price_cents, retail_price_cents
  ) values (v_sale, p_variant, p_quantity, v_move, p_price, p_retail);
end;
$$;

-- Tramos de la serie de un formato como filas, en el orden del array.
create function pg_temp.buckets(p_variant uuid, p_from date, p_to date, p_grain text)
returns table (
  b date, sold integer, ret integer, lost integer, rec integer, psold integer,
  gross integer, list integer, rgross integer, cogs integer, unc integer,
  tickets integer, close integer, instock integer, days integer, pvp integer,
  cost integer
)
language sql as $$
  select (x ->> 'b')::date, (x ->> 'sold')::integer, (x ->> 'ret')::integer,
         (x ->> 'lost')::integer, (x ->> 'rec')::integer, (x ->> 'psold')::integer,
         (x ->> 'gross')::integer, (x ->> 'list')::integer, (x ->> 'rgross')::integer,
         (x ->> 'cogs')::integer, (x ->> 'unc')::integer, (x ->> 'tickets')::integer,
         (x ->> 'close')::integer, (x ->> 'instock')::integer, (x ->> 'days')::integer,
         (x ->> 'pvp')::integer, (x ->> 'cost')::integer
  from public.admin_control_variant_series(p_from, p_to, p_grain) s
  cross join lateral jsonb_array_elements(s.series) with ordinality as e(x, n)
  where s.variant_id = p_variant
  order by e.n;
$$;
grant execute on function pg_temp.buckets(uuid, date, date, text) to authenticated;

-- Formato A (horas de Madrid, CEST = +02). Semana 1 [31-08, 07-09): 5 en
-- stock, venta de 2 con precio a las 01:30 del 2 (23:30 UTC del 1), venta de
-- 3 sin precio el 3 y rotura de stock del 4 al 6. Semana 2 [07-09, 14-09):
-- entrada de 4 y venta de 1 el 8, devolución con precio el 10, merma el 11,
-- venta con precio el 13.
select pg_temp.move('00000000-0000-4000-8000-0000000010c1', 'PURCHASE_RECEIPT', 5,
  '2026-08-20 10:00+02');
select pg_temp.counter('00000000-0000-4000-8000-0000000010c1', 'sale', 2, 4000, 5000,
  '2026-09-01 23:30+00');
select pg_temp.move('00000000-0000-4000-8000-0000000010c1', 'SALE_STORE', 3,
  '2026-09-03 12:00+02');
select pg_temp.move('00000000-0000-4000-8000-0000000010c1', 'PURCHASE_RECEIPT', 4,
  '2026-09-08 09:00+02');
select pg_temp.move('00000000-0000-4000-8000-0000000010c1', 'SALE_STORE', 1,
  '2026-09-08 17:00+02');
select pg_temp.counter('00000000-0000-4000-8000-0000000010c1', 'return', 1, 4000, 5000,
  '2026-09-10 18:00+02');
select pg_temp.move('00000000-0000-4000-8000-0000000010c1', 'DAMAGE_LOSS', 1,
  '2026-09-11 11:00+02');
select pg_temp.counter('00000000-0000-4000-8000-0000000010c1', 'sale', 1, 5000, 5000,
  '2026-09-13 12:00+02');
-- Coste: 20,00 € desde el 15-08 y 22,00 € desde el 12-09. PVP: 50,00 € desde
-- el 01-08 y rebaja a 45,00 € (antes 50,00 €) justo al final de la semana 2.
insert into internal.variant_cost_records (variant_id, cost_net_cents, at) values
  ('00000000-0000-4000-8000-0000000010c1', 2000, '2026-08-15 10:00+02'),
  ('00000000-0000-4000-8000-0000000010c1', 2200, '2026-09-12 10:00+02');
insert into internal.price_change_log (
  variant_id, old_price_cents, new_price_cents, old_compare_at_cents, new_compare_at_cents, at
) values
  ('00000000-0000-4000-8000-0000000010c1', null, 5000, null, null, '2026-08-01 10:00+02'),
  ('00000000-0000-4000-8000-0000000010c1', 5000, 4500, null, 5000, '2026-09-14 00:00+02');

-- Formato B: entrada de 2 el 5; el 9, una línea de mostrador sin precio
-- cobrado (con PVP anotado: no cuenta en list) y el 12, una venta con precio de
-- un formato sin PVP (cuenta en gross, no en list). Sin historial de PVP y con
-- un coste registrado justo al final del periodo (posterior a todo él).
select pg_temp.move('00000000-0000-4000-8000-0000000010c2', 'PURCHASE_RECEIPT', 2,
  '2026-09-05 10:00+02');
select pg_temp.counter('00000000-0000-4000-8000-0000000010c2', 'sale', 1, null, 3000,
  '2026-09-09 10:00+02');
select pg_temp.counter('00000000-0000-4000-8000-0000000010c2', 'sale', 1, 2500, null,
  '2026-09-12 10:00+02');
insert into internal.variant_cost_records (variant_id, cost_net_cents, at) values
  ('00000000-0000-4000-8000-0000000010c2', 1500, '2026-09-14 00:00+02');

-- Formato C (archivado): entrada en julio, una venta y una devolución sin
-- ningún coste.
select pg_temp.move('00000000-0000-4000-8000-0000000010c3', 'PURCHASE_RECEIPT', 3,
  '2026-07-01 10:00+02');
select pg_temp.move('00000000-0000-4000-8000-0000000010c3', 'SALE_STORE', 1,
  '2026-09-01 10:00+02');
select pg_temp.move('00000000-0000-4000-8000-0000000010c3', 'RETURN', 1,
  '2026-09-08 10:00+02');

-- Formato D: su único movimiento es justo el final del periodo (excluido).
select pg_temp.move('00000000-0000-4000-8000-0000000010c4', 'PURCHASE_RECEIPT', 1,
  '2026-09-14 00:00+02');

-- Formato F (horario de invierno, CET = +01, hasta el 29-03): entrada de 2 en
-- la tienda el 20-03; entrada de 3 en otro almacén justo a las 00:00 del 23-03
-- (inicio de semana); reserva y venta online de 1 a las 23:30 del 27-03 en
-- Madrid (22:30 UTC) y ajuste manual de −1 el 31-03. Sin coste ni PVP.
select pg_temp.move('00000000-0000-4000-8000-0000000010c6', 'PURCHASE_RECEIPT', 2,
  '2026-03-20 10:00+01');
select pg_temp.move('00000000-0000-4000-8000-0000000010c6', 'PURCHASE_RECEIPT', 3,
  '2026-03-23 00:00+01', 'almacen-metricas');
select pg_temp.move('00000000-0000-4000-8000-0000000010c6', 'RESERVATION', 1,
  '2026-03-27 22:20+00', 'almacen-metricas');
select pg_temp.move('00000000-0000-4000-8000-0000000010c6', 'SALE_ONLINE', 1,
  '2026-03-27 22:30+00', 'almacen-metricas');
select pg_temp.move('00000000-0000-4000-8000-0000000010c6', 'MANUAL_ADJUSTMENT', -1,
  '2026-03-31 10:00+02');

-- Acceso
select ok(
  (select bool_and(p.prosecdef and p.provolatile = 's'
                   and p.proconfig @> array['search_path=""'])
   from pg_proc p
   where p.oid in ('public.admin_control_variant_series(date, date, text)'::regprocedure,
                   'public.admin_control_variant_events(uuid[])'::regprocedure)),
  'las dos funciones son de lectura, security definer y con search_path vacío');

set local role anon;
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-08-31', '2026-09-14')$$,
  '42501', null, 'anon no lee la serie');
select throws_ok(
  $$select * from public.admin_control_variant_events(
    array['00000000-0000-4000-8000-0000000010c1']::uuid[])$$,
  '42501', null, 'anon no lee el historial de PVP y coste');
reset role;

set local role authenticated;
select pg_temp.act_as('00000000-0000-4000-8000-000000000103', 'aal2');
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-08-31', '2026-09-14')$$,
  '42501', 'forbidden', 'el encargado no lee la serie');
select throws_ok(
  $$select * from public.admin_control_variant_events(
    array['00000000-0000-4000-8000-0000000010c1']::uuid[])$$,
  '42501', 'forbidden', 'ni el historial');
select pg_temp.act_as('00000000-0000-4000-8000-000000000102', 'aal2');
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-08-31', '2026-09-14')$$,
  '42501', 'forbidden', 'el administrador de la tienda no lee la serie');
select throws_ok(
  $$select * from public.admin_control_variant_events(
    array['00000000-0000-4000-8000-0000000010c1']::uuid[])$$,
  '42501', 'forbidden', 'ni el historial de coste');
select pg_temp.act_as('00000000-0000-4000-8000-000000000104', 'aal2');
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-08-31', '2026-09-14')$$,
  '42501', 'forbidden', 'otro administrador del sistema no titular no lee la serie');
select throws_ok(
  $$select * from public.admin_control_variant_events(
    array['00000000-0000-4000-8000-0000000010c1']::uuid[])$$,
  '42501', 'forbidden', 'ni el historial');
select pg_temp.act_as('00000000-0000-4000-8000-000000000101', 'aal1');
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-08-31', '2026-09-14')$$,
  '42501', 'forbidden', 'el titular sin MFA no lee la serie');
select throws_ok(
  $$select * from public.admin_control_variant_events(
    array['00000000-0000-4000-8000-0000000010c1']::uuid[])$$,
  '42501', 'forbidden', 'ni el historial');

-- Titular con MFA
select pg_temp.act_as('00000000-0000-4000-8000-000000000101', 'aal2');
select lives_ok(
  $$select * from public.admin_control_variant_series('2026-08-31', '2026-09-14')$$,
  'el titular con MFA lee la serie (por semanas si no se indica)');

-- Periodo y grano
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-09-14', '2026-09-14')$$,
  '22023', 'invalid_period', 'un periodo vacío no vale');
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-09-14', '2026-08-31')$$,
  '22023', 'invalid_period', 'ni uno al revés');
select throws_ok(
  $$select * from public.admin_control_variant_series(null, '2026-09-14')$$,
  '22023', 'invalid_period', 'ni uno sin inicio');
select throws_ok(
  $$select * from public.admin_control_variant_series('-infinity', '2026-09-14')$$,
  '22023', 'invalid_period', 'ni uno con una fecha infinita');
select lives_ok(
  $$select * from public.admin_control_variant_series('2026-05-01', '2026-08-29', 'day')$$,
  'por días, hasta 120 días');
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-05-01', '2026-08-30', 'day')$$,
  '22023', 'invalid_period', 'por días, no más de 120');
select lives_ok(
  $$select * from public.admin_control_variant_series('2024-09-01', '2026-09-06', 'week')$$,
  'por semanas, hasta 735 días');
select throws_ok(
  $$select * from public.admin_control_variant_series('2024-09-01', '2026-09-07', 'week')$$,
  '22023', 'invalid_period', 'por semanas, no más de 735 días');
select lives_ok(
  $$select * from public.admin_control_variant_series('2021-09-01', '2026-09-05', 'month')$$,
  'por meses, hasta 1830 días');
select throws_ok(
  $$select * from public.admin_control_variant_series('2021-09-01', '2026-09-06', 'month')$$,
  '22023', 'invalid_period', 'por meses, no más de 1830 días');
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-08-31', '2026-09-14', 'year')$$,
  '22023', 'invalid_grain', 'un grano desconocido no vale');
select throws_ok(
  $$select * from public.admin_control_variant_series('2026-08-31', '2026-09-14', null)$$,
  '22023', 'invalid_grain', 'ni un grano vacío');

-- Formatos: los que tienen algún movimiento antes del final, también archivados
select results_eq(
  $$select variant_id::text
    from public.admin_control_variant_series('2026-08-31', '2026-09-14')
    where variant_id::text like '00000000-0000-4000-8000-0000000010c_'$$,
  $$values ('00000000-0000-4000-8000-0000000010c1'), ('00000000-0000-4000-8000-0000000010c2'),
           ('00000000-0000-4000-8000-0000000010c3'), ('00000000-0000-4000-8000-0000000010c6')$$,
  'una fila por formato con movimientos antes del final, también archivados, ordenadas');
select is(
  (select jsonb_agg(s.series order by s.variant_id)
   from public.admin_control_variant_series('2026-08-31', '2026-09-14') s),
  (select jsonb_agg(s.series order by s.variant_id)
   from public.admin_control_variant_series('2026-08-31', '2026-09-14', 'week') s),
  'sin grano, la serie va por semanas');
select is(
  (select array_agg(k order by k)
   from public.admin_control_variant_series('2026-08-31', '2026-09-14') s,
        jsonb_object_keys(s.series -> 0) k
   where s.variant_id = '00000000-0000-4000-8000-0000000010c1'),
  array['b', 'close', 'cogs', 'cost', 'days', 'gross', 'instock', 'list', 'lost', 'psold',
        'pvp', 'rec', 'ret', 'rgross', 'sold', 'tickets', 'unc'],
  'cada tramo lleva exactamente las claves acordadas');
-- El dominio lee números JSON enteros: ni textos ni decimales.
select is_empty(
  $$select s.variant_id, x
    from public.admin_control_variant_series('2026-08-03', '2026-09-14') s
    cross join lateral jsonb_array_elements(s.series) x
    where s.variant_id::text like '00000000-0000-4000-8000-0000000010c_'
      and ((select count(*) from jsonb_object_keys(x)) <> 17
           or jsonb_typeof(x -> 'b') <> 'string'
           or x ->> 'b' !~ '^\d{4}-\d{2}-\d{2}$'
           or exists (
             select 1 from jsonb_each(x) kv
             where kv.key <> 'b'
               and not ((jsonb_typeof(kv.value) = 'number' and kv.value::text ~ '^-?\d+$')
                        or (kv.key in ('pvp', 'cost') and jsonb_typeof(kv.value) = 'null'))))$$,
  'en todos los tramos, b es una fecha y las cifras son enteros (pvp y cost, o null)');

-- Formato A por semanas
select results_eq(
  $$select b, sold, ret, lost, rec
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-08-31', '2026-09-14',
      'week')$$,
  $$values ('2026-08-31'::date, 5, 0, 0, 0), ('2026-09-07', 2, 1, 1, 4)$$,
  'unidades vendidas, devueltas, perdidas y recibidas por semana');
select results_eq(
  $$select psold, gross, list, rgross, tickets
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-08-31', '2026-09-14',
      'week')$$,
  $$values (2, 8000, 10000, 0, 1), (1, 5000, 5000, 4000, 1)$$,
  'importe cobrado, PVP de lo cobrado, devuelto y tickets del mostrador');
select results_eq(
  $$select cogs, unc
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-08-31', '2026-09-14',
      'week')$$,
  $$values (10000, 0), (2200, 0)$$,
  'coste de lo vendido menos lo devuelto con el coste de cada movimiento');
select results_eq(
  $$select close, instock, days
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-08-31', '2026-09-14',
      'week')$$,
  $$values (0, 4, 7), (2, 6, 7)$$,
  'existencias al cierre y días con existencias: la rotura no cuenta; entrar y vender, sí');
select results_eq(
  $$select pvp, cost
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-08-31', '2026-09-14',
      'week')$$,
  $$values (5000, 2000), (5000, 2200)$$,
  'PVP y coste vigentes al cierre; el cambio justo en el cierre no cuenta');

-- Formato A por días: la venta de las 23:30 UTC del 1 es del 2 en Madrid
select results_eq(
  $$select b, sold, close, instock, days
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-09-01', '2026-09-05',
      'day')$$,
  $$values ('2026-09-01'::date, 0, 5, 1, 1), ('2026-09-02', 2, 3, 1, 1),
           ('2026-09-03', 3, 0, 1, 1), ('2026-09-04', 0, 0, 0, 1)$$,
  'por días en hora de Madrid, con la rotura de stock');

-- Formato A por meses: el inicio se alinea al día 1
select results_eq(
  $$select b, sold, ret, lost, rec, gross, cogs, close, instock, days, pvp, cost
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-09-15', '2026-10-01',
      'month')$$,
  $$values ('2026-09-01'::date, 7, 1, 1, 4, 13000, 12200, 2, 26, 30, 4500, 2200)$$,
  'por meses, con el inicio alineado y la rebaja vigente al cierre');

-- Serie densa: también las semanas sin movimientos
select results_eq(
  $$select b, sold, close, instock, days
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-08-05', '2026-09-14',
      'week')$$,
  $$values ('2026-08-03'::date, 0, 0, 0, 7), ('2026-08-10', 0, 0, 0, 7),
           ('2026-08-17', 0, 5, 3, 7), ('2026-08-24', 0, 5, 7, 7),
           ('2026-08-31', 5, 0, 4, 7), ('2026-09-07', 2, 2, 6, 7)$$,
  'un tramo por semana, también vacío, con el inicio alineado al lunes');

-- Último tramo cortado en el final del periodo
select results_eq(
  $$select b, sold, close, days, cost
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-08-31', '2026-09-10',
      'week')$$,
  $$values ('2026-08-31'::date, 5, 0, 7, 2000), ('2026-09-07', 1, 3, 3, 2000)$$,
  'el último tramo se corta en el final del periodo, también para el coste al cierre');

-- Formato B: coste solo posterior y sin PVP
select results_eq(
  $$select b, sold, rec, cogs, unc, close, instock, pvp, cost
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c2', '2026-08-31', '2026-09-14',
      'week')$$,
  $$values ('2026-08-31'::date, 0, 2, 0, 0, 2, 1, null::integer, null::integer),
           ('2026-09-07', 2, 0, 3000, 0, 0, 6, null, null)$$,
  'sin PVP ni coste anterior al cierre: nulos; lo vendido se estima con el primer coste posterior');
select results_eq(
  $$select psold, gross, list, tickets
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c2', '2026-08-31', '2026-09-14',
      'week')$$,
  $$values (0, 0, 0, 0), (1, 2500, 0, 2)$$,
  'list solo suma el PVP de las líneas con precio cobrado y PVP');

-- Formato C: archivado, venta y devolución sin ningún coste
select results_eq(
  $$select b, sold, ret, cogs, unc, close, instock, days
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c3', '2026-08-31', '2026-09-14',
      'week')$$,
  $$values ('2026-08-31'::date, 1, 0, 0, 1, 2, 7, 7), ('2026-09-07', 0, 1, 0, 1, 3, 7, 7)$$,
  'un formato archivado con saldo inicial: lo vendido y lo devuelto sin coste van a unc');

-- Formato F: todas las ubicaciones, venta online, ajuste y horario de invierno
select results_eq(
  $$select b, sold, ret, lost, rec, psold, gross, tickets, unc, close, instock
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c6', '2026-03-23', '2026-04-06',
      'week')$$,
  $$values ('2026-03-23'::date, 1, 0, 0, 3, 0, 0, 0, 1, 4, 7),
           ('2026-03-30', 0, 0, 0, 0, 0, 0, 0, 0, 3, 7)$$,
  'las dos ubicaciones y la entrada a las 00:00 del inicio; la venta online sin precio; '
  || 'el ajuste solo cambia las existencias');
select results_eq(
  $$select b, sold, close
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c6', '2026-03-27', '2026-03-29',
      'day')$$,
  $$values ('2026-03-27'::date, 1, 4), ('2026-03-28', 0, 4)$$,
  'en horario de invierno, las 22:30 UTC aún son el mismo día en Madrid');

-- Días posteriores a hoy (Madrid): ni cuentan ni tienen existencias
select results_eq(
  $$select b, days, instock, close, pvp
    from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1',
      (now() at time zone 'Europe/Madrid')::date - 1,
      (now() at time zone 'Europe/Madrid')::date + 3, 'day')$$,
  $$select d::date, case when i <= 2 then 1 else 0 end, case when i <= 2 then 1 else 0 end,
           2, 4500
    from generate_series((now() at time zone 'Europe/Madrid')::date - 1,
                         (now() at time zone 'Europe/Madrid')::date + 2,
                         interval '1 day') with ordinality as g(d, i)$$,
  'los días posteriores a hoy no cuentan en days ni en instock');

-- Cuadre: existencias al cierre = saldo inicial + recibido − vendido + devuelto − perdido
select is(
  (select sum(rec - sold + ret - lost)::integer
   from pg_temp.buckets('00000000-0000-4000-8000-0000000010c1', '2026-08-03', '2026-09-14',
     'week')),
  2, 'el cierre cuadra con las unidades de los tramos');

-- Historial de PVP y coste
select results_eq(
  $$select variant_id::text, at, kind, price_cents, compare_at_cents, cost_net_cents
    from public.admin_control_variant_events(array[
      '00000000-0000-4000-8000-0000000010c2', '00000000-0000-4000-8000-0000000010c1',
      '00000000-0000-4000-8000-0000000010c5']::uuid[])$$,
  $$values
    ('00000000-0000-4000-8000-0000000010c1', '2026-08-01 10:00+02'::timestamptz, 'price',
     5000, null::integer, null::integer),
    ('00000000-0000-4000-8000-0000000010c1', '2026-08-15 10:00+02', 'cost', null, null, 2000),
    ('00000000-0000-4000-8000-0000000010c1', '2026-09-12 10:00+02', 'cost', null, null, 2200),
    ('00000000-0000-4000-8000-0000000010c1', '2026-09-14 00:00+02', 'price', 4500, 5000, null),
    ('00000000-0000-4000-8000-0000000010c2', '2026-09-14 00:00+02', 'cost', null, null, 1500)$$,
  'cambios de PVP y de coste, por formato y fecha');
select is_empty(
  $$select * from public.admin_control_variant_events(array[]::uuid[])$$,
  'sin formatos, sin historial');
select lives_ok(
  $$select * from public.admin_control_variant_events(
    array(select gen_random_uuid() from generate_series(1, 200)))$$,
  'hasta 200 formatos');
select throws_ok(
  $$select * from public.admin_control_variant_events(
    array(select gen_random_uuid() from generate_series(1, 201)))$$,
  '22023', 'invalid_items', 'no más de 200 formatos');
select throws_ok(
  $$select * from public.admin_control_variant_events(null)$$,
  '22023', 'invalid_items', 'la lista de formatos es obligatoria');

reset role;

select * from finish();
rollback;
