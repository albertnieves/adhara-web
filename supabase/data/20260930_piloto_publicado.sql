-- Carga de datos (no migración): los 4 perfumes del piloto publicados el 30/09, a
-- petición del usuario, para que se vean en la tienda con su escena 3D.
-- - Khamrah: formato de 100 ml confirmado por el usuario.
-- - Yara: PVP de la tienda del distribuidor oficial en España (orientfragance.com).
-- - Asad, Khamrah y Club de Nuit Intense Man LE no se venden allí: por decisión del usuario,
--   PVP de la web oficial de la marca en EE. UU. pasado a euros con el cambio de
--   referencia del BCE del 30/09 (1 € = 1,1355 $), redondeado al céntimo.
-- La procedencia de cada PVP queda en products.source_ref. Idempotente.

insert into public.product_variants (product_id, size_ml, position)
select p.id, 100, 0 from public.products p
where p.slug = 'khamrah'
  and not exists (select 1 from public.product_variants v where v.product_id = p.id);

update public.products
set source_ref = 'pilot/ (nombre y marca); formato 100 ml confirmado por el usuario (30/09); concentración pendiente'
where slug = 'khamrah'
  and source_ref = 'pilot/ (nombre y marca); concentración y formato pendientes del catálogo';

update public.product_variants v set retail_price_cents = pr.cents
from (values
  ('yara', 100, 2999),
  ('asad', 100, 3962),
  ('khamrah', 100, 4402),
  ('club-de-nuit-intense-man-le', 105, 6605)
) as pr(slug, ml, cents)
join public.products p on p.slug = pr.slug
where v.product_id = p.id and v.size_ml = pr.ml and v.retail_price_cents is null;

update public.products p
set source_ref = p.source_ref || '; ' || pr.note, status = 'published'
from (values
  ('yara', 'PVP 29,99 € (100 ml) de la tienda del distribuidor oficial en España, https://www.orientfragance.com/products/yara-lattafa, a petición del usuario (30/09)'),
  ('asad', 'PVP 39,62 €: 44,99 $ (100 ml) en https://lattafa-usa.com/products/asad al cambio BCE del 30/09 (1 € = 1,1355 $), a petición del usuario'),
  ('khamrah', 'PVP 44,02 €: 49,99 $ (100 ml) en https://lattafa-usa.com/products/khamrah al cambio BCE del 30/09 (1 € = 1,1355 $), a petición del usuario'),
  ('club-de-nuit-intense-man-le', 'PVP 66,05 €: 75 $ (3.6 oz) en https://armaf.com/products/club-de-nuit-intense-man-limited-edition al cambio BCE del 30/09 (1 € = 1,1355 $), a petición del usuario')
) as pr(slug, note)
where p.slug = pr.slug and p.status = 'draft';
