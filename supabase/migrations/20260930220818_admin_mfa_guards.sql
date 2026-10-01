-- Toda escritura de personal requiere MFA también por API directa.
update public.permissions set requires_aal2 = true
where code not in ('inventory.view','orders.view','messages.view','agent.use','reports.view','customers.view');

-- La lectura interna completa exige MFA; la ficha propia sigue permitiendo el alta TOTP.
create or replace function private.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
select private.current_aal() = 'aal2' and exists (
 select 1 from public.staff_members where user_id = (select auth.uid()) and active
)
$$;

-- No permitir que una llamada directa elimine/desactive al último administrador.
create function private.guard_last_admin() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if old.role = 'system_admin' and old.active and
    (tg_op = 'DELETE' or new.role <> 'system_admin' or not new.active) then
   perform pg_advisory_xact_lock(18042026);
   if not exists(select 1 from public.staff_members where role='system_admin' and active and user_id <> old.user_id) then
     raise exception 'last_admin' using errcode='23514';
   end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger protect_last_admin before update or delete on public.staff_members
for each row execute function private.guard_last_admin();

-- Lectura operativa sin costes: la ubicación acompaña a inventory.view en aal1.
-- Evita informes vacíos al resolver su ubicación antes de completar MFA.
alter policy "personal lee ubicaciones" on public.stock_locations
 using ((select private.has_permission('inventory.view')));
