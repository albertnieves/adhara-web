-- Registro de costes por lotes (importación de catálogo): mismas reglas que
-- admin_record_variant_cost, en una sola llamada y con una sola entrada de
-- auditoría que guarda cuántos, no los importes.
-- p_items: [{"variant_id": uuid, "cost_net_cents": int, "note": text?}, …]

create function public.admin_record_variant_costs(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.has_permission('pricing.edit_cost') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 2000 then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where case
      when jsonb_typeof(i -> 'cost_net_cents') = 'number' then
        (i ->> 'cost_net_cents')::numeric < 0
        or (i ->> 'cost_net_cents')::numeric <> trunc((i ->> 'cost_net_cents')::numeric)
        or (i ->> 'cost_net_cents')::numeric > 2147483647
      else true
    end
  ) then
    raise exception 'invalid_amount' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where not exists (
      select 1 from public.product_variants v
      where v.id::text = i ->> 'variant_id'
    )
  ) then
    raise exception 'unknown_variant' using errcode = '22023';
  end if;

  insert into internal.variant_cost_records (variant_id, cost_net_cents, note, actor_id)
  select (i ->> 'variant_id')::uuid,
         (i ->> 'cost_net_cents')::integer,
         nullif(left(btrim(i ->> 'note'), 200), ''),
         (select auth.uid())
  from jsonb_array_elements(p_items) i;
  get diagnostics v_count = row_count;

  insert into public.audit_log (actor_id, action, entity, after)
  values ((select auth.uid()), 'pricing.costs_recorded', 'catalog',
          jsonb_build_object('count', v_count));

  return v_count;
end;
$$;

revoke execute on function public.admin_record_variant_costs(jsonb) from public, anon;
grant execute on function public.admin_record_variant_costs(jsonb) to authenticated;
