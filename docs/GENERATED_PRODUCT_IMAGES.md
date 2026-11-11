# Imágenes generadas de producto — 02–03/11/2026

Procedencia: [PR #59](https://github.com/albertnieves/adhara-web/pull/59), commit original `7f14e061135370e770fe27ffa4ed6076abf67bb8`. Son recreaciones generadas con fondo marfil y luz de estudio, no fotografías verificadas de las unidades físicas. No se han regenerado ni retocado sus bytes durante esta integración.

## Integración

- 56 WebP asociados por slug en `src/modules/catalog/domain/generated-product-images.ts`: 45 en `public/media/generated-products/2026-11-02/` y 11 en `public/media/generated-products/2026-11-03/`.
- Solo se añaden a productos que ya devuelve la lectura autorizada del catálogo. No crean productos ni cambian publicación, formatos, precios o existencias.
- Se muestran como principal en tarjetas y galerías, con origen `generated_draft`, `provisional: true`. La procedencia queda registrada internamente, sin etiqueta en la tienda. Conservan su color original, sin la corrección de brillo de las fotos de catálogo.
- Se conservan todas las fotos originales. Una foto propia marcada como principal desde el panel tiene prioridad sobre la recreación. La integración reside en el código, no en `product_media`; el panel sigue gestionando las fotografías originales.
- El feed de Google y Meta lee las imágenes originales. Las recreaciones tampoco se añaden al JSON-LD ni a las imágenes de las tarjetas sociales.
- No cambia la selección de escenas 3D del piloto.

## Excepción acordada

**Miss Sakura conserva su imagen actual**, por indicación del usuario el 02/11/2026. Su propuesta sigue en `assets/generated-products/2026-11-02/miss-sakura.webp`, fuera del directorio público y sin asociación: falta confirmar la variante Intense y el formato de 200 ml.

La comparación con las unidades físicas y el contenido de los estuches sigue pendiente; la integración no certifica fidelidad ni cambia el origen a foto propia/oficial. Para corregir una propuesta, sustituir el archivo con referencia verificada y conservar su procedencia; para retirarla, quitar su slug del registro y el archivo público.

## Verificación

Pruebas unitarias: correspondencia entre archivos y asociaciones, conservación de datos y originales, exclusión de Miss Sakura y perfumes ajenos al lote, prioridad de foto propia, idempotencia y exclusión de recreaciones en feed y JSON-LD. Se revisaron visualmente los 56 archivos de los dos lotes y todos se decodificaron como WebP. El componente compartido conserva las proporciones de los archivos cuadrados y verticales.
