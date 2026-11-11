# Imágenes generadas de producto — 02–03/11/2026

Procedencia: [PR #59](https://github.com/albertnieves/adhara-web/pull/59), commit original `7f14e061135370e770fe27ffa4ed6076abf67bb8`. Son recreaciones generadas con fondo marfil y luz de estudio, no fotografías verificadas de las unidades físicas. No se han regenerado ni retocado sus bytes durante esta integración.

## Integración

- 57 WebP asociados por slug en `src/modules/catalog/domain/generated-product-images.ts`: 46 en `public/media/generated-products/2026-11-02/` y 11 en `public/media/generated-products/2026-11-03/`.
- Solo se añaden a productos que ya devuelve la lectura autorizada del catálogo. No crean productos ni cambian publicación, formatos, precios o existencias.
- Se muestran como principal en tarjetas y galerías, con origen `generated_draft`, `provisional: true`. La procedencia queda registrada internamente, sin etiqueta en la tienda. Conservan su color original, sin la corrección de brillo de las fotos de catálogo.
- Se conservan todas las fotos originales. Una foto propia marcada como principal desde el panel tiene prioridad sobre la recreación. La integración reside en el código, no en `product_media`; el panel sigue gestionando las fotografías originales.
- El feed de Google y Meta lee las imágenes originales. Las recreaciones tampoco se añaden al JSON-LD ni a las imágenes de las tarjetas sociales.
- No cambia la selección de escenas 3D del piloto.

## Miss Sakura

El 02/11/2026 se apartó por indicación del usuario hasta confirmar la variante Intense y el formato de 200 ml. El 11/11/2026, a petición expresa del usuario, se publica: el producto no tenía ninguna foto en `product_media` y mostraba la imagen de reserva. El archivo pasa de `assets/` a `public/media/generated-products/2026-11-02/miss-sakura.webp` sin cambiar sus bytes. Sigue pendiente comprobar con la unidad física que la variante (la recreación pone «Intense»; la ficha se llama «Miss Sakura», 200 ml) coincide.

La comparación con las unidades físicas y el contenido de los estuches sigue pendiente; la integración no certifica fidelidad ni cambia el origen a foto propia/oficial. Para corregir una propuesta, sustituir el archivo con referencia verificada y conservar su procedencia; para retirarla, quitar su slug del registro y el archivo público.

## Verificación

Pruebas unitarias: correspondencia entre archivos y asociaciones, conservación de datos y originales, asociación de Miss Sakura, exclusión de perfumes ajenos al lote, prioridad de foto propia, idempotencia y exclusión de recreaciones en feed y JSON-LD. Se revisaron visualmente los 57 archivos de los dos lotes y todos se decodificaron como WebP. El componente compartido conserva las proporciones de los archivos cuadrados y verticales.
