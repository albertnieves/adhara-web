-- Métricas por producto de la consola del titular (/admin/control/productos).
-- Solo lectura y solo el titular con MFA (private.require_business_control):
-- la serie lleva costes. Sin tablas nuevas.
--
-- admin_control_variant_series devuelve, por formato, una serie densa de
-- tramos (día, semana ISO o mes de Europe/Madrid) con unidades, importes,
-- coste de lo vendido, existencias y PVP y coste vigentes al cierre. El
-- dominio (src/modules/control/domain/product-metrics.ts) calcula a partir de
-- ahí la demanda, la tendencia y la previsión.
--
-- Las unidades vendidas incluyen toda venta (mostrador, online y recogida en
-- tienda) porque salen del grupo 'sold' de private.movement_report_bucket. El
-- precio cobrado solo existe hoy en las líneas del mostrador
-- (store_sale_lines); el de las ventas online se unirá aquí cuando exista la
-- tabla de pedidos. Mientras, esas ventas cuentan en «sold» pero no en «psold».

-- Serie por formato en [p_from, p_to) en días de Europe/Madrid. p_from se
-- alinea al inicio de su tramo; el último tramo se corta en p_to. Una fila por
-- formato con algún movimiento antes de p_to, también de perfumes archivados o
-- formatos inactivos. Cada tramo (también los vacíos) es un objeto con:
--   b        inicio del tramo (YYYY-MM-DD)
--   sold, ret, lost, rec
--            unidades por grupo de movimiento (vendidas, devueltas, mermas y
--            probadores, entradas de compra y de traslado)
--   psold    vendidas con precio cobrado
--   gross    céntimos cobrados con IVA de lo vendido
--   list     Σ unidades × PVP del momento de las líneas con precio y PVP
--   rgross   céntimos cobrados de lo devuelto
--   cogs     coste neto de lo vendido menos lo devuelto, con el coste vigente
--            en cada movimiento (o el primero posterior, como en los hechos del
--            mes)
--   unc      unidades vendidas o devueltas sin ningún coste registrado
--   tickets  ventas de mostrador distintas con este formato (un ticket con
--            varios formatos cuenta en cada uno: no se suman entre formatos)
--   close    existencias al cierre del tramo, todas las ubicaciones
--   instock  días con existencias al empezar el día o con alguna venta ese día
--   days     días del tramo dentro del periodo y no posteriores a hoy (Madrid)
--   pvp      PVP vigente al cierre según el historial de PVP; null si no hay
--   cost     coste neto vigente al cierre; null si no hay ninguno anterior
-- Los días posteriores a hoy no cuentan en «days» ni en «instock».
create function public.admin_control_variant_series(
  p_from date,
  p_to date,
  p_grain text default 'week'
)
returns table (variant_id uuid, series jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_step interval;
  v_from date;
  v_from_at timestamptz;
  v_to_at timestamptz;
  v_today date := (now() at time zone 'Europe/Madrid')::date;
begin
  perform private.require_business_control();
  v_step := case p_grain
    when 'day' then interval '1 day'
    when 'week' then interval '7 days'
    when 'month' then interval '1 month'
  end;
  if v_step is null then
    raise exception 'invalid_grain' using errcode = '22023';
  end if;
  -- Fechas finitas y en orden (restar una infinita lanza otro error), con un
  -- límite por grano: 120 días, 105 semanas o unos 60 meses de tramos.
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to)
     or p_from >= p_to then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  if p_to - p_from > (case p_grain when 'day' then 120 when 'week' then 735 else 1830 end) then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  v_from := date_trunc(p_grain, p_from::timestamp)::date;
  v_from_at := v_from::timestamp at time zone 'Europe/Madrid';
  v_to_at := p_to::timestamp at time zone 'Europe/Madrid';

  return query
    -- Formatos con algún movimiento antes del final y el primer día del periodo
    -- en que pueden tener existencias (antes de su primer movimiento, no).
    with variants as (
      select mv.variant_id as vid,
             greatest(v_from, (min(mv.created_at) at time zone 'Europe/Madrid')::date)
               as first_day
      from public.inventory_movements mv
      where mv.created_at < v_to_at
      group by mv.variant_id
    ),
    -- Un día por fila, con el tramo al que pertenece.
    period_days as (
      select d::date as day, date_trunc(p_grain, d)::date as b
      from generate_series(v_from::timestamp, (p_to - 1)::timestamp, interval '1 day') d
    ),
    -- Tramos del periodo con sus días no posteriores a hoy.
    period_buckets as (
      select pd.b, count(*) filter (where pd.day <= v_today)::integer as days
      from period_days pd
      group by pd.b
    ),
    -- Saldo inicial: todo lo anterior al periodo, en todas las ubicaciones.
    opening as (
      select mv.variant_id as vid, sum(mv.delta_on_hand)::integer as units
      from public.inventory_movements mv
      where mv.created_at < v_from_at
      group by mv.variant_id
    ),
    -- Movimientos del periodo con su línea de mostrador, si la tienen. Las
    -- funciones auxiliares (con set search_path no se expanden en la consulta)
    -- se llaman una vez por tipo de movimiento y una vez por venta o
    -- devolución: de ahí las CTE materializadas.
    period_moves as materialized (
      select mv.variant_id as vid,
             mv.created_at,
             (mv.created_at at time zone 'Europe/Madrid')::date as day,
             mv.type,
             mv.delta_on_hand as delta,
             abs(mv.delta_on_hand) as units,
             l.sale_id,
             l.unit_price_cents as price,
             l.retail_price_cents as retail
      from public.inventory_movements mv
      left join public.store_sale_lines l on l.movement_id = mv.id
      where mv.created_at >= v_from_at
        and mv.created_at < v_to_at
        and mv.delta_on_hand <> 0
    ),
    type_buckets as materialized (
      select t.type, private.movement_report_bucket(t.type) as bucket
      from (select distinct pm.type from period_moves pm) t
    ),
    -- El coste solo se busca para lo vendido y lo devuelto.
    moves as materialized (
      select pm.vid, pm.day, tb.bucket, pm.delta, pm.units, pm.sale_id, pm.price,
             pm.retail,
             case when tb.bucket in ('sold', 'returned') then
               (select f.cost_net_cents from private.variant_cost_for(pm.vid, pm.created_at) f)
             end as cost
      from period_moves pm
      join type_buckets tb on tb.type = pm.type
    ),
    daily as (
      select m.vid, m.day,
             sum(m.delta)::integer as delta,
             coalesce(sum(m.units) filter (where m.bucket = 'sold'), 0)::integer as sold,
             coalesce(sum(m.units) filter (where m.bucket = 'returned'), 0)::integer as ret,
             coalesce(sum(m.units) filter (where m.bucket = 'lost'), 0)::integer as lost,
             coalesce(sum(m.units) filter (where m.bucket = 'received'), 0)::integer as rec,
             coalesce(sum(m.units) filter (
               where m.bucket = 'sold' and m.price is not null), 0)::integer as psold,
             coalesce(sum(m.units::bigint * m.price) filter (where m.bucket = 'sold'), 0)
               as gross,
             coalesce(sum(m.units::bigint * m.retail) filter (
               where m.bucket = 'sold' and m.price is not null and m.retail is not null), 0)
               as list,
             coalesce(sum(m.units::bigint * m.price) filter (where m.bucket = 'returned'), 0)
               as rgross,
             coalesce(sum(m.units::bigint * m.cost) filter (where m.bucket = 'sold'), 0)
               - coalesce(sum(m.units::bigint * m.cost) filter (where m.bucket = 'returned'), 0)
               as cogs,
             coalesce(sum(m.units) filter (
               where m.bucket in ('sold', 'returned') and m.cost is null), 0)::integer as unc,
             -- Una venta de mostrador tiene una sola línea (y un movimiento) por
             -- formato: contar líneas es contar ventas distintas.
             count(m.sale_id) filter (where m.bucket = 'sold')::integer as tickets
      from moves m
      group by m.vid, m.day
    ),
    -- Existencias al cierre de cada día desde el primero del formato: saldo
    -- inicial + deltas acumulados.
    stock_days as (
      select v.vid, d.b, d.day,
             coalesce(dl.delta, 0) as delta,
             coalesce(dl.sold, 0) as sold,
             coalesce(o.units, 0)
               + sum(coalesce(dl.delta, 0)) over (partition by v.vid order by d.day)
               as day_close
      from variants v
      join period_days d on d.day >= v.first_day
      left join daily dl on dl.vid = v.vid and dl.day = d.day
      left join opening o on o.vid = v.vid
    ),
    stock_buckets as (
      select s.vid, s.b,
             (array_agg(s.day_close order by s.day desc))[1] as closing,
             count(*) filter (
               where s.day <= v_today and (s.day_close - s.delta > 0 or s.sold > 0))::integer
               as instock
      from stock_days s
      group by s.vid, s.b
    ),
    unit_buckets as (
      select dl.vid, date_trunc(p_grain, dl.day::timestamp)::date as b,
             sum(dl.sold) as sold, sum(dl.ret) as ret, sum(dl.lost) as lost,
             sum(dl.rec) as rec, sum(dl.psold) as psold, sum(dl.gross) as gross,
             sum(dl.list) as list, sum(dl.rgross) as rgross, sum(dl.cogs) as cogs,
             sum(dl.unc) as unc, sum(dl.tickets) as tickets
      from daily dl
      group by 1, 2
    ),
    -- Serie densa: todos los tramos de cada formato, también los vacíos.
    buckets as (
      select v.vid, pb.b, pb.days,
             coalesce(u.sold, 0) as sold, coalesce(u.ret, 0) as ret,
             coalesce(u.lost, 0) as lost, coalesce(u.rec, 0) as rec,
             coalesce(u.psold, 0) as psold, coalesce(u.gross, 0) as gross,
             coalesce(u.list, 0) as list, coalesce(u.rgross, 0) as rgross,
             coalesce(u.cogs, 0) as cogs, coalesce(u.unc, 0) as unc,
             coalesce(u.tickets, 0) as tickets,
             coalesce(sb.closing, 0) as closing,
             coalesce(sb.instock, 0) as instock
      from variants v
      cross join period_buckets pb
      left join stock_buckets sb on sb.vid = v.vid and sb.b = pb.b
      left join unit_buckets u on u.vid = v.vid and u.b = pb.b
    )
    select bk.vid,
           jsonb_agg(jsonb_build_object(
             'b', to_char(bk.b::timestamp, 'YYYY-MM-DD'),
             'sold', bk.sold,
             'ret', bk.ret,
             'lost', bk.lost,
             'rec', bk.rec,
             'psold', bk.psold,
             'gross', bk.gross,
             'list', bk.list,
             'rgross', bk.rgross,
             'cogs', bk.cogs,
             'unc', bk.unc,
             'tickets', bk.tickets,
             'close', bk.closing,
             'instock', bk.instock,
             'days', bk.days,
             'pvp', p.price,
             'cost', c.cost
           ) order by bk.b)
    from buckets bk
    cross join lateral (
      select least(bk.b + v_step, p_to::timestamp) at time zone 'Europe/Madrid' as end_at
    ) e
    left join lateral (
      select l.new_price_cents as price
      from internal.price_change_log l
      where l.variant_id = bk.vid and l.at < e.end_at
      order by l.at desc, l.id desc
      limit 1
    ) p on true
    -- Lo mismo que private.variant_cost_for(formato, cierre) cuando no es
    -- posterior, con una sola búsqueda en el índice por tramo.
    left join lateral (
      select r.cost_net_cents as cost
      from internal.variant_cost_records r
      where r.variant_id = bk.vid and r.at < e.end_at
      order by r.at desc, r.id desc
      limit 1
    ) c on true
    group by bk.vid
    order by bk.vid;
