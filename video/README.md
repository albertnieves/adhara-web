# Clips de vídeo de L’Atelier du Désert

Flujo reproducible que convierte un tema (`briefs/<slug>.md`) en clips MP4 de 1080×1920 y 1920×1080 con el sistema de diseño de la marca. Es un subproyecto aislado de la tienda: tiene su `package.json`, su `tsconfig.json` y su `build/`, y la tienda no importa nada de aquí.

**Estado:** etapas 0–2 en propuesta, pendientes de aprobación. El resto aún no existe (`make clip` se para en la primera etapa pendiente). Lo que falta del entorno está en [docs/setup-status.md](docs/setup-status.md).

## Uso

```bash
cd video
npm run doctor                     # inventario de herramientas y claves
npm run tokens                     # valida design-system/tokens.json (contraste AA, movimiento, escala)
npm run storyboard -- --slug ejemplo   # valida storyboard/ejemplo.json y genera el .excalidraw
make clip SLUG=ejemplo             # todas las etapas en orden
npm test && npm run typecheck      # pruebas y tipos de los scripts
```

Los scripts son TypeScript que Node ejecuta directamente (≥ 22.18) y por ahora solo usan módulos de Node. Cada librería (Fontsource, Lucide, SVGO, GSAP, Remotion…) se instalará con versión exacta en su etapa.

## Etapas

| #   | Etapa                          | Comando              | Fuente → salida                                                                       | Estado    |
| --- | ------------------------------ | -------------------- | ------------------------------------------------------------------------------------- | --------- |
| 0   | Inventario                     | `npm run doctor`     | entorno → [docs/setup-status.md](docs/setup-status.md)                                | hecho     |
| 1   | Desglose (Excalidraw)          | `npm run storyboard` | `storyboard/<slug>.json` → `storyboard/<slug>.excalidraw`, `build/<slug>/storyboard/` | propuesta |
| 2   | Sistema de diseño (Penpot)     | `npm run tokens`     | `design-system/tokens.json` → `build/<slug>/tokens/`                                  | propuesta |
| 3   | Tipografía (Fontsource)        | `npm run fonts`      | tokens → fuentes por npm                                                              | pendiente |
| 4   | Iconos (Lucide)                | `npm run icons`      | storyboard + tokens → SVG                                                             | pendiente |
| 5   | Fotogramas clave               | `npm run prompts`    | storyboard + bloque de estilo → `prompts/<escena>.md`                                 | pendiente |
| 6   | Orquestación (ComfyUI)         | `npm run comfy`      | `comfy/workflows/*.json` → `/prompt`                                                  | pendiente |
| 7   | Imagen a vídeo (LTX 2.5)       | `npm run ltx`        | fotogramas + `comfy/ltx.json` → clips de 4–8 s                                        | pendiente |
| 8   | Gráficos (SVGO)                | `npm run svg`        | `assets/raw/*.svg` → `assets/optimized/`                                              | pendiente |
| 9   | Movimiento (GSAP)              | `npm run motion`     | tokens → timelines de `motion/`                                                       | pendiente |
| 10  | 3D (Three.js)                  | `npm run three`      | escenas de `three/` → PNG con Playwright                                              | pendiente |
| 11  | Composición (Remotion)         | `npm run remotion`   | todo lo anterior → MP4 por formato                                                    | pendiente |
| 12  | Audio (Audacity, o sox/FFmpeg) | `npm run audio`      | `audio/mix.json` → WAV                                                                | pendiente |
| 13  | Revisión (FFmpeg)              | `npm run review`     | MP4 + WAV → `build/<slug>/final.mp4`, `review/<slug>.md`                              | pendiente |

## Reglas

- `storyboard/<slug>.json` es la fuente de verdad de duraciones y textos; `design-system/tokens.json`, de colores, tipos, tiempos y estilo de imagen. Ninguna etapa escribe valores sueltos.
- Antes de dar por buena una escena se repasa [design-system/anti-patterns.md](design-system/anti-patterns.md).
- No se inventan imágenes, música ni datos. Lo que falte va a `assets/placeholders/` y se registra en el informe. Una cifra sin fuente no se renderiza.
- Antes de un lote con API de pago se muestra el número estimado de llamadas y se pide confirmación.
