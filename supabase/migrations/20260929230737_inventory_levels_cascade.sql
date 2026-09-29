-- Un nivel de stock sin movimientos (p. ej. creado por un recuento que cuadra o
-- por fijar el punto de pedido) no debe impedir borrar un formato en borrador.
-- La protección real del historial sigue en inventory_movements (restrict):
-- un formato con movimientos no se puede borrar.
alter table public.inventory_levels
  drop constraint inventory_levels_variant_id_fkey,
  add constraint inventory_levels_variant_id_fkey
    foreign key (variant_id) references public.product_variants (id) on delete cascade;
