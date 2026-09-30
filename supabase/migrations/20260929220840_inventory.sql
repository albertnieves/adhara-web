-- Inventario operativo (fase A3 de docs/ADMIN_PLAN.md; F9 simplificada).
-- Los niveles solo cambian mediante movimientos de solo inserción, registrados
-- por funciones que repiten las reglas de src/modules/inventory/domain/movements.ts
-- (tests/unit/inventory-sql.test.ts comprueba que coinciden).

create table public.stock_locations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  kind text not null check (kind in ('store', 'warehouse')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory_levels (
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0),
  -- Punto de pedido opcional para las alertas de stock bajo del panel.
  reorder_point integer check (reorder_point >= 0),
  updated_at timestamptz not null default now(),
  primary key (variant_id, location_id),
  constraint reserved_within_on_hand check (reserved <= on_hand)
);

create index inventory_levels_location_idx on public.inventory_levels (location_id);

create table public.inventory_movements (
  id bigint generated always as identity primary key,
  variant_id uuid not null references public.product_variants (id) on delete restrict,
  location_id uuid not null references public.stock_locations (id) on delete restrict,
  type text not null check (type in (
    'PURCHASE_RECEIPT', 'SALE_STORE', 'SALE_ONLINE', 'SALE_CLICK_COLLECT',
    'RESERVATION', 'RESERVATION_RELEASE', 'RETURN', 'RETURN_DAMAGED',
    'STOCKTAKE_ADJUSTMENT', 'MANUAL_ADJUSTMENT', 'DAMAGE_LOSS',
    'TRANSFER_OUT', 'TRANSFER_IN', 'TESTER_ALLOCATION'
  )),
  quantity integer not null check (quantity <> 0),
  delta_on_hand integer not null,
  delta_reserved integer not null,
  on_hand_after integer not null,
  reserved_after integer not null,
  reason text,
  reference text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index inventory_movements_variant_idx
  on public.inventory_movements (variant_id, created_at desc);
create index inventory_movements_location_idx on public.inventory_movements (location_id);
create index inventory_movements_actor_idx on public.inventory_movements (actor_id);

create trigger inventory_movements_append_only
  before update or delete on public.inventory_movements
  for each row execute function private.reject_mutation();

-- Efecto de cada tipo sobre on_hand y reserved (mismo cuadro que EFFECTS en TS).
create function private.movement_effect(p_type text, out on_hand integer, out reserved integer)
language sql
immutable
set search_path = ''
as $$
  select e.on_hand, e.reserved
  from (values
    ('PURCHASE_RECEIPT', 1, 0),
    ('SALE_STORE', -1, 0),
    ('SALE_ONLINE', -1, -1),
    ('SALE_CLICK_COLLECT', -1, -1),
    ('RESERVATION', 0, 1),
    ('RESERVATION_RELEASE', 0, -1),
    ('RETURN', 1, 0),
    ('RETURN_DAMAGED', 0, 0),
    ('STOCKTAKE_ADJUSTMENT', 1, 0),
    ('MANUAL_ADJUSTMENT', 1, 0),
    ('DAMAGE_LOSS', -1, 0),
    ('TRANSFER_OUT', -1, 0),
    ('TRANSFER_IN', 1, 0),
    ('TESTER_ALLOCATION', -1, 0)
  ) as e(type, on_hand, reserved)
  where e.type = p_type;
$$;

-- Permiso necesario para registrar cada tipo desde el panel. Las ventas online,
-- reservas y liberaciones solo las generará el flujo de pedidos (fase A5).
create function private.movement_permission(p_type text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_type
    when 'PURCHASE_RECEIPT' then 'inventory.receive'
    when 'TRANSFER_IN' then 'inventory.receive'
    when 'SALE_STORE' then 'inventory.sell_in_store'
    when 'RETURN' then 'inventory.sell_in_store'
    when 'STOCKTAKE_ADJUSTMENT' then 'inventory.stocktake'
    when 'MANUAL_ADJUSTMENT' then 'inventory.adjust'
    when 'DAMAGE_LOSS' then 'inventory.adjust'
    when 'RETURN_DAMAGED' then 'inventory.adjust'
    when 'TRANSFER_OUT' then 'inventory.adjust'
    when 'TESTER_ALLOCATION' then 'inventory.adjust'
  end;
$$;

create function public.admin_record_inventory_movement(
  p_variant_id uuid,
  p_location_id uuid,
  p_type text,
  p_quantity integer,
  p_reason text default null,
  p_reference text default null
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_permission text := private.movement_permission(p_type);
  v_effect record;
  v_level public.inventory_levels;
  v_delta_on_hand integer;
  v_delta_reserved integer;
  v_movement public.inventory_movements;
begin
  if v_permission is null then
    raise exception 'movement_not_manual' using errcode = '22023';
  end if;
  if not private.has_permission(v_permission) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_quantity is null or p_quantity = 0
     or (p_quantity < 0 and p_type not in ('STOCKTAKE_ADJUSTMENT', 'MANUAL_ADJUSTMENT')) then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  if p_type in ('MANUAL_ADJUSTMENT', 'DAMAGE_LOSS', 'RETURN_DAMAGED')
     and coalesce(btrim(p_reason), '') = '' then
    raise exception 'reason_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.product_variants v where v.id = p_variant_id) then
    raise exception 'unknown_variant' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.stock_locations l where l.id = p_location_id and l.active
  ) then
    raise exception 'unknown_location' using errcode = '22023';
  end if;

  select * into v_effect from private.movement_effect(p_type);
  v_delta_on_hand := v_effect.on_hand * p_quantity;
  v_delta_reserved := v_effect.reserved * p_quantity;

  insert into public.inventory_levels (variant_id, location_id)
  values (p_variant_id, p_location_id)
  on conflict do nothing;

  select * into v_level
  from public.inventory_levels
  where variant_id = p_variant_id and location_id = p_location_id
  for update;

  if v_level.on_hand + v_delta_on_hand < 0 then
    raise exception 'negative_on_hand' using errcode = '23514';
  end if;
  if v_level.reserved + v_delta_reserved < 0 then
    raise exception 'insufficient_reserved' using errcode = '23514';
  end if;
  if v_level.reserved + v_delta_reserved > v_level.on_hand + v_delta_on_hand then
    raise exception 'insufficient_available' using errcode = '23514';
  end if;

  update public.inventory_levels
  set on_hand = on_hand + v_delta_on_hand,
      reserved = reserved + v_delta_reserved,
      updated_at = now()
  where variant_id = p_variant_id and location_id = p_location_id;

  insert into public.inventory_movements (
    variant_id, location_id, type, quantity, delta_on_hand, delta_reserved,
    on_hand_after, reserved_after, reason, reference, actor_id
  ) values (
    p_variant_id, p_location_id, p_type, p_quantity, v_delta_on_hand, v_delta_reserved,
    v_level.on_hand + v_delta_on_hand, v_level.reserved + v_delta_reserved,
    nullif(btrim(p_reason), ''), nullif(btrim(p_reference), ''), (select auth.uid())
  )
  returning * into v_movement;

  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values (
    (select auth.uid()), 'inventory.' || lower(p_type), 'inventory_level',
    p_variant_id::text || '@' || p_location_id::text,
    jsonb_build_object('on_hand', v_level.on_hand, 'reserved', v_level.reserved),
    jsonb_build_object('on_hand', v_movement.on_hand_after,
                       'reserved', v_movement.reserved_after,
                       'movement_id', v_movement.id)
  );
  return v_movement;
end;
$$;

-- Recuento físico: bloquea el nivel y registra la diferencia (null si cuadra).
create function public.admin_record_stocktake(
  p_variant_id uuid,
  p_location_id uuid,
  p_counted integer,
  p_reason text default null
)
returns public.inventory_movements
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_on_hand integer;
begin
  if not private.has_permission('inventory.stocktake') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_counted is null or p_counted < 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  insert into public.inventory_levels (variant_id, location_id)
  values (p_variant_id, p_location_id)
  on conflict do nothing;
  select l.on_hand into v_on_hand
  from public.inventory_levels l
  where l.variant_id = p_variant_id and l.location_id = p_location_id
  for update;
  if p_counted = v_on_hand then
    return null;
  end if;
  return public.admin_record_inventory_movement(
    p_variant_id, p_location_id, 'STOCKTAKE_ADJUSTMENT', p_counted - v_on_hand,
    coalesce(nullif(btrim(p_reason), ''), 'Recuento'), null
  );
end;
$$;

-- Punto de pedido: dato de configuración del nivel, con permiso de ajuste.
create function public.admin_set_reorder_point(
  p_variant_id uuid,
  p_location_id uuid,
  p_reorder_point integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('inventory.adjust') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_reorder_point is not null and p_reorder_point < 0 then
    raise exception 'invalid_quantity' using errcode = '22023';
  end if;
  insert into public.inventory_levels (variant_id, location_id, reorder_point)
  values (p_variant_id, p_location_id, p_reorder_point)
  on conflict (variant_id, location_id)
  do update set reorder_point = excluded.reorder_point, updated_at = now();
end;
$$;

-- Disponibilidad para la tienda: solo un estado, nunca las unidades exactas.
create function public.storefront_availability(p_product_ids uuid[])
returns table (variant_id uuid, status text)
language sql
stable
security definer
set search_path = ''
as $$
  select v.id,
         case
           when coalesce(sum(l.on_hand - l.reserved), 0) <= 0 then 'out_of_stock'
           when sum(l.on_hand - l.reserved) <= 3 then 'low_stock'
           else 'in_stock'
         end
  from public.product_variants v
  join public.products p on p.id = v.product_id and p.status = 'published'
  left join public.inventory_levels l on l.variant_id = v.id
  where v.product_id = any (p_product_ids) and v.active
  group by v.id;
$$;

revoke execute on function
  public.admin_record_inventory_movement(uuid, uuid, text, integer, text, text),
  public.admin_record_stocktake(uuid, uuid, integer, text),
  public.admin_set_reorder_point(uuid, uuid, integer)
  from public, anon;
grant execute on function
  public.admin_record_inventory_movement(uuid, uuid, text, integer, text, text),
  public.admin_record_stocktake(uuid, uuid, integer, text),
  public.admin_set_reorder_point(uuid, uuid, integer)
  to authenticated;
revoke execute on function public.storefront_availability(uuid[]) from public;
grant execute on function public.storefront_availability(uuid[]) to anon, authenticated;

-- RLS: solo el personal con inventory.view lee; nadie escribe directamente.
alter table public.stock_locations enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on public.stock_locations, public.inventory_levels,
  public.inventory_movements from anon;
revoke insert, update, delete, truncate on public.inventory_levels,
  public.inventory_movements from authenticated;
revoke truncate on public.stock_locations from authenticated;

create policy "personal lee ubicaciones" on public.stock_locations
  for select to authenticated using ((select private.is_staff()));
create policy "settings.manage gestiona ubicaciones (alta)" on public.stock_locations
  for insert to authenticated
  with check ((select private.has_permission('settings.manage')));
create policy "settings.manage gestiona ubicaciones (cambio)" on public.stock_locations
  for update to authenticated
  using ((select private.has_permission('settings.manage')))
  with check ((select private.has_permission('settings.manage')));
create policy "settings.manage gestiona ubicaciones (baja)" on public.stock_locations
  for delete to authenticated
  using ((select private.has_permission('settings.manage')));

create policy "inventory.view lee niveles" on public.inventory_levels
  for select to authenticated using ((select private.has_permission('inventory.view')));
create policy "inventory.view lee movimientos" on public.inventory_movements
  for select to authenticated using ((select private.has_permission('inventory.view')));

-- Ubicación inicial: la tienda física (docs/ADMIN_PLAN.md §1).
insert into public.stock_locations (code, name, kind)
values ('castelldefels', 'Tienda de Castelldefels', 'store');
