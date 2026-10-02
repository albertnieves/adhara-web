-- Asistente de inventario (docs/ADMIN_PLAN.md A4): informe diario programado
-- (A4.1 con tarea programada) y registro de uso del asistente conversacional
-- (A4.2). El asistente solo lee y propone: no hay ninguna función nueva que
-- escriba stock, precios, catálogo ni pedidos.
--
-- Los informes guardan unidades y estados, nunca costes ni nombres de
-- proveedor, para que también los lea el encargado (agent.use). Solo el
-- servidor los escribe con la clave privilegiada: la tarea programada (tras
-- CRON_SECRET) o una persona con reports.view y MFA desde el panel. No hay
-- políticas de escritura para authenticated: nadie puede falsear un informe
-- llamando a la API.

-- Llamada del servidor con la clave privilegiada (tarea programada).
create function private.is_service_role()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'role'), '') = 'service_role';
$$;
revoke execute on function private.is_service_role() from public, anon;
grant execute on function private.is_service_role() to authenticated, service_role;

create table public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.stock_locations (id),
  -- Día de la tienda (Europe/Madrid) al que se refiere la actividad.
  report_date date not null,
  facts jsonb not null,
  summary text check (summary is null or char_length(summary) <= 8000),
  summary_model text,
  summary_at timestamptz,
  generated_at timestamptz not null default now(),
  -- null: tarea programada.
  generated_by uuid references auth.users (id) on delete set null,
  unique (location_id, report_date)
);
create index daily_reports_generated_by_idx on public.daily_reports (generated_by);

alter table public.daily_reports enable row level security;
revoke all on public.daily_reports from anon;
revoke insert, update, delete, truncate on public.daily_reports from authenticated;

create policy "agent.use lee los informes diarios" on public.daily_reports
  for select to authenticated
  using ((select private.has_permission('agent.use')));

-- Registro de uso del asistente: quién, cuándo, modelo, tokens y herramientas.
-- Sirve para el tope diario por persona y para vigilar el coste. Solo inserción.
create table public.assistant_usage (
  id bigint generated always as identity primary key,
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  kind text not null check (kind in ('chat', 'daily_summary')),
  model text not null check (char_length(model) <= 100),
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  cache_read_tokens integer not null default 0 check (cache_read_tokens >= 0),
  tools text[] not null default '{}' check (cardinality(tools) <= 50),
  stop_reason text check (char_length(stop_reason) <= 40),
  created_at timestamptz not null default now()
);
create index assistant_usage_user_created_idx
  on public.assistant_usage (user_id, created_at);

create trigger assistant_usage_append_only
  before update or delete on public.assistant_usage
  for each row execute function private.reject_mutation();

alter table public.assistant_usage enable row level security;
revoke all on public.assistant_usage from anon;
revoke update, delete, truncate on public.assistant_usage from authenticated;

create policy "cada persona registra su uso del asistente" on public.assistant_usage
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and kind = 'chat'
    and (select private.has_permission('agent.use'))
    -- Toda escritura del personal exige MFA, como en el resto del panel.
    and (select private.current_aal()) = 'aal2'
  );

create policy "cada persona ve su uso; staff.manage todo" on public.assistant_usage
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_permission('staff.manage'))
  );

