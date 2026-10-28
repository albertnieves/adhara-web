# Contexto de trabajo — L’Atelier du Désert

Revisado el 28/10/2026 sobre main, commit 69142fe. Este documento conserva el
contexto para futuras tareas; los resultados y pendientes viven en STATUS.md.
Comprobar siempre Git y los servicios antes de asumir que una rama está publicada.

## Producto y estructura

Ecommerce de perfumería árabe, con tienda pública es/ca/en y panel privado para
catálogo, precios, inventario, compras, equipo, pedidos, devoluciones y envíos.
El repositorio conserva el nombre adhara-web; la marca es L’Atelier du Désert.

- Next.js App Router, React, TypeScript estricto, Tailwind y next-intl.
- app compone rutas; modules contiene los dominios; lib/supabase crea los
  clientes anónimo, de sesión y los accesos privilegiados específicos.
- Supabase aporta PostgreSQL 17, Auth con MFA y Storage. public usa RLS;
  internal guarda costes y proveedores; private contiene funciones auxiliares.
- Importes en céntimos, precios y stock calculados en servidor. Las funciones
  del panel exigen permiso y MFA; ocultar la interfaz no sustituye autorización.
- Redsys procesa pagos; Resend/Sender envían correo; Sendcloud compra etiquetas;
  Anthropic sirve al asistente. Las pruebas deben aislar también estas salidas.
- Node 24.16.0 y pnpm 11.19.0; versiones exactas y lockfile. pnpm check reúne
  lint, tipos, unitarias y build. Playwright prueba navegador; Supabase local
  permite pgTAP, concurrencia y recorridos autenticados.

## Entornos

| Recurso                                    | Función                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| albertnieves/adhara-web                    | Código; las PR nuevas parten del main vigente               |
| Vercel atelier-web                         | Aplicación, con Production y Preview separados              |
| latelierdudesert.com                       | Dominio público                                             |
| Supabase atelier-dev, xgpsislololgbakzcmad | **Base real**, pese al nombre dev                           |
| Supabase local                             | Base efímera de desarrollo y CI                             |
| atelier-test (nombre elegido)              | Proyecto independiente pendiente de provisionar y comprobar |

Las PR #47, #48, #49, #50 y #51 ya aparecen fusionadas en el historial de main
consultado. Las notas antiguas que las describen como abiertas son históricas.
No se ha comprobado en esta sesión la configuración vigente de Vercel ni la
paridad del esquema remoto: el último inventario y sus diferencias están en
OPERATIONS.md y DECISIONS.md, especialmente §176.

## Decisión del usuario para pruebas

Usar **catálogo real publicado e imágenes públicas; operaciones ficticias**.
Replicar estructura con las migraciones, copiar el catálogo por lectura anónima
y copiar imágenes a Storage independiente. No copiar cuentas, contraseñas,
sesiones, MFA, clientes, pedidos, mensajes, proveedores, costes, inventario,
historiales, colas ni credenciales reales. El catálogo en borrador no es público
y queda fuera de esta copia.

La guía ejecutable es [TEST_ENVIRONMENT.md](TEST_ENVIRONMENT.md). Las claves de
producción nunca se asignan a Preview. La promoción de código a main no copia
datos ni cambios de esquema de pruebas a producción automáticamente.

## Continuar una tarea

Leer AGENTS.md, este documento, la cabecera vigente de STATUS.md y la guía
del dominio afectado. Trabajar en una rama codex/, validar y abrir PR; no fusionar
ni desplegar a producción por defecto. Registrar resultados realmente ejecutados
y separar preparación de código, provisión remota y validación del despliegue.
