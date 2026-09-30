-- Catálogo: marcas, perfumes, formatos con PVP, textos por idioma e imágenes
-- (fase A2 de docs/ADMIN_PLAN.md; F1 0004–0007 y 0009 simplificadas).
-- El coste no vive aquí: irá en internal cuando se registren costes.

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger brands_updated_at
  before update on public.brands
  for each row execute function private.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands (id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) > 0),
  concentration text check (
    concentration in ('EDC', 'EDT', 'EDP', 'PARFUM', 'EXTRAIT', 'OIL', 'OTHER')
  ),
  audience text check (audience in ('women', 'men', 'unisex')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  featured boolean not null default false,
  position integer not null default 0,
  -- Escena de unboxing definida en código (src/modules/unboxing); null = sin escena.
  unboxing_scene text check (unboxing_scene ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- Procedencia de los datos: página del catálogo PDF, carpeta del piloto…
  source_ref text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_brand_idx on public.products (brand_id);
create index products_status_idx on public.products (status, position);

create trigger products_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create table public.product_translations (
  product_id uuid not null references public.products (id) on delete cascade,
  locale text not null check (locale in ('es', 'ca', 'en')),
  tagline text,
  description text,
  updated_at timestamptz not null default now(),
  primary key (product_id, locale)
);

create trigger product_translations_updated_at
  before update on public.product_translations
  for each row execute function private.set_updated_at();

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  sku text unique,
  ean text,
  size_ml integer check (size_ml > 0),
  label text,
  -- PVP con IVA en céntimos; null = precio pendiente (no se puede vender).
  retail_price_cents integer check (retail_price_cents >= 0),
  -- Precio anterior tachado: solo en rebajas y validado con Ómnibus en servidor.
  compare_at_price_cents integer,
  active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compare_at_above_retail check (
    compare_at_price_cents is null
    or (retail_price_cents is not null and compare_at_price_cents > retail_price_cents)
  )
);

create index product_variants_product_idx on public.product_variants (product_id, position);

create trigger product_variants_updated_at
  before update on public.product_variants
  for each row execute function private.set_updated_at();

create table public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  -- Ruta del repo (/media/…) o URL pública del bucket product-media.
  url text not null check (url ~ '^(/|https://)'),
  alt text,
  role text not null default 'gallery' check (role in ('hero', 'gallery', 'box')),
  -- Procedencia (AGENTS.md): foto propia, catálogo PDF, imagen oficial de marca o borrador generado.
  origin text not null
    check (origin in ('own_photo', 'catalog_pdf', 'brand_official', 'generated_draft')),
  source text,
  -- Provisional hasta sustituirla por foto propia antes de abrir al público.
  provisional boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index product_media_product_idx on public.product_media (product_id, position);

-- Historial de PVP (solo inserción): base de la referencia Ómnibus de 30 días.
create table internal.price_change_log (
  id bigint generated always as identity primary key,
  variant_id uuid not null,
  old_price_cents integer,
  new_price_cents integer,
  old_compare_at_cents integer,
  new_compare_at_cents integer,
  actor_id uuid,
  at timestamptz not null default now()
);

create index price_change_log_variant_idx on internal.price_change_log (variant_id, at);

create trigger price_change_log_append_only
  before update or delete on internal.price_change_log
  for each row execute function private.reject_mutation();

-- Publicar exige permiso y al menos un formato activo con PVP.
create function private.enforce_product_publication()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published') then
    if current_user in ('anon', 'authenticated')
       and not private.has_permission('catalog.publish') then
      raise exception 'forbidden_publish' using errcode = '42501';
    end if;
    if not exists (
      select 1
      from public.product_variants v
      where v.product_id = new.id and v.active and v.retail_price_cents is not null
    ) then
      raise exception 'publish_requires_priced_variant' using errcode = '23514';
    end if;
    new.published_at := coalesce(new.published_at, now());
  end if;
  if new.status <> 'published' and tg_op = 'UPDATE' and old.status = 'published'
     and current_user in ('anon', 'authenticated')
     and not private.has_permission('catalog.publish') then
    raise exception 'forbidden_publish' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger products_publication
  before insert or update of status on public.products
  for each row execute function private.enforce_product_publication();

-- Cambiar PVP o precio anterior exige pricing.edit_retail (que a su vez exige aal2).
create function private.guard_variant_price()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and new.retail_price_cents is not distinct from old.retail_price_cents
     and new.compare_at_price_cents is not distinct from old.compare_at_price_cents then
    return new;
  end if;
  if tg_op = 'INSERT'
     and new.retail_price_cents is null and new.compare_at_price_cents is null then
    return new;
  end if;
  if current_user in ('anon', 'authenticated')
     and not private.has_permission('pricing.edit_retail') then
    raise exception 'forbidden_price_change' using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger product_variants_price_guard
  before insert or update on public.product_variants
  for each row execute function private.guard_variant_price();

create function private.log_variant_price()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.retail_price_cents is null and new.compare_at_price_cents is null then
      return null;
    end if;
  elsif new.retail_price_cents is not distinct from old.retail_price_cents
        and new.compare_at_price_cents is not distinct from old.compare_at_price_cents then
    return null;
  end if;
  insert into internal.price_change_log (
    variant_id, old_price_cents, new_price_cents,
    old_compare_at_cents, new_compare_at_cents, actor_id
  ) values (
    new.id,
    case when tg_op = 'UPDATE' then old.retail_price_cents end,
    new.retail_price_cents,
    case when tg_op = 'UPDATE' then old.compare_at_price_cents end,
    new.compare_at_price_cents,
    (select auth.uid())
  );
  return null;
end;
$$;

create trigger product_variants_price_log
  after insert or update on public.product_variants
  for each row execute function private.log_variant_price();

-- Historial de PVP para la referencia Ómnibus (lectura con permiso de catálogo).
create function public.admin_variant_price_history(p_variant_id uuid)
returns table (price_cents integer, valid_from timestamptz, valid_to timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (private.has_permission('catalog.edit')
          or private.has_permission('pricing.edit_retail')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select l.new_price_cents,
           l.at,
           lead(l.at) over (order by l.at, l.id)
    from internal.price_change_log l
    where l.variant_id = p_variant_id
    order by l.at, l.id;
end;
$$;

revoke execute on function public.admin_variant_price_history(uuid) from public, anon;
grant execute on function public.admin_variant_price_history(uuid) to authenticated;

-- RLS: el público solo ve lo publicado; el personal ve todo y escribe según permiso.
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_translations enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_media enable row level security;

revoke all on public.brands, public.products, public.product_translations,
  public.product_variants, public.product_media from anon;
grant select on public.brands, public.products, public.product_translations,
  public.product_variants, public.product_media to anon;
revoke truncate on public.brands, public.products, public.product_translations,
  public.product_variants, public.product_media from authenticated;

create policy "público lee marcas con perfumes publicados" on public.brands
  for select to anon
  using (exists (
    select 1 from public.products p where p.brand_id = brands.id and p.status = 'published'
  ));
create policy "usuarios leen marcas publicadas; personal todas" on public.brands
  for select to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1 from public.products p where p.brand_id = brands.id and p.status = 'published'
    )
  );
create policy "catalog.edit crea marcas" on public.brands
  for insert to authenticated with check ((select private.has_permission('catalog.edit')));
create policy "catalog.edit modifica marcas" on public.brands
  for update to authenticated
  using ((select private.has_permission('catalog.edit')))
  with check ((select private.has_permission('catalog.edit')));
create policy "catalog.edit borra marcas" on public.brands
  for delete to authenticated using ((select private.has_permission('catalog.edit')));

create policy "público lee perfumes publicados" on public.products
  for select to anon using (status = 'published');
create policy "usuarios leen publicados; personal todos" on public.products
  for select to authenticated
  using (status = 'published' or (select private.is_staff()));
create policy "catalog.edit crea perfumes" on public.products
  for insert to authenticated with check ((select private.has_permission('catalog.edit')));
create policy "catalog.edit modifica perfumes" on public.products
  for update to authenticated
  using ((select private.has_permission('catalog.edit')))
  with check ((select private.has_permission('catalog.edit')));
create policy "catalog.edit borra borradores" on public.products
  for delete to authenticated
  using (status = 'draft' and (select private.has_permission('catalog.edit')));

create policy "público lee textos de perfumes publicados" on public.product_translations
  for select to anon
  using (exists (
    select 1 from public.products p where p.id = product_translations.product_id and p.status = 'published'
  ));
create policy "usuarios leen textos publicados; personal todos" on public.product_translations
  for select to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1 from public.products p where p.id = product_translations.product_id and p.status = 'published'
    )
  );