end;
$$;

-- Historial de PVP (kind 'price': PVP y precio anterior tachado tras el
-- cambio) y de coste neto (kind 'cost') de hasta 200 formatos, por formato y
-- fecha. Para marcar los cambios en la gráfica y estimar la elasticidad.
create function public.admin_control_variant_events(p_variant_ids uuid[])
returns table (
  variant_id uuid,
  at timestamptz,
  kind text,
  price_cents integer,
  compare_at_cents integer,
  cost_net_cents integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_business_control();
  if p_variant_ids is null or cardinality(p_variant_ids) > 200 then
    raise exception 'invalid_items' using errcode = '22023';
  end if;
  return query
    select e.vid, e.at, e.kind, e.price, e.compare_at, e.cost
    from (
      select l.variant_id as vid, l.at, 'price'::text as kind,
             l.new_price_cents as price, l.new_compare_at_cents as compare_at,
             null::integer as cost, l.id as seq
      from internal.price_change_log l
      where l.variant_id = any (p_variant_ids)
      union all
      select r.variant_id, r.at, 'cost'::text, null::integer, null::integer,
             r.cost_net_cents, r.id
      from internal.variant_cost_records r
      where r.variant_id = any (p_variant_ids)
    ) e
    order by e.vid, e.at, e.kind, e.seq;
end;
$$;

revoke execute on function
  public.admin_control_variant_series(date, date, text),
  public.admin_control_variant_events(uuid[])
  from public, anon;
grant execute on function
  public.admin_control_variant_series(date, date, text),
  public.admin_control_variant_events(uuid[])
  to authenticated;