-- Pedidos de compra abiertos sin proveedor ni costes: número, estado, fecha
-- prevista y unidades pendientes. Lo usan el informe diario y el asistente.
create function public.admin_open_purchase_orders(p_location_id uuid)
returns table (
  number text,
  status text,
  expected_on date,
  ordered_at timestamptz,
  units_ordered integer,
  units_received integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission('inventory.view') or private.is_service_role()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select o.number, o.status, o.expected_on, o.ordered_at,
           coalesce(sum(pl.quantity_ordered), 0)::integer,
           coalesce(sum(pl.quantity_received), 0)::integer
    from internal.purchase_orders o
    left join internal.purchase_order_lines pl on pl.order_id = o.id
    where o.location_id = p_location_id
      and o.status in ('ordered', 'partially_received')
    group by o.id
    order by o.expected_on nulls last, o.number;
end;
$$;
revoke execute on function public.admin_open_purchase_orders(uuid) from public, anon;
grant execute on function public.admin_open_purchase_orders(uuid) to authenticated, service_role;

-- El vigilante también se calcula en la tarea programada (sin sesión de
-- personal). Igual que en la fase R salvo la comprobación de acceso.
create or replace function public.admin_stock_watch_facts(p_location_id uuid)
returns table (
  variant_id uuid,
  units_sold integer,
  last_sale_at timestamptz,
  first_stocked_at timestamptz,
  ledger_on_hand integer,
  ledger_reserved integer,
  lead_time_days integer,
  pack_size integer,
  incoming_units integer,
  has_supplier boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_window integer;
begin
  if not (private.has_permission('inventory.view') or private.is_service_role()) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select s.sales_window_days into v_window from public.stock_watch_settings s where s.id;
  return query
    with moves as (
      select m.variant_id,
             coalesce(sum(-m.delta_on_hand) filter (
               where m.type in ('SALE_STORE', 'SALE_ONLINE', 'SALE_CLICK_COLLECT')
                 and m.created_at >= now() - make_interval(days => coalesce(v_window, 30))
             ), 0)::integer as units_sold,
             max(m.created_at) filter (
               where m.type in ('SALE_STORE', 'SALE_ONLINE', 'SALE_CLICK_COLLECT')
             ) as last_sale_at,
             min(m.created_at) filter (where m.delta_on_hand > 0) as first_stocked_at,
             sum(m.delta_on_hand)::integer as ledger_on_hand,
             sum(m.delta_reserved)::integer as ledger_reserved
      from public.inventory_movements m
      where m.location_id = p_location_id
      group by m.variant_id
    ),
    -- Proveedor de reposición: el preferente activo o el único activo. Con
    -- varios y ninguno preferente no se elige: lo decide una persona.
    terms as (
      select distinct on (sv.variant_id)
             sv.variant_id,
             coalesce(sv.lead_time_days, s.lead_time_days) as lead_time_days,
             sv.pack_size
      from internal.supplier_variants sv
      join internal.suppliers s on s.id = sv.supplier_id and s.active
      where sv.preferred
         or not exists (
           select 1
           from internal.supplier_variants other
           join internal.suppliers os on os.id = other.supplier_id and os.active
           where other.variant_id = sv.variant_id and other.supplier_id <> sv.supplier_id
         )
      order by sv.variant_id, sv.preferred desc
    ),
    incoming as (
      select pl.variant_id,
             sum(pl.quantity_ordered - pl.quantity_received)::integer as units
      from internal.purchase_order_lines pl
      join internal.purchase_orders o on o.id = pl.order_id
      where o.location_id = p_location_id
        and o.status in ('ordered', 'partially_received')
      group by pl.variant_id
    ),
    ids as (
      select l.variant_id from public.inventory_levels l where l.location_id = p_location_id
      union select moves.variant_id from moves
      union select terms.variant_id from terms
      union select incoming.variant_id from incoming
    )
    select ids.variant_id,
           coalesce(moves.units_sold, 0),
           moves.last_sale_at,
           moves.first_stocked_at,
           coalesce(moves.ledger_on_hand, 0),
           coalesce(moves.ledger_reserved, 0),
           terms.lead_time_days,
           terms.pack_size,
           coalesce(incoming.units, 0),
           terms.variant_id is not null
    from ids
    left join moves on moves.variant_id = ids.variant_id
    left join terms on terms.variant_id = ids.variant_id
    left join incoming on incoming.variant_id = ids.variant_id;
end;
$$;

revoke execute on function public.admin_stock_watch_facts(uuid) from public, anon;
grant execute on function public.admin_stock_watch_facts(uuid) to authenticated, service_role;
