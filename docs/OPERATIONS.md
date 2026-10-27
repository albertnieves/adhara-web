# Entornos y operación

Actualizado el 25/10/2026. Objetivo activo: separar pruebas y datos reales y vigilar la apertura de la venta online. El estado de entregas vive en [STATUS.md](STATUS.md), los pasos del banco y negocio en [PLAN_APERTURA.md](PLAN_APERTURA.md) y el orden posterior en [ROADMAP.md](ROADMAP.md).

## Entornos comprobados

| Uso                    | Recurso                                            | Estado el 25/10                                                                                                     |
| ---------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Código                 | `albertnieves/adhara-web`                          | `main`, con la #47 (26/10) y esta protección, #48, y la #49 (27/10) fusionadas                                      |
| Web                    | Vercel `atelier-web`                               | Dominio `latelierdudesert.com`; equipo `latelierdudesert`                                                           |
| Datos reales           | Supabase `atelier-dev`, ref `xgpsislololgbakzcmad` | Único proyecto remoto; `ACTIVE_HEALTHY`; PostgreSQL 17                                                              |
| Pruebas                | Supabase local en CI                               | Efímero, con datos de prueba; no usa las claves de la tienda                                                        |
| Preview remota aislada | Por configurar                                     | Las variables públicas actuales se comparten con Production; las previews antiguas siguen conectadas a datos reales |

**El nombre `atelier-dev` no significa que sea una base de pruebas.** No se renombra ni se mueve en esta entrega: contiene la operación real y se conserva su referencia. No crear un `atelier-prod` vacío y cambiar la web hacia él. Un traslado posterior requiere copiar y contrastar datos y Storage, configurar Auth, probar, planificar el corte y dejar recuperación.

## Protección incluida en esta rama

`pnpm build` ejecuta primero `pnpm ops:environment`. En Vercel:

- Production exige las variables públicas de la base real registrada y rechaza Redsys `test`.
- Preview rechaza esa base real y exige que la URL de pruebas coincida con `ATELIER_PREVIEW_SUPABASE_REF`, una referencia distinta. Rechaza URLs con credenciales, rutas, parámetros o hosts ambiguos.
- Una Preview puede estar desconectada, sin ambas variables públicas ni clave privilegiada. Muestra catálogo vacío y panel cerrado; no sirve para validar pedidos.
- Preview solo acepta Redsys `test` y bloquea credenciales de envío de Resend/Sender, crons y copias. El correo se valida en local con el proveedor simulado hasta disponer de un modo de destinatarios restringidos.
- Desarrollo y CI locales mantienen su Supabase efímero. `.env.example` ya no propone conectarse a los datos reales.

**La protección afecta a los nuevos builds de esta rama y de las ramas que la incorporen. No desconecta despliegues anteriores ni revoca sus claves.** Con las variables compartidas actuales, la Preview de esta PR se rechazará deliberadamente antes de generar la aplicación. La CI local puede pasar igualmente. No marcar el aislamiento remoto como terminado por tener esta comprobación.

## Completar el aislamiento remoto

1. Terminar y registrar la prueba pendiente de Bizum de la #47 antes de retirar el acceso del entorno de pruebas antiguo. No introducir un bypass para esa rama en el nuevo comprobador.
2. En Vercel, conservar en **Production** las dos variables públicas actuales y sus secretos. Quitar el destino Preview de las variables compartidas, sin borrar el destino Production. Retirar las variables de pago de las ramas de pruebas terminadas y revocar su clave privilegiada temporal.
3. Para previews visuales, no configurar Supabase. Para pruebas completas remotas, preparar una base aislada en la cuenta del negocio, con región UE, migraciones versionadas y datos ficticios. No copiar clientes, costes reales, contactos ni pedidos de producción. Elegir proyecto o branch de Supabase con su coste revisado antes de provisionarlo.
4. Solo en **Preview**, configurar la URL, la clave publicable y `ATELIER_PREVIEW_SUPABASE_REF` de esa base. Si la prueba necesita checkout, usar una clave privilegiada exclusiva de esa base y el TPV `test`. No compartir secretos de Production.
5. Redesplegar la rama y comprobar `pnpm ops:health <origen-preview>`, acceso/MFA, stock ficticio, pago de prueba, reservas y devoluciones. Consultar la base real antes y después: ningún movimiento ni correo de esa prueba debe aparecer en ella.
6. Comprobar las URLs antiguas tras revocar su acceso. Un cambio de variables solo afecta a nuevos despliegues; retirar los despliegues de prueba antiguos desde Vercel cuando ya no sean necesarios. No cerrar el objetivo hasta verificarlo.

No se han creado recursos de pago, cambiado variables remotas ni revocado claves con esta PR. La #47 se fusionó el 26/10; esta PR, actualizada con `main` y con su CI repetida, el 27/10.

## Disponibilidad

| Sonda                         | Resultado                       | Qué acredita                                                                             |
| ----------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------- |
| `/api/health`                 | 200, `status: ok`               | El proceso de Next responde; conserva el contrato anterior                               |
| `/api/health?check=readiness` | 200 `ready` o 503 `unavailable` | Una lectura anónima mínima de `products.id` bajo RLS responde en un máximo de 3 segundos |

Ambas son dinámicas y sin caché. Readiness no usa la clave privilegiada ni publica filas, errores internos, proyecto o claves. No acredita el TPV, el envío de correo, la frescura del catálogo ni la autorización del panel. Antes de publicar esta rama, Production conserva la sonda antigua: pedir `?check=readiness` devuelve `ok`, por lo que el nuevo monitor debe fallar. Eso indica un contrato aún no publicado, no una caída comprobada de Supabase.

