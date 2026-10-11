-- Consola del titular (/admin/control), DECISIONS §118.
-- El control deja de ser de cualquier administrador del sistema: además de
-- business.control (con MFA), hay que estar en internal.control_owners, una
-- lista que solo se cambia por SQL. Al aplicar esta migración entra el
-- administrador del sistema activo en ese momento (en adhara-dev, el titular).

create table internal.control_owners (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text check (char_length(note) <= 200),
  added_at timestamptz not null default now()
);

insert into internal.control_owners (user_id, note)
select s.user_id, 'Administrador del sistema activo al crear la lista'
from public.staff_members s
where s.role = 'system_admin' and s.active
on conflict do nothing;

-- Titular con permiso y MFA (has_permission ya exige aal2 para business.control).
create function private.is_control_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_permission('business.control')
     and exists (
       select 1 from internal.control_owners o where o.user_id = (select auth.uid())
     );
$$;

revoke execute on function private.is_control_owner() from public, anon;
grant execute on function private.is_control_owner() to authenticated;

-- Todas las funciones admin_control_* pasan por aquí: ahora también la lista.
create or replace function private.require_business_control()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not private.is_control_owner() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end;
$$;

-- Para el layout y el menú: si la sesión puede entrar, sin lanzar errores.
create function public.control_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_control_owner();
$$;

revoke execute on function public.control_access() from public, anon;
grant execute on function public.control_access() to authenticated;

-- Las métricas recorren movimientos por fecha en todo el catálogo.
create index if not exists inventory_movements_created_idx
  on public.inventory_movements (created_at);
