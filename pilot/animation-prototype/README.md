# Prototipo visual · escena de unboxing (piloto, paso 3a)

Prototipo **aislado** para aprobar ritmo, encuadre y «feel» de la coreografía descrita en
`pilot/PILOTO_ANIMACION_FLUJO.md` (§2, enfoque C). **No es la implementación final** ni forma
parte de la app: tiene su propio `package.json`, `pnpm-workspace.yaml` y lockfile, y la raíz
del repo lo excluye de `tsc`, ESLint y Prettier. three/R3F no se instalan en la app hasta F8.

## Arranque

```bash
cd pilot/animation-prototype
nvm use            # Node 24.16.0 (mismo que la raíz)
pnpm install
pnpm dev           # http://127.0.0.1:5173
pnpm build         # tsc --noEmit + vite build
```

Parámetros de URL: `?p=<slug>` selecciona producto (`asad`, `yara`, `club-de-nuit-intense-man-le`,
`khamrah`); `?grey=1` arranca en formas grises; `?templates=1` muestra las plantillas de
caja; `?nowebgl` fuerza el fallback sin 3D.

La barra de revisión muestra FPS, draw calls y triángulos. **Los FPS solo valen medidos en un
dispositivo real** (en CI/headless el render es por software).

## Estructura

| Ruta | Qué contiene |
|---|---|
| `src/motion/spec.ts` | **Motion spec único** (zod): S0–S5, duraciones, ángulos, curvas y encuadres. Común a todos los productos |
| `src/motion/timeline.ts` | Reloj de la coreografía + `sample(spec, t)` puro. Emite `opened`, `risen`, `rotated`, `done` |
| `src/products/*.ts` | Un objeto por producto: medidas (mm, **ESTIMADAS**), arquetipo, materiales, imagen draft |
| `src/scene/` | `UnboxingScene`, `Box` (+ solapa con bisagra trasera), `Bottle`, `Stage`, `CameraRig` |
| `src/scene/bottles/` | Geometría por arquetipo: `lathe-shoulder` (Asad, Yara), `rect-prism` (CDN LE), `square-glass` (Khamrah) |
| `src/scene/projection.ts` | Proyección frontal del draft sobre la geometría, calibrada en px/mm |
| `src/scene/Box.tsx` | Caja con un material por cara: foto del kit, plantilla rotulada o color del cartón |
| `src/ui/` | Panel HTML, controles de revisión, etiqueta DRAFT, fallback |

## Reglas que respeta

- **Datos:** nombre y marca solo de `pilot/`. Precio `— €` (el PVP lo aprueba un administrador).
  La descripción es texto de relleno marcado **PLACEHOLDER**. No hay notas olfativas.
- **Imágenes:** los PNG de `pilot/assets-drafts` son GENERATED/DRAFT. Se usan como textura de
  prueba y fallback, y la escena muestra siempre «DRAFT – no publicable». Nunca los `_REJECTED`.
  Las texturas llevan el sombreado horneado del draft: sirven para juzgar encuadre, no acabado.
- **Khamrah:** no hay draft frontal. El vidrio es `MeshPhysicalMaterial` (transmission, IOR 1,5)
  con un normal map de estrías **provisional** generado en código; la placa usa el recorte del
  draft 3/4.
- **Medidas:** ninguna es real. Proporciones medidas sobre los drafts; ver cada `products/*.ts`.
  `scale` permite reescalar cuando lleguen las medidas del kit de tienda.
- **Accesibilidad:** con `prefers-reduced-motion` (real o simulado) se muestra el estado final
  sin animación. Sin WebGL, o si la escena falla, se muestra la imagen y el panel: la compra
  nunca depende del 3D.
- **Cajas:** su arte sale solo de **fotos propias** (`pilot/kit/`, ver su README). Mientras no
  las haya, la caja es de cartón neutro; «Plantillas de caja» rotula cada cara para comprobar
  el mapeo (no es arte real).
- **Mandarin Sky:** no se incluye (C-02, C-05). Entrada comentada en `products/mandarin-sky.ts`.
