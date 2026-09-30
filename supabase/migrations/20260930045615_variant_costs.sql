-- Coste de compra por formato (neto, sin IVA) en el esquema internal, fuera de
-- la API de datos. Solo se lee y se escribe con funciones que exigen
-- pricing.view_cost o pricing.edit_cost, ambos con MFA (aal2). El coste
-- vigente es el último registro; el historial es de solo inserción.
-- Sin clave foránea, como internal.price_change_log: borrar un borrador no
-- borra su historial de costes.

create table internal.variant_cost_records (
  id bigint generated always as identity primary key,
  variant_id uuid not null,
  cost_net_cents integer not null check (cost_net_cents >= 0),
  note text check (char_length(note) <= 200),
  actor_id uuid,
  at timestamptz not null default now()
);

create index variant_cost_records_variant_idx
  on internal.variant_cost_records (variant_id, at desc, id desc);

create trigger variant_cost_records_append_only
  before update or delete on internal.variant_cost_records
  for each row execute function private.reject_mutation();

-- Coste vigente de cada formato pedido; los formatos sin coste no aparecen.
create function public.admin_variant_costs(p_variant_ids uuid[])
returns table (
  variant_id uuid,
  cost_net_cents integer,
  note text,
  recorded_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('pricing.view_cost') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select distinct on (c.variant_id)
           c.variant_id, c.cost_net_cents, c.note, c.at
    from internal.variant_cost_records c
    where c.variant_id = any (p_variant_ids)
    order by c.variant_id, c.at desc, c.id desc;
end;
$$;

-- Registra un coste nuevo. La auditoría guarda quién y cuándo, no el importe:
-- quien lee la auditoría no tiene por qué ver costes.
create function public.admin_record_variant_cost(
  p_variant_id uuid,
  p_cost_net_cents integer,
  p_note text default null
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_at timestamptz;
begin
  if not private.has_permission('pricing.edit_cost') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_cost_net_cents is null or p_cost_net_cents < 0 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if not exists (select 1 from public.product_variants v where v.id = p_variant_id) then
    raise exception 'unknown_variant' using errcode = '22023';
  end if;

  insert into internal.variant_cost_records (variant_id, cost_net_cents, note, actor_id)
  values (p_variant_id, p_cost_net_cents, nullif(btrim(p_note), ''), (select auth.uid()))
  returning id, at into v_id, v_at;

  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'pricing.cost_recorded', 'product_variant',
          p_variant_id::text, jsonb_build_object('cost_record_id', v_id));

  return v_at;
end;
$$;

revoke execute on function public.admin_variant_costs(uuid[]) from public, anon;
revoke execute on function public.admin_record_variant_cost(uuid, integer, text) from public, anon;
grant execute on function public.admin_variant_costs(uuid[]) to authenticated;
grant execute on function public.admin_record_variant_cost(uuid, integer, text) to authenticated;
