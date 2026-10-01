-- Informes (docs/PLAN_INFORMES.md; parte de A8 de docs/ADMIN_PLAN.md).
-- Solo funciones de lectura, sin tablas nuevas. Los costes solo salen con
-- pricing.view_cost (que exige MFA); sin él, las columnas de coste llegan
-- vacías y el informe queda en unidades.

-- Categoría de cada tipo de movimiento en los informes (mismo cuadro que
-- REPORT_BUCKETS en TS). Los tipos que no cambian on_hand no cuentan.
create function private.movement_report_bucket(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'PURCHASE_RECEIPT' then 'received'
    when 'TRANSFER_IN' then 'received'
    when 'SALE_STORE' then 'sold'
    when 'SALE_ONLINE' then 'sold'
    when 'SALE_CLICK_COLLECT' then 'sold'
    when 'RETURN' then 'returned'
    when 'DAMAGE_LOSS' then 'lost'
    when 'TESTER_ALLOCATION' then 'lost'
    when 'STOCKTAKE_ADJUSTMENT' then 'adjusted'
    when 'MANUAL_ADJUSTMENT' then 'adjusted'
    when 'TRANSFER_OUT' then 'transferred'
  end;
$$;

-- Coste neto de un formato en una fecha: el último registrado antes. Si no
-- había ninguno, el primero registrado después, marcado como posterior (el
-- informe lo señala; nunca vale 0 por falta de coste).
create function private.variant_cost_for(
  p_variant_id uuid,
  p_at timestamptz,
  out cost_net_cents integer,
  out is_later boolean
)
language sql
stable
set search_path = ''
as $$
  select x.cost_net_cents, x.is_later
  from (
    (select c.cost_net_cents, false as is_later
     from internal.variant_cost_records c
     where c.variant_id = p_variant_id and c.at < p_at
     order by c.at desc, c.id desc
     limit 1)
    union all
    (select c.cost_net_cents, true as is_later
     from internal.variant_cost_records c
     where c.variant_id = p_variant_id and c.at >= p_at
     order by c.at, c.id
     limit 1)
  ) x
  order by x.is_later
  limit 1;
$$;

-- Existencias de un periodo [p_from, p_to) por formato: iniciales, entradas,
-- ventas, devoluciones, mermas y probadores, ajustes, traslados y finales.
-- iniciales + entradas − ventas + devoluciones − mermas + ajustes − traslados
-- = finales, porque todo cambio de on_hand es un movimiento.
create function public.admin_report_inventory_period(
  p_location_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  variant_id uuid,
  opening_units integer,
  received_units integer,
  sold_units integer,
  returned_units integer,
  lost_units integer,
  adjusted_units integer,
  transferred_units integer,
  closing_units integer,
  last_sale_at timestamptz,
  opening_cost_net_cents integer,
  opening_cost_is_later boolean,
  closing_cost_net_cents integer,
  closing_cost_is_later boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_cost boolean := private.has_permission('pricing.view_cost');
begin
  if not private.has_permission('reports.view') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  return query
    with totals as (
      select mv.variant_id as vid,
             coalesce(sum(mv.delta_on_hand) filter (where mv.created_at < p_from), 0) as opening,
             coalesce(sum(mv.delta_on_hand) filter (
               where mv.created_at >= p_from
                 and private.movement_report_bucket(mv.type) = 'received'), 0) as received,
             coalesce(sum(-mv.delta_on_hand) filter (
               where mv.created_at >= p_from
                 and private.movement_report_bucket(mv.type) = 'sold'), 0) as sold,
             coalesce(sum(mv.delta_on_hand) filter (
               where mv.created_at >= p_from
                 and private.movement_report_bucket(mv.type) = 'returned'), 0) as returned,
             coalesce(sum(-mv.delta_on_hand) filter (
               where mv.created_at >= p_from
                 and private.movement_report_bucket(mv.type) = 'lost'), 0) as lost,
             coalesce(sum(mv.delta_on_hand) filter (
               where mv.created_at >= p_from
                 and private.movement_report_bucket(mv.type) = 'adjusted'), 0) as adjusted,
             coalesce(sum(-mv.delta_on_hand) filter (
               where mv.created_at >= p_from
                 and private.movement_report_bucket(mv.type) = 'transferred'), 0) as transferred,
             coalesce(sum(mv.delta_on_hand), 0) as closing,
             max(mv.created_at) filter (
               where private.movement_report_bucket(mv.type) = 'sold') as last_sale
      from public.inventory_movements mv
      where mv.location_id = p_location_id and mv.created_at < p_to
      group by mv.variant_id
    )
    select t.vid,
           t.opening::integer, t.received::integer, t.sold::integer,
           t.returned::integer, t.lost::integer, t.adjusted::integer,
           t.transferred::integer, t.closing::integer, t.last_sale,
           case when v_can_cost then oc.cost_net_cents end,
           case when v_can_cost then oc.is_later end,
           case when v_can_cost then cc.cost_net_cents end,
           case when v_can_cost then cc.is_later end
    from totals t
    left join lateral private.variant_cost_for(t.vid, p_from) oc on true
    left join lateral private.variant_cost_for(t.vid, p_to) cc on true;
end;
$$;

-- Compras por proveedor en un periodo: pedidos enviados, unidades pedidas y
-- recibidas, valor recibido a coste (solo con pricing.view_cost) y plazo real
-- (primera recepción − fecha del pedido) frente al declarado.
create function public.admin_report_purchases(p_from timestamptz, p_to timestamptz)
returns table (
  supplier_id uuid,
  supplier_name text,
  supplier_active boolean,
  declared_lead_time_days integer,
  orders_placed integer,
  units_ordered integer,
  receipts integer,
  units_received integer,
  value_received_net_cents bigint,
  units_received_without_cost integer,
  orders_with_lead integer,
  avg_lead_time_days numeric,
  max_lead_time_days numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_can_cost boolean := private.has_permission('pricing.view_cost');
begin
  if not private.has_permission('purchasing.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from >= p_to then
    raise exception 'invalid_period' using errcode = '22023';
  end if;
  return query
    with placed as (
      select o.supplier_id as sid,
             count(distinct o.id)::integer as orders,
             coalesce(sum(pl.quantity_ordered), 0)::integer as units
      from internal.purchase_orders o
      left join internal.purchase_order_lines pl on pl.order_id = o.id
      where o.ordered_at >= p_from and o.ordered_at < p_to
      group by o.supplier_id
    ),
    received as (
      select o.supplier_id as sid,
             count(distinct r.id)::integer as receipts,
             coalesce(sum(rl.quantity), 0)::integer as units,
             sum(rl.quantity::bigint * pl.unit_cost_net_cents)::bigint as value,
             coalesce(sum(rl.quantity) filter (where pl.unit_cost_net_cents is null), 0)::integer
               as units_without_cost
      from internal.purchase_receipts r
      join internal.purchase_orders o on o.id = r.order_id
      join internal.purchase_receipt_lines rl on rl.receipt_id = r.id
      join internal.purchase_order_lines pl on pl.id = rl.line_id
      where r.at >= p_from and r.at < p_to
      group by o.supplier_id
    ),
    leads as (
      select o.supplier_id as sid,
             extract(epoch from (min(r.at) - o.ordered_at)) / 86400.0 as days
      from internal.purchase_orders o
      join internal.purchase_receipts r on r.order_id = o.id
      where o.ordered_at is not null
      group by o.id, o.supplier_id, o.ordered_at
      having min(r.at) >= p_from and min(r.at) < p_to
    ),
    lead_stats as (
      select l.sid, count(*)::integer as orders,
             round(avg(l.days)::numeric, 1) as avg_days,
             round(max(l.days)::numeric, 1) as max_days
      from leads l
      group by l.sid
    )
    select s.id, s.name, s.active, s.lead_time_days,
           coalesce(p.orders, 0), coalesce(p.units, 0),
           coalesce(rc.receipts, 0), coalesce(rc.units, 0),
           case when v_can_cost then rc.value end,
           case when v_can_cost then coalesce(rc.units_without_cost, 0) end,
           coalesce(ls.orders, 0), ls.avg_days, ls.max_days
    from internal.suppliers s
    left join placed p on p.sid = s.id
    left join received rc on rc.sid = s.id
    left join lead_stats ls on ls.sid = s.id
    where s.active or p.sid is not null or rc.sid is not null
    order by lower(s.name);
end;
$$;

revoke execute on function
  public.admin_report_inventory_period(uuid, timestamptz, timestamptz),
  public.admin_report_purchases(timestamptz, timestamptz)
  from public, anon;
grant execute on function
  public.admin_report_inventory_period(uuid, timestamptz, timestamptz),
  public.admin_report_purchases(timestamptz, timestamptz)
  to authenticated;
