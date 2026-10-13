# Tarjeta de visita

![Anverso y reverso de la tarjeta](tarjeta-visita-maqueta.jpg)

Tarjeta de visita de la tienda, con un QR que abre el catálogo. Decisión en [DECISIONS.md](../../DECISIONS.md) §142.

## Diseño: la puerta del atelier

Un arco de medio punto, a trazo fino dorado, es la puerta de la tienda y se repite en las dos caras: la noche y el día del desierto del emblema.

- **Anverso (la noche):** fondo oud (`#2a1d15`) con un resplandor tenue detrás del logotipo. El arco sube desde el borde inferior y enmarca el logotipo completo en marfil, en un solo color y sin cambios, como piden sus reglas ([Logo.tsx](../../../src/modules/brand/Logo.tsx)). En la clave, la estrella de cuatro puntas del emblema; alrededor, cuatro estrellas pequeñas; abajo, «Castelldefels».
- **Reverso (el día):** fondo marfil (`#f5f1ea`). El mismo arco, cerrado como una ventana, enmarca el QR; arriba, «Catálogo · Catàleg · Catalogue», porque la web abre en el idioma de quien la escanea. Debajo, la web, un filete dorado, la dirección y el correo.
- **QR propio:** puntos en lugar de cuadrados (granos de arena o estrellas) y la estrella del emblema en dorado en el centro.

Colores y tipografías del sistema de diseño ([DESIGN_SYSTEM.md](../../DESIGN_SYSTEM.md)): tinta, humo, marfil, oud y los tres dorados; Cormorant Garamond y Manrope. El dorado solo va en líneas y estrellas, nunca en el logotipo.

## El QR

- **Destino:** `https://latelierdudesert.com/catalogo`. La web lo redirige al catálogo en el idioma del navegador: `/es/catalogo`, `/ca/cataleg` o `/en/catalog` (comprobado el 13/10/2026 en producción).
- **Código:** versión 5 (37 × 37 módulos) con corrección H (hasta un 30 %), que es la que permite la estrella central. Sin parámetros de seguimiento: una URL corta da un QR menos denso.
- **Tamaño:** 24 mm de lado (0,65 mm por módulo) y más de 4 módulos de margen libre hasta el arco.
- **Ojos casi cuadrados:** con las esquinas muy redondeadas, el lector de OpenCV dejaba de leerlo; los puntos no le afectan.
- **Comprobado:** zxing-cpp lo lee en el PDF rasterizado a 600 ppp, en el reverso a varias escalas y en 40 fotos simuladas (perspectiva, giro, desenfoque, ruido y luz desigual); OpenCV, en el reverso a tamaño real. El generador lo vuelve a leer cada vez.
- **Antes de imprimir el pedido completo:** escanearlo con dos móviles distintos en la prueba impresa.
- **Mientras haya tarjetas en circulación**, `latelierdudesert.com/catalogo` tiene que seguir funcionando: si cambia el dominio o la ruta, hay que mantener una redirección.

## Datos

Solo datos reales (nada inventado, CLAUDE.md):

- dirección: la de la tienda en Panel → Configuración y en el aviso legal;
- correo: `latelierdudesert@gmail.com`, el del pie de la web;
- web: `latelierdudesert.com`.

No lleva teléfono ni Instagram porque todavía no están en Panel → Configuración. Para añadirlos, se escriben en `CONTACT` de [generar/tarjeta.py](generar/tarjeta.py) (hasta cuatro líneas) y se regenera.

## Para la imprenta

- **Archivo:** [tarjeta-visita.pdf](tarjeta-visita.pdf). Dos páginas de 61 × 91 mm: la tarjeta de 55 × 85 mm (vertical) más 3 mm de sangrado por lado. Página 1, anverso; página 2, reverso, en la misma orientación. Lleva TrimBox y BleedBox, textos en curvas (sin tipografías) y color RGB, que la imprenta convierte a CMYK.
- **Margen de seguridad:** todo el texto queda a 4 mm o más del corte.
- **Prueba de color:** pedirla en papel. El oud y el dorado son los tonos que más cambian al pasar a CMYK.
- **Trazos finos:** el lema «Haute Parfumerie Orientale» del logotipo tiene trazos de 0,1 mm en marfil sobre el fondo oscuro. Lo resuelven bien la impresión digital de calidad y el offset; conviene comprobarlo en la prueba.
- **Esquinas rectas**, como en el sistema de diseño (radio 0).

### Papel y acabados (a elegir)

- **Papel:** sin estucar y con cuerpo, de algodón o similar, de 600 a 700 g, acabado mate. Un dúplex (dos hojas pegadas) deja ver el canto y da peso.
- **Tarjeta perfumada:** el papel de algodón sin estucar absorbe el perfume como una mouillette. Se pulveriza a unos 20 cm, se deja secar y se guarda en su caja; probar antes con una para ver que no deja marca.
- **Estampado dorado (opcional):** si se quiere el arco y las estrellas en oro de estampación, la imprenta pide una capa aparte con esos elementos; se genera a petición. El logotipo nunca va en dorado.

## Archivos

| Archivo                                                  | Qué es                                                  |
| -------------------------------------------------------- | ------------------------------------------------------- |
| [tarjeta-visita.pdf](tarjeta-visita.pdf)                 | Archivo de imprenta (anverso y reverso, con sangrado)   |
| [tarjeta-visita-anverso.png](tarjeta-visita-anverso.png) | Anverso al corte, 384 ppp                               |
| [tarjeta-visita-reverso.png](tarjeta-visita-reverso.png) | Reverso al corte, 384 ppp                               |
| [tarjeta-visita-maqueta.jpg](tarjeta-visita-maqueta.jpg) | Las dos caras juntas, para enseñarla                    |
| [qr-catalogo.svg](qr-catalogo.svg)                       | El QR suelto, con margen, para otros usos (bolsa, caja) |
| [generar/tarjeta.py](generar/tarjeta.py)                 | Generador de todo lo anterior                           |
| [generar/requirements.txt](generar/requirements.txt)     | Sus dependencias, con versión exacta                    |

## Regenerar

El generador va en Python, fuera de la app: no entra en `package.json` ni en `pnpm check`. Compone las dos caras en SVG (medidas en mm), convierte los textos en curvas con HarfBuzz y fontTools, imprime el PDF con el Chromium de Playwright, ajusta las cajas con pypdf y vuelve a leer el QR. Las tipografías se descargan de google/fonts (licencia OFL) a una carpeta temporal.

```sh
python3 -m venv /tmp/tarjeta
/tmp/tarjeta/bin/pip install -r docs/brand/tarjetas/generar/requirements.txt
/tmp/tarjeta/bin/python docs/brand/tarjetas/generar/tarjeta.py
```

Usa el Chromium de `/opt/pw-browsers/chromium` o el de la variable `PLAYWRIGHT_CHROMIUM`.
