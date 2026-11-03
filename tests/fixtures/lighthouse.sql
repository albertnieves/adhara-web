-- Solo para la base local efímera de CI (e2e.yml, paso de Lighthouse, después
-- de las pruebas). Nunca en atelier-dev ni en producción: datos ficticios.
--
-- Un perfume publicado con la escena 3D del piloto de Asad y su foto, para
-- medir la ficha con 3D (scripts/lighthouse.ts): la foto se ve primero y
-- three.js no se descarga hasta pulsar «Abrir la caja en 3D».
begin;

insert into public.products (id, brand_id, slug, name, unboxing_scene) values
  ('00000000-0000-4000-8000-0000000003d1', '00000000-0000-4000-8000-00000000ce01',
   'perfume-escena-3d', 'Perfume con escena 3D (prueba)', 'asad');

insert into public.product_sources (product_id, source_ref) values
  ('00000000-0000-4000-8000-0000000003d1', 'tests/fixtures/lighthouse.sql');

insert into public.product_translations (product_id, locale, tagline) values
  ('00000000-0000-4000-8000-0000000003d1', 'es', 'Ficha ficticia para medir el 3D'),
  ('00000000-0000-4000-8000-0000000003d1', 'ca', 'Fitxa fictícia per mesurar el 3D'),
  ('00000000-0000-4000-8000-0000000003d1', 'en', 'Fictitious product to measure the 3D view');

insert into public.product_variants
  (product_id, size_ml, retail_price_cents, active) values
  ('00000000-0000-4000-8000-0000000003d1', 100, 4990, true);

-- La foto del piloto que ya sirve la web (public/media/pilot), provisional.
insert into public.product_media
  (product_id, url, alt, role, origin, source, provisional, position) values
  ('00000000-0000-4000-8000-0000000003d1', '/media/pilot/asad/official_asad-2.jpg',
   'Foto de prueba', 'hero', 'brand_official', 'tests/fixtures/lighthouse.sql',
   true, 0);

update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-0000000003d1';

commit;
