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

Parámetros de URL: `?p=<slug>` selecciona producto; `?nowebgl` fuerza el fallback sin 3D.

## Estructura

| Ruta | Qué contiene |
|---|---|
| `src/motion/spec.ts` | **Motion spec único** (zod): S0–S5, duraciones, ángulos, curvas y encuadres. Común a todos los productos |
| `src/motion/timeline.ts` | Reloj de la coreografía + `sample(spec, t)` puro. Emite `opened`, `risen`, `rotated`, `done` |
| `src/products/*.ts` | Un objeto por producto: medidas (mm, **ESTIMADAS**), arquetipo, materiales, imagen draft |
| `src/scene/` | `UnboxingScene`, `Box` (+ solapa con bisagra trasera), `Bottle`, `Stage`, `CameraRig` |
| `src/scene/bottles/` | Geometría por arquetipo (`lathe-shoulder` de momento) |
| `src/ui/` | Panel HTML, controles de revisión, etiqueta DRAFT, fallback |

## Reglas que respeta

- **Datos:** nombre y marca solo de `pilot/`. Precio `— €` (el PVP lo aprueba un administrador).
  La descripción es texto de relleno marcado **PLACEHOLDER**. No hay notas olfativas.
- **Imágenes:** los PNG de `pilot/assets-drafts` son GENERATED/DRAFT. Se usan como textura de
  prueba y fallback, y la escena muestra siempre «DRAFT – no publicable».
- **Medidas:** ninguna es real. Proporciones medidas sobre los drafts; ver cada `products/*.ts`.
  `scale` permite reescalar cuando lleguen las medidas del kit de tienda.
- **Accesibilidad:** con `prefers-reduced-motion` (real o simulado) se muestra el estado final
  sin animación. Sin WebGL, o si la escena falla, se muestra la imagen y el panel: la compra
  nunca depende del 3D.
- **Mandarin Sky:** no se incluye (C-02, C-05). Entrada comentada en `products/mandarin-sky.ts`.
