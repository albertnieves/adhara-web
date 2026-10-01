-- Preasignación antes del correo: la cuenta recibe su rol al confirmar Auth.
create function public.admin_prepare_invite(p_email text,p_role text,p_display_name text) returns void
language plpgsql security definer set search_path='' as $$
declare v_email text:=lower(btrim(p_email));
begin
 if not private.has_permission('staff.manage') then raise exception 'forbidden' using errcode='42501'; end if;
 if p_role not in ('system_admin','store_admin','viewer') or v_email not like '%@%' or length(v_email)>254 then raise exception 'invalid_role' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(v_email,17));
 if exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null) then raise exception 'existing_user' using errcode='22023'; end if;
 if exists(select 1 from private.pending_staff_grants where email=v_email and created_at>now()-interval '60 seconds') then raise exception 'rate_limited' using errcode='22023'; end if;
 insert into private.pending_staff_grants(email,role,display_name) values(v_email,p_role,nullif(btrim(p_display_name),''))
 on conflict(email) do update set role=excluded.role,display_name=excluded.display_name,created_at=now();
 insert into public.audit_log(actor_id,action,entity,entity_id,after)
 values(auth.uid(),'staff.invite_requested','staff_invite',v_email,jsonb_build_object('role',p_role));
end $$;
create function public.admin_pending_invites() returns table(email text,role text,display_name text,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not private.has_permission('staff.manage') then raise exception 'forbidden' using errcode='42501'; end if;
 return query select g.email,g.role,g.display_name,g.created_at from private.pending_staff_grants g order by g.created_at desc;
end $$;
create function public.admin_cancel_invite(p_email text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.has_permission('staff.manage') then raise exception 'forbidden' using errcode='42501'; end if;
 delete from private.pending_staff_grants where email=lower(btrim(p_email));
 insert into public.audit_log(actor_id,action,entity,entity_id) values(auth.uid(),'staff.invite_cancelled','staff_invite',lower(btrim(p_email)));
end $$;
revoke all on function public.admin_prepare_invite(text,text,text),public.admin_pending_invites(),public.admin_cancel_invite(text) from public,anon;
grant execute on function public.admin_prepare_invite(text,text,text),public.admin_pending_invites(),public.admin_cancel_invite(text) to authenticated;
