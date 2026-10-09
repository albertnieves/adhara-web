-- Solo para la base local efímera de CI (e2e.yml). Nunca en adhara-dev ni en
-- producción: los datos son ficticios.
--
-- Un perfume publicado con un coste centinela de 987654 céntimos y un
-- proveedor y una referencia de proveedor que contienen el mismo número.
-- tests/e2e/cost-leak.spec.ts comprueba que el centinela no aparece en
-- ninguna respuesta pública (HTML, carga RSC, JSON ni cabeceras).
begin;

insert into public.brands (id, slug, name) values
  ('00000000-0000-4000-8000-00000000ce01', 'marca-centinela',
   'Marca centinela (prueba)');

insert into public.products (id, brand_id, slug, name, source_ref) values
  ('00000000-0000-4000-8000-00000000ce02', '00000000-0000-4000-8000-00000000ce01',
   'perfume-centinela', 'Perfume centinela (prueba)',
   'tests/fixtures/test-db.sql');

insert into public.product_translations (product_id, locale, tagline) values
  ('00000000-0000-4000-8000-00000000ce02', 'es', 'Ficha ficticia de pruebas'),
  ('00000000-0000-4000-8000-00000000ce02', 'ca', 'Fitxa fictícia de proves'),
  ('00000000-0000-4000-8000-00000000ce02', 'en', 'Fictitious test product');

insert into public.product_variants
  (id, product_id, size_ml, retail_price_cents, active) values
  ('00000000-0000-4000-8000-00000000ce03', '00000000-0000-4000-8000-00000000ce02',
   100, 4990, true);

insert into internal.variant_cost_records (variant_id, cost_net_cents, note) values
  ('00000000-0000-4000-8000-00000000ce03', 987654, 'Coste centinela 987654');

insert into internal.suppliers (id, name, lead_time_days) values
  ('00000000-0000-4000-8000-00000000ce04', 'Proveedor centinela 987654', 7);

insert into internal.supplier_variants (supplier_id, variant_id, supplier_sku) values
  ('00000000-0000-4000-8000-00000000ce04', '00000000-0000-4000-8000-00000000ce03',
   'REF-987654');

update public.products set status = 'published'
  where id = '00000000-0000-4000-8000-00000000ce02';

-- Perfil olfativo ficticio para tests/e2e/newsletter-scent.spec.ts.
insert into public.product_scent_profiles
  (product_id, top_notes, heart_notes, base_notes, families, seasons,
   times_of_day, source_url)
values
  ('00000000-0000-4000-8000-00000000ce02', '{bergamot}', '{rose}', '{amber}',
   '{floral}', '{winter}', '{night}', 'https://example.invalid/centinela');

commit;
