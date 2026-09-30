-- Índices de claves foráneas señalados por el asesor de rendimiento.
create index role_permissions_permission_idx on public.role_permissions (permission);
create index staff_members_created_by_idx on public.staff_members (created_by);
