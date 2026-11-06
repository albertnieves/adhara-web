# Estado del entorno del flujo de vídeo

Inventario del 06/11/2026 en la sesión en la nube (entorno «CLAUDE CLIPS»: contenedor Linux de 4 CPU y 15 GB de RAM, **sin GPU**). Se regenera con `npm run doctor` desde `video/`, que nunca muestra el valor de una clave. Este documento solo recoge lo comprobado; nada de lo que falta se ha simulado.

El mismo día, a petición tuya («install»), se instaló todo lo que puede funcionar aquí: las librerías de las etapas con versión exacta (`video/package.json` y su lockfile) y sox, Audacity y xvfb con apt. Lo de apt vive solo en este contenedor; para que esté en las próximas sesiones hace falta el script de preparación del entorno (ver abajo).

## Resumen

| Etapa                           | Qué hace falta                                                 | Estado aquí                                                                                  | Qué hace el flujo mientras tanto                                                                        |
| ------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 0 · Inventario                  | Node ≥ 22.18, pnpm, make                                       | ✅ Node 22.23.4, pnpm 11.19.0, GNU Make 4.3                                                  | —                                                                                                       |
| 1 · Storyboard (Excalidraw)     | Nada externo                                                   | ✅ El `.excalidraw` lo genera un script desde el JSON                                        | No hay conector de Excalidraw: el archivo se abre en excalidraw.com («Abrir») o en el plugin de VS Code |
| 2 · Sistema de diseño (Penpot)  | API o conector de Penpot y `PENPOT_ACCESS_TOKEN`               | ❌ Sin conector de Penpot en la sesión y sin token                                           | `design-system/tokens.json` es la fuente de verdad; pasos manuales abajo                                |
| 3 · Tipografía (Fontsource)     | `@fontsource/*` por npm                                        | ✅ Instalados: `@fontsource/cormorant-garamond` y `@fontsource/manrope` 5.3.0                | —                                                                                                       |
| 4 · Iconos (Lucide)             | `lucide-static` por npm                                        | ✅ Instalado: 1.69.0                                                                         | —                                                                                                       |
| 5 · Imágenes                    | `BFL_API_KEY`, `HIGGSFIELD_*`, `OPENAI_API_KEY`                | ❌ Ninguna clave; además la red del entorno no permite esos dominios                         | Se escriben los prompts en `prompts/`; las imágenes las subes tú a `assets/raw/`                        |
| 6 · ComfyUI                     | Servidor accesible (`COMFYUI_URL`) con GPU                     | ❌ Sin servidor en `127.0.0.1:8188`, sin GPU (`nvidia-smi` no existe) y Docker sin demonio   | Se versionan los workflows en `comfy/workflows/`; se ejecutan donde haya GPU                            |
| 7 · LTX 2.5 (imagen → vídeo)    | ComfyUI con GPU NVIDIA y los pesos de LTX                      | ❌ Igual que la 6. No se instala ComfyUI aquí: sin GPU no puede ejecutar Flux ni LTX         | Parámetros en `comfy/ltx.json`; sin vídeo, placeholder registrado                                       |
| 8 · SVG (SVGO)                  | `svgo` por npm                                                 | ✅ Instalado: 4.1.0                                                                          | —                                                                                                       |
| 9 · Movimiento (GSAP)           | `gsap` por npm                                                 | ✅ Instalado: 3.15.1                                                                         | —                                                                                                       |
| 10 · 3D (Three.js + Playwright) | `three`, Chromium headless                                     | ✅ `three` 0.186.1 (la de la tienda); Playwright 1.63.0 y Chromium preinstalados             | El ejemplo actual no pide 3D                                                                            |
| 11 · Composición (Remotion)     | `remotion` y `@remotion/cli` por npm, Chromium                 | ✅ Instalados: 4.0.541, con React 19.3.0                                                     | —                                                                                                       |
| 12 · Audio (Audacity)           | Audacity con `mod-script-pipe`, o sox/FFmpeg                   | ✅ Audacity 3.4.2 automatizado sin pantalla (probado, abajo); ✅ sox 14.4.2; ✅ FFmpeg 6.1.1 | —                                                                                                       |
| 13 · Revisión (FFmpeg)          | `ffprobe` y filtros `ebur128`, `blackdetect` y `silencedetect` | ✅ Todos presentes                                                                           | —                                                                                                       |

## Audacity sin pantalla: comprobado

Audacity es de escritorio, pero se puede manejar por `mod-script-pipe` dentro de una pantalla virtual (xvfb). Prueba del 06/11: un WAV de 3 s generado con sox a −20,9 LUFS se importó, se normalizó a −14 LUFS (`LoudnessNormalization`) y se exportó; FFmpeg (`ebur128`) midió −14,0 LUFS en el resultado. Lo que hace falta, y que automatizará la etapa 12:

1. `apt-get install -y --no-install-recommends sox libsox-fmt-all audacity xvfb xauth`.
2. Activar el módulo en `~/.audacity-data/audacity.cfg`: en `[Module]`, `mod-script-pipe=1`. En 3.4.2, 1 es «activado»; si falta la fecha del módulo en `[ModuleDateTime]`, Audacity lo marca como nuevo (4) y no lo carga. Basta con arrancarlo una vez, cerrarlo y poner el 1.
3. `xvfb-run -a audacity &` y esperar a las tuberías `/tmp/audacity_script_pipe.to.<uid>` y `.from.<uid>`.
4. Mandar un comando por línea (`Import2`, `SelectAll`, `LoudnessNormalization`, `Export2`…) y leer la respuesta hasta `BatchCommand finished: OK`.

**Abrirlo a mano en tu ordenador:** Audacity → Editar → Preferencias → Módulos → `mod-script-pipe` en «Activado», y reiniciar. Un `.aup3` se abre con Archivo → Abrir y se exporta con Archivo → Exportar audio → WAV (PCM 24 bits, 48 kHz).

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

## Node y pnpm

El repositorio fija Node 24.16.0 (`.nvmrc`), pero aquí hay Node 22.23.4. Los scripts de `video/` usan la eliminación de tipos de TypeScript de Node (≥ 22.18), así que funcionan con las dos versiones. `video/` es su propio workspace de pnpm (`pnpm-workspace.yaml`, como `pilot/animation-prototype`): `pnpm install` dentro de `video/` no toca la tienda. Solo esbuild (lo usa Remotion) tiene permiso para ejecutar su script de instalación.
