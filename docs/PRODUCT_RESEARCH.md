# Investigación de producto (borrador)

**Borrador.** Recoge cómo se guarda hoy la procedencia de los datos y cómo se ampliará en la Fase 4 (sistema de research). El diseño completo está en `docs/source/FASE_0_ARQUITECTURA.md` §7.

## Regla que no cambia

No se inventan productos, precios, notas, reseñas ni imágenes representadas como producto real. Todo dato publicado debe poder responder a «¿de dónde salió?». Si falta un dato, el perfume queda en borrador o el campo vacío: nunca se rellena con una suposición presentada como hecho (AGENTS.md).

## Qué hay hoy (Fase 1)

Procedencia simplificada (DECISIONS §30), sin las tablas de claims, fuentes y conflictos del plan:

| Dato                    | Dónde se guarda la procedencia                                 | Ejemplos reales                                                                                                                                       |
| ----------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Perfume, marca, formato | `products.source_ref`                                          | Página del PDF «CATALOGO 2026»; ficha de orientfragance.com                                                                                           |
| PVP                     | `products.source_ref` y decisiones del usuario                 | Ficha del distribuidor oficial en España; web oficial de la marca en EE. UU. con el cambio del BCE del día, por decisión del usuario (DECISIONS §57)  |
| Imágenes                | `product_media.origin`, `product_media.source` y `provisional` | Fotos oficiales de marca comprobadas una a una contra el PDF o la tienda oficial; recortes del catálogo para marcas sin web accesible (DECISIONS §55) |
| Marca deducida          | `source_ref` marcado «por revisar»                             | Páginas 2–26 del PDF, donde el catálogo no indica la marca (DECISIONS §54)                                                                            |
| Coste                   | `internal.variant_cost_records.note`                           | Albarán o importación del CSV del catálogo                                                                                                            |

Todas las imágenes actuales son provisionales hasta tener fotos propias y revisar los derechos de las oficiales antes de abrir la web al público.

## Orígenes de un dato (Fase 4)

| Origen    | Significado                                                      | Publicable                                                                                     |
| --------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| CATALOG   | Viene del PDF del proveedor                                      | Solo tras revisión humana                                                                      |
| VERIFIED  | Contrastado con una fuente externa (URL y fecha)                 | Sí                                                                                             |
| EDITORIAL | Escrito por la tienda                                            | Sí, con autor y fecha                                                                          |
| GENERATED | Producido por IA                                                 | Solo marketing e imágenes con aprobación; nunca hechos (notas, año, perfumista, concentración) |
| MANUAL    | Introducido por el personal sin fuente (p. ej. medido en tienda) | Sí, con autor y nota                                                                           |

## Prioridad de fuentes

Fabricante > distribuidor oficial > tienda especializada > base de datos de perfumería > otras. En la práctica, para el catálogo actual: web oficial de la marca, después orientfragance.com (distribuidor oficial en España y Portugal) y, por último, el PDF del proveedor.

## Claims y conflictos (Fase 4)

1. Un claim por campo y fuente, con evidencia.
2. Dos claims del mismo campo con valores distintos abren un conflicto.
3. Una persona acepta, rechaza o resuelve con nota; **nunca se resuelve en silencio**.
4. La completitud se recalcula por grupos de campos (identificación, perfil olfativo, variante comercial, media y contenido).
5. La investigación asistida por IA solo crea claims propuestos con su evidencia, nunca aceptados.

La taxonomía de familias olfativas y notas no se siembra: se construirá desde el research para no inventarla (DECISIONS §86).

## Pendiente para completar este documento

- Esquema de `sources`, `product_claims`, `product_conflicts` y `product_field_provenance` con su RLS.
- Migración de `source_ref` y de la procedencia de imágenes a claims.
- Pesos de completitud y colas de revisión en el panel.
