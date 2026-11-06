# Estado del entorno del flujo de vídeo

Inventario del 06/11/2026 en la sesión en la nube (entorno «CLAUDE CLIPS»: contenedor Linux de 4 CPU y 15 GB de RAM, **sin GPU**). Se regenera con `npm run doctor` desde `video/`, que nunca muestra el valor de una clave. Este documento solo recoge lo comprobado; nada de lo que falta se ha simulado.

## Resumen

| Etapa                           | Qué hace falta                                                 | Estado aquí                                                                                                     | Qué hace el flujo mientras tanto                                                                        |
| ------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 0 · Inventario                  | Node ≥ 22.18, npm, make                                        | ✅ Node 22.23.4, npm 10.9.9, GNU Make 4.3                                                                       | —                                                                                                       |
| 1 · Storyboard (Excalidraw)     | Nada externo                                                   | ✅ El `.excalidraw` lo genera un script desde el JSON                                                           | No hay conector de Excalidraw: el archivo se abre en excalidraw.com («Abrir») o en el plugin de VS Code |
| 2 · Sistema de diseño (Penpot)  | API o conector de Penpot y `PENPOT_ACCESS_TOKEN`               | ❌ Sin conector de Penpot en la sesión y sin token                                                              | `design-system/tokens.json` es la fuente de verdad; pasos manuales abajo                                |
| 3 · Tipografía (Fontsource)     | Registro de npm                                                | ✅ Accesible: `@fontsource/cormorant-garamond` y `@fontsource/manrope` 5.3.0                                    | Se instalan en su etapa (no por anticipación)                                                           |
| 4 · Iconos (Lucide)             | Registro de npm                                                | ✅ Accesible: `lucide-static` 1.69.0                                                                            | Se instala en su etapa                                                                                  |
| 5 · Imágenes                    | `BFL_API_KEY`, `HIGGSFIELD_*`, `OPENAI_API_KEY`                | ❌ Ninguna clave; además la red del entorno no permite esos dominios                                            | Se escriben los prompts en `prompts/`; las imágenes las subes tú a `assets/raw/`                        |
| 6 · ComfyUI                     | Servidor accesible (`COMFYUI_URL`) con GPU                     | ❌ Sin servidor en `127.0.0.1:8188`, sin GPU (`nvidia-smi` no existe) y Docker sin demonio                      | Se versionan los workflows en `comfy/workflows/`; se ejecutan donde haya GPU                            |
| 7 · LTX 2.5 (imagen → vídeo)    | ComfyUI con GPU NVIDIA y los pesos de LTX                      | ❌ Igual que la 6                                                                                               | Parámetros en `comfy/ltx.json`; sin vídeo, placeholder registrado                                       |
| 8 · SVG (SVGO)                  | `svgo` por npm                                                 | ❌ No instalado; ✅ accesible en npm (4.1.0)                                                                    | Se instala en su etapa                                                                                  |
| 9 · Movimiento (GSAP)           | `gsap` por npm                                                 | ✅ Accesible (3.15.1)                                                                                           | Se instala en su etapa                                                                                  |
| 10 · 3D (Three.js + Playwright) | `three`, Chromium headless                                     | ✅ Playwright 1.63.0 y Chromium preinstalados                                                                   | El ejemplo actual no pide 3D                                                                            |
| 11 · Composición (Remotion)     | `remotion` por npm, Chromium                                   | ✅ Accesible (4.0.541)                                                                                          | Se instala en su etapa                                                                                  |
| 12 · Audio (Audacity)           | Audacity con `mod-script-pipe`, o sox/FFmpeg                   | ❌ Audacity no instalado y sin pantalla (es de escritorio); ❌ sox no instalado; ✅ FFmpeg 6.1.1 con `loudnorm` | Mezcla con FFmpeg y parámetros en `audio/mix.json`; Audacity queda como paso manual documentado         |
| 13 · Revisión (FFmpeg)          | `ffprobe` y filtros `ebur128`, `blackdetect` y `silencedetect` | ✅ Todos presentes                                                                                              | —                                                                                                       |

## Lo que necesito de ti

1. **El tema.** El encargo llegó con `[TEMA]` sin rellenar; el ejemplo usa uno propuesto por mí (ver `briefs/ejemplo.md`).
2. **Imágenes (etapa 5).** O claves de Flux, Higgsfield u OpenAI, o subir tú los fotogramas clave a `assets/raw/` con los prompts de `prompts/`. Antes de cualquier lote de pago te enseñaré el número estimado de llamadas.
3. **Vídeo (etapas 6–7).** Una máquina con GPU NVIDIA y ComfyUI (la tuya o un servicio en la nube) con su URL. En este contenedor no se puede ejecutar LTX.
4. **Música (etapa 12).** Una pista con licencia de uso comercial. Sin ella, el clip lleva un placeholder registrado en el informe.
5. **Licencias.** Antes del uso comercial, revisar las de Flux, LTX (pesos del modelo) y Remotion (gratuita solo hasta cierto tamaño de empresa).

## Cómo se darán las claves

Nunca por chat ni en el repositorio (`video/.env.example` solo lleva los nombres).

- **En esta sesión en la nube:** las claves se guardan como secretos de red del entorno y el proxy las inyecta en las peticiones a su dominio. Además hay que permitir el dominio de cada API en la red del entorno. Te pediré las dos cosas en su etapa, con el formulario seguro y tu aprobación, no antes.
- **En tu máquina:** variables de entorno con los nombres de `video/.env.example`.

## Penpot: pasos manuales

No hay conector de Penpot, así que `design-system/tokens.json` manda. El archivo usa el formato de tokens del W3C (DTCG), el que importa el panel de tokens de Penpot 2.x. Los pasos son:

1. En Penpot, abre el archivo del sistema de diseño y el panel **Tokens**.
2. Usa **Importar** y elige `video/design-system/tokens.json`.
3. Comprueba que entran los colores, la escala tipográfica, el espaciado y los radios. Los grupos propios del vídeo (`motion`, `text.reading` e `image`) pueden no importarse: viven solo en el JSON y los leen los scripts.
4. Si cambias un valor en Penpot, cópialo al JSON y pasa `npm run tokens`: un cambio que no esté en el JSON no existe para el flujo.

Hay que verificar estos pasos con tu versión de Penpot. Si aparece un token de API, la etapa 2 podrá sincronizar por script.

## Node

El repositorio fija Node 24.16.0 (`.nvmrc`), pero aquí hay Node 22.23.4. Los scripts de `video/` solo usan módulos de Node y la eliminación de tipos de TypeScript (Node ≥ 22.18), así que funcionan con las dos versiones.