create policy "catalog.edit o content.edit escribe textos (alta)" on public.product_translations
  for insert to authenticated
  with check ((select private.has_permission('catalog.edit'))
              or (select private.has_permission('content.edit')));
create policy "catalog.edit o content.edit escribe textos (cambio)" on public.product_translations
  for update to authenticated
  using ((select private.has_permission('catalog.edit'))
         or (select private.has_permission('content.edit')))
  with check ((select private.has_permission('catalog.edit'))
              or (select private.has_permission('content.edit')));
create policy "catalog.edit o content.edit escribe textos (baja)" on public.product_translations
  for delete to authenticated
  using ((select private.has_permission('catalog.edit'))
         or (select private.has_permission('content.edit')));

create policy "público lee formatos activos de perfumes publicados" on public.product_variants
  for select to anon
  using (active and exists (
    select 1 from public.products p where p.id = product_variants.product_id and p.status = 'published'
  ));
create policy "usuarios leen formatos publicados; personal todos" on public.product_variants
  for select to authenticated
  using (
    (select private.is_staff())
    or (active and exists (
      select 1 from public.products p where p.id = product_variants.product_id and p.status = 'published'
    ))
  );
create policy "catalog.edit crea formatos" on public.product_variants
  for insert to authenticated with check ((select private.has_permission('catalog.edit')));
