# Precios

Cómo se guardan, calculan y validan los precios. El dinero va siempre en céntimos enteros y los porcentajes en puntos básicos (1 % = 100 pb); el precio y el stock se calculan y validan en el servidor.

## Los cuatro precios

| Precio                       | Dónde                                            | Quién lo ve                           | Estado                                                                                                                             |
| ---------------------------- | ------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| PVP (con IVA)                | `product_variants.retail_price_cents`            | Público, si el perfume está publicado | Implementado                                                                                                                       |
| Precio anterior (tachado)    | `product_variants.compare_at_price_cents`        | Público, solo al anunciar una rebaja  | Implementado con la regla Ómnibus                                                                                                  |
| Coste de compra (neto)       | `internal.variant_cost_records` (solo inserción) | `pricing.view_cost` con MFA           | Implementado; el vigente es el último registro (DECISIONS §45)                                                                     |
| Precio de mercado / research | —                                                | —                                     | Diseño en la Fase 0; llega con el research de precios (F4b). Las referencias de la importación se guardan como procedencia del PVP |

Los precios del PDF «CATALOGO 2026» son **coste interno**, no PVP (decisión del usuario del 30/09, DECISIONS §54).

## IVA

IVA general del 21 % (`VAT_GENERAL_BP = 2100`), pendiente de confirmar con la asesoría fiscal. El PVP se guarda con IVA; el margen y los informes trabajan sobre el neto.

- `grossToNet(bruto, ivaPb) = bruto × 10 000 ÷ (10 000 + ivaPb)` y `netToGross`, con redondeo **al par más cercano** (`divideHalfEven`) y sin coma flotante (`src/lib/money.ts`, `tests/unit/money.test.ts`).

## Margen

`computeMargin` (`src/modules/pricing/domain/margin.ts`):

- ingreso neto = PVP sin IVA;
- margen = ingreso neto − coste neto vigente;
- margen % = margen ÷ ingreso neto, en puntos básicos.

Sin coste registrado el margen es **desconocido**, nunca 0. Caso de referencia probado: PVP 29,95 € con IVA del 21 % y coste 18,00 € → neto 24,75 €, margen 6,75 € y 27,27 %. El margen teórico de los informes no incluye descuentos, envíos ni comisiones (DECISIONS §71).

## Cambios de PVP

`reviewPriceChange` (`src/modules/pricing/domain/price-change.ts`, puro) revisa cada cambio, individual o masivo:

| Aviso                                  | Efecto                                      |
| -------------------------------------- | ------------------------------------------- |
| Importe no válido                      | Bloquea                                     |
| Precio anterior no mayor que el PVP    | Bloquea                                     |
| Rebaja sin historial de PVP            | Bloquea                                     |
| Precio anterior por encima del Ómnibus | Bloquea                                     |
| Por debajo del coste                   | Pide confirmación explícita                 |
| Por debajo del margen mínimo           | Pide confirmación (mínimo provisional: 0 %) |
| Cambio del 20 % o más                  | Pide confirmación                           |
| Sin coste registrado                   | Solo informa                                |

Los umbrales son provisionales hasta que los fije el negocio (`PROVISIONAL_PRICING_POLICY`). El servidor vuelve a calcular la revisión y exige cada confirmación pendiente; desde el panel, la revisión queda ligada a la persona, a la versión del formato y al coste revisados, caduca a los quince minutos y se aplica una sola vez (`admin_review_price` → `admin_apply_price_review`); un cambio simultáneo obliga a revisar de nuevo ([DELIVERY_REPORT.md](DELIVERY_REPORT.md)).

En la base de datos, cambiar el PVP o el precio anterior exige `pricing.edit_retail` con MFA aunque se escriba directamente en la tabla (trigger `guard_variant_price`), y cada cambio queda en `internal.price_change_log`, de solo inserción (pgTAP `02` y `07`).

## Ómnibus

Al anunciar una rebaja, el precio anterior mostrado no puede superar el PVP más bajo de los 30 días previos (art. 20 de la Ley 7/1996). `lowestPriceInWindow` lo calcula con el historial de `price_change_log`; el panel lo lee con `admin_variant_price_history`. Las excepciones legales (rebajas progresivas) están pendientes de asesoría (DECISIONS §16).

## Cambios masivos

Hasta 300 formatos por cambio, con porcentajes o importes y redondeos comerciales (`src/modules/pricing/domain/bulk.ts`). Cada fila se revisa como un cambio individual; se excluyen los formatos en rebaja y solo se aplican las filas marcadas con todas sus confirmaciones (DECISIONS §53).

## Publicación

Un perfume solo se publica con `catalog.publish` y al menos un formato **activo con PVP** (trigger `enforce_product_publication`, pgTAP `02` y `07`). Es la versión implementada de `can_publish`; el resto de condiciones del plan (traducción publicada, imagen aprobada no PDF, sin conflictos críticos) llega con el research y la media (DECISIONS §86).

## Aprobación

Hoy aprueba quien aplica el cambio: el administrador de la tienda o del sistema, con MFA y confirmaciones explícitas. Las propuestas de precio de un research de mercado, con aprobación separada, son de la fase F4b.
