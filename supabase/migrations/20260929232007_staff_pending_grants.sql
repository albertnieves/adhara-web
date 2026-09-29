-- Roles preasignados por email: cuando el titular crea la cuenta en Supabase
-- Auth (Add user) y está confirmada, recibe su rol sin pasos manuales. Así el
-- primer administrador no depende de SQL ni de la clave secreta.
-- La tabla vive en private (fuera de la API); solo se escribe con SQL de
-- administración o desde el panel en el futuro.

create table private.pending_staff_grants (
  email text primary key check (email = lower(btrim(email)) and email like '%@%'),
  role text not null check (role in ('system_admin', 'store_admin', 'viewer')),
  display_name text,
  created_at timestamptz not null default now()
);

alter table private.pending_staff_grants enable row level security;

create function private.apply_pending_staff_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_grant private.pending_staff_grants;
begin
  if new.email_confirmed_at is null or new.email is null then
    return new;
  end if;
  delete from private.pending_staff_grants g
  where g.email = lower(btrim(new.email))
  returning * into v_grant;
  if v_grant.email is null then
    return new;
  end if;
  insert into public.staff_members (user_id, role, display_name)
  values (new.id, v_grant.role, v_grant.display_name)
  on conflict (user_id) do nothing;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values (null, 'staff.pending_grant_applied', 'staff_member', new.id::text,
          jsonb_build_object('role', v_grant.role));
  return new;
end;
$$;

create trigger apply_pending_staff_grant
  after insert or update of email_confirmed_at on auth.users
  for each row execute function private.apply_pending_staff_grant();