create policy "catalog.edit o pricing modifica formatos" on public.product_variants
  for update to authenticated
  using ((select private.has_permission('catalog.edit'))
         or (select private.has_permission('pricing.edit_retail')))
  with check ((select private.has_permission('catalog.edit'))
              or (select private.has_permission('pricing.edit_retail')));
create policy "catalog.edit borra formatos" on public.product_variants
  for delete to authenticated using ((select private.has_permission('catalog.edit')));

create policy "público lee imágenes de perfumes publicados" on public.product_media
  for select to anon
  using (exists (
    select 1 from public.products p where p.id = product_media.product_id and p.status = 'published'
  ));
create policy "usuarios leen imágenes publicadas; personal todas" on public.product_media
  for select to authenticated
  using (
    (select private.is_staff())
    or exists (
      select 1 from public.products p where p.id = product_media.product_id and p.status = 'published'
    )
  );
create policy "media.edit gestiona imágenes (alta)" on public.product_media
  for insert to authenticated
  with check ((select private.has_permission('media.edit')));
create policy "media.edit gestiona imágenes (cambio)" on public.product_media
  for update to authenticated
  using ((select private.has_permission('media.edit')))
  with check ((select private.has_permission('media.edit')));
create policy "media.edit gestiona imágenes (baja)" on public.product_media
  for delete to authenticated
  using ((select private.has_permission('media.edit')));

-- Imágenes subidas desde el panel: lectura pública, escritura con media.edit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media', 'product-media', true, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do nothing;

create policy "media.edit lista imágenes de producto" on storage.objects
  for select to authenticated
  using (bucket_id = 'product-media' and (select private.has_permission('media.edit')));
create policy "media.edit sube imágenes de producto" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-media' and (select private.has_permission('media.edit')));
create policy "media.edit reemplaza imágenes de producto" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-media' and (select private.has_permission('media.edit')))
  with check (bucket_id = 'product-media' and (select private.has_permission('media.edit')));
create policy "media.edit borra imágenes de producto" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-media' and (select private.has_permission('media.edit')));
