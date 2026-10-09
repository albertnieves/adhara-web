-- Perfil olfativo de cada perfume para el catálogo olfativo de la tienda:
-- pirámide (salida, corazón y fondo) o notas clave cuando la fuente no da
-- pirámide, familias, estaciones y momento del día. Las notas son claves del
-- vocabulario de src/modules/catalog/domain/scent.ts, que da sus nombres en
-- es, ca y en. Nunca se inventan: cada perfil guarda la URL de su fuente
-- (CLAUDE.md, «Datos de producto»).

create function private.are_slugs(items text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(item ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), true)
  from unnest(items) as item;
$$;
grant execute on function private.are_slugs(text[]) to authenticated;

create table public.product_scent_profiles (
  product_id uuid primary key references public.products (id) on delete cascade,
  top_notes text[] not null default '{}',
  heart_notes text[] not null default '{}',
  base_notes text[] not null default '{}',
  key_notes text[] not null default '{}',
  families text[] not null default '{}',
  seasons text[] not null default '{}',
  times_of_day text[] not null default '{}',
  source_url text not null check (source_url ~ '^https://[^\s]+$' and char_length(source_url) <= 500),
  source_note text check (char_length(source_note) <= 500),
  updated_at timestamptz not null default now(),
  constraint scent_notes_are_slugs check (
    private.are_slugs(top_notes) and private.are_slugs(heart_notes)
    and private.are_slugs(base_notes) and private.are_slugs(key_notes)
  ),
  constraint scent_notes_limit check (
    cardinality(top_notes) <= 20 and cardinality(heart_notes) <= 20
    and cardinality(base_notes) <= 20 and cardinality(key_notes) <= 20
  ),
  constraint scent_families_known check (families <@ array[
    'citrus', 'fresh', 'aquatic', 'floral', 'fruity', 'gourmand',
    'oriental', 'amber', 'woody', 'aromatic', 'spicy', 'musky'
  ]),
  constraint scent_seasons_known check (
    seasons <@ array['spring', 'summer', 'autumn', 'winter']
  ),
  constraint scent_times_known check (times_of_day <@ array['day', 'night'])
);

create trigger product_scent_profiles_updated_at
  before update on public.product_scent_profiles
  for each row execute function private.set_updated_at();

alter table public.product_scent_profiles enable row level security;

revoke all on public.product_scent_profiles from anon;
grant select on public.product_scent_profiles to anon;
revoke truncate on public.product_scent_profiles from authenticated;

create policy "público lee perfiles de perfumes publicados" on public.product_scent_profiles
  for select to anon
  using (exists (
    select 1 from public.products p
    where p.id = product_scent_profiles.product_id and p.status = 'published'
  ));
create policy "usuarios leen perfiles publicados; personal todos" on public.product_scent_profiles
  for select to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1 from public.products p
      where p.id = product_scent_profiles.product_id and p.status = 'published'
    )
  );
create policy "catalog.edit o research.edit escribe perfiles (alta)" on public.product_scent_profiles
  for insert to authenticated
  with check ((select private.has_permission('catalog.edit'))
              or (select private.has_permission('research.edit')));
create policy "catalog.edit o research.edit escribe perfiles (cambio)" on public.product_scent_profiles
  for update to authenticated
  using ((select private.has_permission('catalog.edit'))
         or (select private.has_permission('research.edit')))
  with check ((select private.has_permission('catalog.edit'))
              or (select private.has_permission('research.edit')));
create policy "catalog.edit o research.edit escribe perfiles (baja)" on public.product_scent_profiles
  for delete to authenticated
  using ((select private.has_permission('catalog.edit'))
         or (select private.has_permission('research.edit')));
