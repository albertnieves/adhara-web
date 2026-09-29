-- Personal, permisos y auditoría (docs/ADMIN_PLAN.md §3, fase A1).
-- La matriz rol → permiso se genera desde src/modules/auth/domain/permissions.ts;
-- tests/unit/permissions-sql.test.ts comprueba que ambas coinciden.

create table public.permissions (
  code text primary key,
  requires_aal2 boolean not null
);

create table public.role_permissions (
  role text not null check (role in ('system_admin', 'store_admin', 'viewer')),
  permission text not null references public.permissions (code),
  primary key (role, permission)
);

create table public.staff_members (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('system_admin', 'store_admin', 'viewer')),
  display_name text,
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger staff_members_updated_at
  before update on public.staff_members
  for each row execute function private.set_updated_at();

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  at timestamptz not null default now()
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_actor_idx on public.audit_log (actor_id);

create trigger audit_log_append_only
  before update or delete on public.audit_log
  for each row execute function private.reject_mutation();

-- Nivel de autenticación de la sesión actual (aal2 = MFA verificada).
create function private.current_aal()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1');
$$;

create function private.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    where s.user_id = (select auth.uid()) and s.active
  );
$$;

create function private.has_permission(requested text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_members s
    join public.role_permissions rp on rp.role = s.role
    join public.permissions p on p.code = rp.permission
    where s.user_id = (select auth.uid())
      and s.active
      and rp.permission = requested
      and (not p.requires_aal2 or private.current_aal() = 'aal2')
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.current_aal() to authenticated;
grant execute on function private.is_staff() to authenticated;
grant execute on function private.has_permission(text) to authenticated;

-- RLS: denegar por defecto; anon no tiene ningún acceso.
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.staff_members enable row level security;
alter table public.audit_log enable row level security;

revoke all on public.permissions, public.role_permissions,
  public.staff_members, public.audit_log from anon;
revoke insert, update, delete, truncate on public.permissions,
  public.role_permissions, public.audit_log from authenticated;
revoke truncate on public.staff_members from authenticated;

create policy "personal lee el catálogo de permisos" on public.permissions
  for select to authenticated using ((select private.is_staff()));

create policy "personal lee la matriz de roles" on public.role_permissions
  for select to authenticated using ((select private.is_staff()));

create policy "cada miembro lee su ficha; staff.manage lee todas" on public.staff_members
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.has_permission('staff.manage'))
  );

create policy "staff.manage da de alta personal" on public.staff_members
  for insert to authenticated
  with check ((select private.has_permission('staff.manage')));

create policy "staff.manage modifica personal" on public.staff_members
  for update to authenticated
  using ((select private.has_permission('staff.manage')))
  with check ((select private.has_permission('staff.manage')));

create policy "staff.manage da de baja personal" on public.staff_members
  for delete to authenticated
  using ((select private.has_permission('staff.manage')));

create policy "staff.manage consulta la auditoría" on public.audit_log
  for select to authenticated
  using ((select private.has_permission('staff.manage')));

-- Única vía de escritura en la auditoría: el actor es siempre la sesión.
create function public.record_audit_event(
  action text,
  entity text,
  entity_id text default null,
  before jsonb default null,
  after jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_staff() then
    raise exception 'solo el personal registra auditoría'
      using errcode = 'insufficient_privilege';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, before, after)
  values ((select auth.uid()), action, entity, entity_id, before, after);
end;
$$;

revoke execute on function public.record_audit_event(text, text, text, jsonb, jsonb)
  from public, anon;
grant execute on function public.record_audit_event(text, text, text, jsonb, jsonb)
  to authenticated;

-- Datos de referencia: matriz generada desde el código.
insert into public.permissions (code, requires_aal2) values
  ('catalog.edit', false),
  ('catalog.publish', false),
  ('research.edit', false),
  ('media.edit', false),
  ('content.edit', false),
  ('pricing.edit_retail', true),
  ('pricing.view_cost', true),
  ('pricing.edit_cost', true),
  ('inventory.view', false),
  ('inventory.receive', false),
  ('inventory.stocktake', false),
  ('inventory.sell_in_store', false),
  ('inventory.adjust', false),
  ('purchasing.manage', true),
  ('orders.view', false),
  ('orders.fulfill', false),
  ('orders.refund', true),
  ('messages.view', false),
  ('messages.reply', false),
  ('customers.view', false),
  ('customers.manage', true),
  ('promotions.manage', false),
  ('agent.use', false),
  ('reports.view', false),
  ('settings.manage', true),
  ('staff.manage', true);

insert into public.role_permissions (role, permission) values
  ('system_admin', 'catalog.edit'),
  ('system_admin', 'catalog.publish'),
  ('system_admin', 'research.edit'),
  ('system_admin', 'media.edit'),
  ('system_admin', 'content.edit'),
  ('system_admin', 'pricing.edit_retail'),
  ('system_admin', 'pricing.view_cost'),
  ('system_admin', 'pricing.edit_cost'),
  ('system_admin', 'inventory.view'),
  ('system_admin', 'inventory.receive'),
  ('system_admin', 'inventory.stocktake'),
  ('system_admin', 'inventory.sell_in_store'),
  ('system_admin', 'inventory.adjust'),
  ('system_admin', 'purchasing.manage'),
  ('system_admin', 'orders.view'),
  ('system_admin', 'orders.fulfill'),
  ('system_admin', 'orders.refund'),
  ('system_admin', 'messages.view'),
  ('system_admin', 'messages.reply'),
  ('system_admin', 'customers.view'),
  ('system_admin', 'customers.manage'),
  ('system_admin', 'promotions.manage'),
  ('system_admin', 'agent.use'),
  ('system_admin', 'reports.view'),
  ('system_admin', 'settings.manage'),
  ('system_admin', 'staff.manage'),
  ('store_admin', 'catalog.edit'),
  ('store_admin', 'catalog.publish'),
  ('store_admin', 'research.edit'),
  ('store_admin', 'media.edit'),
  ('store_admin', 'content.edit'),
  ('store_admin', 'pricing.edit_retail'),
  ('store_admin', 'pricing.view_cost'),
  ('store_admin', 'pricing.edit_cost'),
  ('store_admin', 'inventory.view'),
  ('store_admin', 'inventory.receive'),
  ('store_admin', 'inventory.stocktake'),
  ('store_admin', 'inventory.sell_in_store'),
  ('store_admin', 'inventory.adjust'),
  ('store_admin', 'purchasing.manage'),
  ('store_admin', 'orders.view'),
  ('store_admin', 'orders.fulfill'),
  ('store_admin', 'orders.refund'),
  ('store_admin', 'messages.view'),
  ('store_admin', 'messages.reply'),
  ('store_admin', 'customers.view'),
  ('store_admin', 'customers.manage'),
  ('store_admin', 'promotions.manage'),
  ('store_admin', 'agent.use'),
  ('store_admin', 'reports.view'),
  ('viewer', 'inventory.view'),
  ('viewer', 'orders.view'),
  ('viewer', 'messages.view'),
  ('viewer', 'agent.use');