```sh
pnpm ops:environment
pnpm ops:health https://latelierdudesert.com
# Tras pnpm build y pnpm start, también sin variables (readiness dará ERROR):
pnpm ops:health http://127.0.0.1:3000
```

La sonda externa no sigue redirecciones, caduca a los 10 segundos y falla si el HTTP o el JSON no tienen el contrato esperado. No imprime los cuerpos de respuesta. `monitor.yml` la ejecutará en GitHub Actions todos los días a las 06:17 UTC y por petición manual **cuando este workflow llegue a `main`**. El horario de Actions es UTC, no el de las revisiones de Codex. No necesita tokens ni instalar dependencias. Los avisos de fallo dependen de las notificaciones de Actions del usuario; aún no hay un servicio de guardia continuo.

## Revisiones diarias de Codex

Dos automatizaciones creadas el 25/10, activas desde el 26/10 en Europe/Madrid. Son ventanas flexibles de mañana, alrededor de las 08:00 y 08:30; pueden coincidir. Cada una entrega su informe al usuario en esta conversación:

1. **Revisión técnica de Atelier:** GitHub y CI, despliegues y errores de Vercel, salud/asesores/migraciones de Supabase, colas y copias mediante agregados. Inspección de variables por nombre, destino y rama, sin descifrar. Marcar lo inaccesible como no verificado.
2. **Revisión del proyecto Atelier:** PR, bloqueos, documentación frente al código y siguiente tarea con criterios de aceptación. Una rama terminada no equivale a código fusionado o desplegado.

Son revisiones de lectura: no fusionan, despliegan, cambian datos, reenvían pagos/correos ni escriben comentarios o mensajes a terceros. No necesitan que el Mac esté encendido. Las conexiones deben seguir autorizadas; una ejecución que falle debe señalarlo en el informe.

## Señales que revisar

| Señal                         | Umbral inicial                                        | Respuesta                                                                                                   |
| ----------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Readiness                     | 503 o timeout                                         | Repetir una vez y revisar Vercel y Supabase; no aplicar migraciones por intuición                           |
| Reservas vencidas aún activas | Más de 10 minutos desde caducidad                     | Revisar el cron de reservas y su autorización                                                               |
| Correos pendientes            | Antigüedad mayor de 15 minutos                        | Revisar cron, proveedor y bloqueos; no reenviar a ciegas                                                    |
| Devoluciones abiertas         | `unknown` o `requested` de más de 10 minutos          | Personal autorizado comprueba el portal de Redsys antes de resolver o reintentar                            |
| Copia programada              | Ninguna correcta en 36 horas o último intento fallido | Revisar cron y Storage; una copia no acredita recuperación hasta restaurarla                                |
| Asesores de Supabase          | Tipo nuevo o permiso ampliado                         | Contrastar con SQL y pgTAP; no cambiar a ciegas las funciones SECURITY DEFINER que comprueban permiso y MFA |

Base de comparación del 25/10, consulta de lectura: 35 migraciones hasta `20261024120000`; asesores de seguridad con 20 resultados INFO `rls_enabled_no_policy`, 3 WARN `anon_security_definer_function_executable` y 87 WARN `authenticated_security_definer_function_executable`. Son observaciones para contrastar, no una declaración de ausencia de riesgos. Vercel no devolvió grupos de errores/fatales de Production en la ventana consultada de 24 horas (sujeto a retención). Copias programadas: dos correctas, última el 25/10 03:30 UTC. Un correo de pedido enviado, ninguno pendiente; cola de mensajes vacía; una devolución de prueba correcta. No se ha ensayado una restauración en esta sesión.

## Publicar y recuperar

1. Leer los tres documentos vigentes y comprobar el commit exacto y la base de la PR. Para esta entrega: #47 antes, después esta PR.
2. `pnpm check`, formato, secretos y E2E. Si cambia SQL: también pgTAP, tipos y concurrencia. No usar la base real para fixtures o resets.
3. Comprobar el entorno aislado y sus pruebas. Mantener `WEB_CHECKOUT` apagado hasta completar el plan del banco y negocio.
4. Cuando se autorice la publicación, comprobar el despliegue Production y ambas sondas. La compra real de poco importe y su devolución del plan de apertura las realiza el titular.
5. Ante fallo, guardar commit y evidencia sin secretos. Recuperar el despliegue anterior desde Vercel tras comprobar compatibilidad de migraciones; no deshacer SQL destructivamente. Un rollback de código no restaura la base. Mantener atendidos los pedidos ya pagados.
6. Para detener nuevas ventas, retirar `WEB_CHECKOUT` y redesplegar: la variable se lee en el build y no es un interruptor instantáneo.

## Siguiente criterio de cierre

Entornos y operación se cierran cuando una Preview completa escribe solo en su base ficticia, las URLs de pruebas antiguas ya no operan sobre datos reales, Availability pasa en `main` y se registra una restauración de prueba en un entorno aislado. Después: SEO base, búsqueda/filtros móviles, Scent Journey y 3D selectivo. La integración de Sentry y los presupuestos de Lighthouse quedan para entregas específicas; no se han instalado en esta PR.

Fuentes: [entornos de Vercel](https://vercel.com/docs/deployments/environments), [variables por destino](https://vercel.com/docs/environment-variables), [entornos de Supabase](https://supabase.com/docs/guides/deployment/managing-environments), [plazo de una consulta](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal).
