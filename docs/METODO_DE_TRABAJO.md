# Método de trabajo de los agentes

Cómo trabajamos Claude (Fable, Opus, Sonnet) y Codex en este repositorio. Completa a [AGENTS.md](../AGENTS.md) y [CLAUDE.md](../CLAUDE.md): aquellas son las reglas; esto es el oficio, con los errores reales de los que salió cada punto. Quien aprenda algo nuevo que valga para la próxima sesión lo añade aquí, corto y con su fecha.

## 1. Antes de tocar nada

1. **Leer, en este orden:** el encargo entero, `docs/STATUS.md` (solo la entrada más reciente y «Pendiente del usuario»), `docs/ROADMAP.md` y las decisiones que cite el tema (`grep -n "§NNN" docs/DECISIONS.md`). No leer STATUS entero: son cientos de líneas.
2. **Mirar el estado real, no el documentado.** La base (`atelier-dev`, que es producción), Vercel y la web pública mandan sobre lo que diga un documento. Una consulta de solo lectura cuesta segundos y evita trabajar sobre una foto vieja.
3. **Separar el encargo en entregas independientes** y decir cuáles tocan producción. Un encargo como «inventario + diseño + venta + seguridad + roadmap» son cinco trabajos: se hacen todos, pero cada uno se verifica y se documenta por separado.
4. **Preguntar solo lo que decide el titular** y que no se puede deducir. Si hay un criterio razonable y reversible, se aplica, se escribe en DECISIONS y se sigue.

## 2. Datos de producción

- **`atelier-dev` es la tienda real.** Nunca `db reset`, nunca borrar para «limpiar». Los cambios de datos van en `supabase/data/AAAAMMDD_tema.sql`, idempotentes, con una cabecera que diga quién lo pidió, de dónde salen los datos y qué no se cargó.
- **Recuentos, no borrados.** El stock no se edita: se registra un movimiento (`STOCKTAKE_ADJUSTMENT`) por formato que cambia, con motivo y referencia. Así el historial explica cada cifra.
- **Comprobar antes y después con una cifra de control.** El 13/11: la hoja sumaba 332 unidades, el script afirmaba 332 antes de escribir y la base devolvió 332 después (920 − 588). Si la cifra no cuadra, no se confirma la transacción.
- **Cargar en dos pasos cuando los datos pasan por el chat:** primero a una tabla de trabajo en `internal`, comparar su huella (`md5`) con la del origen, y solo entonces transformar. Detecta cualquier error de copia. Borrar la tabla de trabajo al acabar.
- **Nunca escribir una cifra de control «de memoria».** El 13/11 una comprobación llevaba una suma inventada; habría abortado una carga correcta. Las cifras de control se calculan con el mismo script que genera los datos.
- **No inventar para rellenar.** Sin marca en el documento: «Marca por identificar». Sin volumen: «Formato por confirmar». Sin PVP: borrador. La errata del proveedor se copia y se anota en la procedencia; no se «corrige» a ojo.
- **Los costes no van al repositorio.** Se registran en `internal` y el archivo de datos dice que existen y de qué documento salen.
- **Las herramientas de la base pueden pedir confirmación al titular** (borrados, `drop`). Si caduca sin respuesta, no se reintenta: se deja escrito qué quedó pendiente y se sigue con lo demás.

## 3. Diseño

- **Se cambian valores de tokens, no se añaden colores a los componentes.** Un cambio de paleta empieza por `globals.css` y termina cuando `tests/unit/design-tokens.test.ts` pasa: si un par falla el contraste, se ajusta el token, no la prueba.
- **Buscar los literales que copian tokens** (`grep` del hexadecimal antiguo): el correo de pedido, el canvas de la ficha y las páginas servidas sin CSS los repiten a mano.
- **Medir antes de elegir un color.** El beige del 13/11 salió de leer los píxeles del fondo de las fotos, no de probar a ojo.
- **Mirarlo en el navegador** a 1440 y 390 px antes de darlo por hecho, con datos reales en solo lectura si la base local no está disponible. Una captura encontró que la fila de casas perdía su margen al encajar el scroll; las pruebas no lo habrían visto.
- **El movimiento que sigue solo necesita pausa** (WCAG 2.2.2). Si se puede evitar que algo se mueva solo, mejor: menos reglas que cumplir.

## 4. Seguridad

- **Una regla de seguridad no se quita: se le añade una excepción explícita, con nombre, aviso y salida.** `WEB_CHECKOUT_TEST=1` (§193) no cambia el valor por defecto, obliga a escribir la intención en Vercel, se ve en la tienda y en el panel, y el build falla si se queda puesto con la clave real.
- **Las pruebas desde fuera son de solo lectura** y con lo que tiene cualquier visitante (la clave pública). No se llama a funciones que escriben (altas del Club, contadores de visitas) contra producción «para probar».
- **Nunca se piden ni se escriben claves en el chat ni en el repositorio**, tampoco las de pruebas del banco: se dice el nombre de la variable y dónde ponerla.
- **Apuntar el riesgo aceptado con su dueño.** Si el titular pide algo con riesgo, se hace con la mitigación que quepa y la decisión dice qué riesgo queda y cómo se sale.

## 5. Verificar e informar

- **`pnpm check` siempre** tras cambios funcionales (lint, tipos, unitarias y build). E2E si cambian rutas o navegación; pgTAP si hay migraciones. Si algo no se pudo pasar (sin Docker, sin base local), se dice tal cual: «no ejecutado, la CI lo repite».
- **Lo que no se ha verificado no está hecho.** El informe separa «comprobado» de «sin comprobar» y de «pendiente del titular».
- **Documentar en la misma entrega:** DECISIONS (el porqué y lo descartado), STATUS (qué se hizo y con qué resultado) y ROADMAP (qué cambia en el orden). Las propuestas sin autorizar van en su propio documento con códigos, no mezcladas con lo hecho.
- **No desplegar ni abrir una PR sin que se pida.** Tocar variables de Production en Vercel es desplegar: se prepara, se explica el orden (primero el código, luego las variables) y lo hace el titular o se le pide permiso.
- **Informe final en español, corto:** qué se hizo, comprobaciones con su resultado, decisiones, límites y siguiente paso.

## 6. Errores que ya hemos cometido

| Fecha | Qué pasó                                                                                                  | Qué hacemos ahora                                                                     |
| ----- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 13/11 | Una cifra de control escrita de memoria en una carga de costes.                                           | Las cifras de control las calcula el script que genera los datos (§2).                |
| 13/11 | El borrado de la tabla de trabajo pidió confirmación al titular y caducó; los costes quedaron sin cargar. | Separar lo que pide confirmación de lo que no, y dejar lo destructivo para el final.  |
| 13/11 | El recuento dejó a cero los tres destacados de la portada.                                                | Tras un cambio de datos, mirar qué enseña la portada, no solo si la cifra cuadra.     |
| 11/11 | Un publicado sin foto en la base (Miss Sakura) enseñaba la imagen de reserva; el banco lo vio.            | Antes de enseñar la web a un tercero, contar publicados sin imagen y sin existencias. |
| 25/10 | Una Preview conectada a la base real para probar el TPV.                                                  | El build lo impide (#48); las excepciones, con interruptor explícito (§193).          |
