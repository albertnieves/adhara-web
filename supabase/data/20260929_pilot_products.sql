-- Carga de datos (no migración): los 4 perfumes del piloto como BORRADORES.
-- Solo datos con fuente: nombre y marca (pilot/), concentración y formato cuando
-- constan en la caja o la ficha oficial (pilot/assets-refs/PROVENANCE.md).
-- Sin PVP: lo fija un administrador con el catálogo (no se puede publicar sin él).
-- Idempotente: se puede volver a ejecutar sin duplicar filas.

insert into public.brands (slug, name) values
  ('lattafa', 'Lattafa'),
  ('armaf', 'Armaf')
on conflict (slug) do nothing;

insert into public.products
  (brand_id, slug, name, concentration, audience, position, unboxing_scene, source_ref)
values
  ((select id from public.brands where slug = 'lattafa'), 'asad', 'Asad', 'EDP', null, 10, 'asad',
   'pilot/ (nombre y marca); caja oficial: «Eau de Parfum 100ml» (official_asad-2.jpg)'),
  ((select id from public.brands where slug = 'lattafa'), 'yara', 'Yara', 'EDP', null, 20, 'yara',
   'pilot/ (nombre y marca); caja oficial: «Eau de Perfume Natural Spray 100ml» (official_yara-2.jpg)'),
  ((select id from public.brands where slug = 'armaf'), 'club-de-nuit-intense-man-le',
   'Club de Nuit Intense Man Limited Edition', 'PARFUM', 'men', 30, 'club-de-nuit-intense-man-le',
   'pilot/ (nombre y marca); estuche oficial: «Parfum · Limited Edition»; ficha armaf.uk: pure parfum 105ml'),
  ((select id from public.brands where slug = 'lattafa'), 'khamrah', 'Khamrah', null, null, 40, 'khamrah',
   'pilot/ (nombre y marca); concentración y formato pendientes del catálogo')
on conflict (slug) do nothing;

insert into public.product_variants (product_id, size_ml, position)
select p.id, v.size_ml, 0
from (values ('asad', 100), ('yara', 100), ('club-de-nuit-intense-man-le', 105)) as v(slug, size_ml)
join public.products p on p.slug = v.slug
where not exists (select 1 from public.product_variants pv where pv.product_id = p.id);

insert into public.product_media (product_id, url, alt, role, origin, source, provisional, position)
select p.id, m.url, m.alt, m.role, 'brand_official', m.source, true, m.position
from (values
  ('asad', '/media/pilot/asad/official_asad-2.jpg', 'Lattafa Asad, frasco y caja', 'hero', 0,
   'https://www.lattafa-usa.com/products/asad'),
  ('yara', '/media/pilot/yara/official_yara-2.jpg', 'Lattafa Yara, frasco y caja', 'hero', 0,
   'https://www.lattafa-usa.com/products/yara'),
  ('yara', '/media/pilot/yara/official_yara-3.jpg', 'Lattafa Yara, caja', 'box', 1,
   'https://www.lattafa-usa.com/products/yara'),
  ('khamrah', '/media/pilot/khamrah/official_khamrah-2.jpg', 'Lattafa Khamrah, frasco y caja', 'hero', 0,
   'https://www.lattafa-usa.com/products/khamrah'),
  ('khamrah', '/media/pilot/khamrah/official_khamrah-3.jpg', 'Lattafa Khamrah, caja', 'box', 1,
   'https://www.lattafa-usa.com/products/khamrah'),
  ('club-de-nuit-intense-man-le', '/media/pilot/club-de-nuit-intense-man-le/official_cdn-uk-2.jpg',
   'Armaf Club de Nuit Intense Man Limited Edition en su estuche', 'hero', 0,
   'https://armaf.uk/products/club-de-nuit-intense-man-limited-edition-pure-parfum-with-cuff-links-105ml'),
  ('club-de-nuit-intense-man-le', '/media/pilot/club-de-nuit-intense-man-le/official_cdn-armaf-1.jpg',
   'Armaf Club de Nuit Intense Man Limited Edition, estuche', 'box', 1,
   'https://armaf.com/products/club-de-nuit-intense-man-limited-edition')
) as m(slug, url, alt, role, position, source)
join public.products p on p.slug = m.slug
where not exists (select 1 from public.product_media pm where pm.product_id = p.id and pm.url = m.url);
