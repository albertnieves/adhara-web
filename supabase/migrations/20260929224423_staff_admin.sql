-- Gestión del personal desde el panel (staff.manage): listar con email, dar rol
-- a un usuario ya registrado en Auth y activar o desactivar. auth.users no es
-- accesible desde la API; estas funciones lo leen con permiso comprobado.

create function public.admin_list_staff()
returns table (
  user_id uuid,
  email text,
  role text,
  display_name text,
  active boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('staff.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select s.user_id, u.email::text, s.role, s.display_name, s.active,
           s.created_at, u.last_sign_in_at
    from public.staff_members s
    join auth.users u on u.id = s.user_id
    order by s.created_at;
end;
$$;

create function public.admin_grant_staff(
  p_email text,
  p_role text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
  v_before jsonb;
begin
  if not private.has_permission('staff.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('system_admin', 'store_admin', 'viewer') then
    raise exception 'invalid_role' using errcode = '22023';
  end if;
  select u.id into v_user
  from auth.users u
  where lower(u.email) = lower(btrim(p_email));
  if v_user is null then
    raise exception 'unknown_user' using errcode = '22023';
  end if;
  if v_user = (select auth.uid()) then
    raise exception 'cannot_change_self' using errcode = '22023';
  end if;
  select to_jsonb(s) into v_before from public.staff_members s where s.user_id = v_user;
  insert into public.staff_members (user_id, role, display_name, created_by)
  values (v_user, p_role, nullif(btrim(p_display_name), ''), (select auth.uid()))
  on conflict (user_id) do update
    set role = excluded.role,
        display_name = coalesce(excluded.display_name, public.staff_members.display_name),
        active = true;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), 'staff.grant', 'staff_member', v_user::text, v_before,
          jsonb_build_object('role', p_role, 'active', true));
  return v_user;
end;
$$;

create function public.admin_set_staff_active(p_user_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.has_permission('staff.manage') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id = (select auth.uid()) then
    raise exception 'cannot_change_self' using errcode = '22023';
  end if;
  update public.staff_members set active = p_active where user_id = p_user_id;
  if not found then
    raise exception 'unknown_user' using errcode = '22023';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, after)
  values ((select auth.uid()), 'staff.set_active', 'staff_member', p_user_id::text,
          jsonb_build_object('active', p_active));
end;
$$;

revoke execute on function
  public.admin_list_staff(),
  public.admin_grant_staff(text, text, text),
  public.admin_set_staff_active(uuid, boolean)
  from public, anon;
grant execute on function
  public.admin_list_staff(),
  public.admin_grant_staff(text, text, text),
  public.admin_set_staff_active(uuid, boolean)
  to authenticated;
