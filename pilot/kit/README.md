# Kit de tienda · fotos y medidas reales

Aquí van las **fotos propias** de los productos físicos (plan §4, paso 1). Sustituyen a las
medidas estimadas y a las referencias oficiales provisionales de `pilot/assets-refs/` (no
publicables). No se generan ni se inventan caras.

## Estructura

```
pilot/kit/
└─ <producto>/                 asad · yara · club-de-nuit-intense-man-le · khamrah
   ├─ medidas.md               caja y frasco en mm
   └─ box/
      ├─ raw/                  fotos originales, sin tocar (JPG/HEIC del móvil)
      └─ front.jpg …           caras ya enderezadas y recortadas (las prepara quien integra)
```

Nombres de las caras procesadas: `front`, `back`, `left`, `right`, `top`, `bottom` e `inside`
(opcional, solo si el interior va impreso).

## Cómo hacer las fotos de la caja

- Una foto por cara, **de frente** (móvil paralelo a la cara), con la cara entera y algo de margen.
- Luz de día o difusa, **sin flash** (los dorados reflejan). Fondo liso.
- Si sale algo torcida no pasa nada: se endereza marcando las 4 esquinas.

**Orientación** (la escena la asume; comprobada con las plantillas del prototipo):

| Cara             | Cómo colocar la caja para la foto                                       |
| ---------------- | ----------------------------------------------------------------------- |
| `front`          | De pie, mirando la cara principal                                       |
| `back`           | De pie, girada 180°                                                     |
| `left` / `right` | De pie; izquierda y derecha **mirando la frontal**                      |
| `top`            | Desde arriba, con el **borde frontal abajo** en la foto                 |
| `bottom`         | Volcada hacia atrás, de modo que la **frontal quede arriba** en la foto |
| `inside`         | Interior de la solapa o de la caja, si lleva impresión                  |

**Además:** cómo se abre la caja. La escena admite `top-flap` (solapa superior), `lift-lid`
(tapa que se levanta de una base) y `hinged-lid` (estuche rígido con tapa de bisagra, frasco
tumbado). Hay que confirmar con la caja real la de Asad y Yara (supuesta `top-flap`).

## medidas.md

```
Caja: ancho × alto × fondo = … × … × … mm
Frasco: alto total … mm · alto del tapón … mm · ancho … mm · fondo … mm
Apertura: solapa superior / tapa / cajón / …
Fecha y autor de las fotos: …
```

## Procedencia

Cada cara integrada se registra en la config del producto con `origin: 'PHOTO'` y su ruta, y
aquí:

| Producto | Cara | Archivo | Origen | Fecha |
| -------- | ---- | ------- | ------ | ----- |
| —        | —    | —       | —      | —     |
