-- Carga de datos (no migración): activa las seis escenas 3D nuevas (DECISIONS §190)
-- en sus perfumes. Solo cambia products.unboxing_scene, y solo si estaba vacío, para no
-- pisar una escena elegida en el panel. Un slug que el código desplegado aún no conoce
-- se ignora (findSceneSlug), así que se puede aplicar antes o después de desplegar.
-- Idempotente.

update public.products p
set unboxing_scene = v.scene
from (values
  ('asad-bourbon', 'asad-bourbon'),
  ('asad-elixir', 'asad-elixir'),
  ('yara-elixir', 'yara-elixir'),
  ('yara-moi', 'yara-moi'),
  ('club-de-nuit-intense', 'club-de-nuit-intense'),
  ('club-de-nuit-iconic', 'club-de-nuit-iconic')
) as v(slug, scene)
where p.slug = v.slug
  and p.unboxing_scene is null;
