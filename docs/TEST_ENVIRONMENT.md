# Entorno de pruebas independiente

Decisión del 28/10/2026: catálogo real publicado e imágenes públicas, con
operaciones ficticias. La base real sigue siendo atelier-dev
(xgpsislololgbakzcmad). El destino elegido por el usuario es un proyecto distinto, atelier-test,
en la organización del usuario y región UE. Revisar el coste antes de crearlo.

## Qué prepara esta PR

scripts/preview-catalog.ts exporta por GET seis tablas públicas, con columnas
explícitas y clave publicable/anon. Nunca necesita una clave privilegiada del
origen. Descarga las imágenes de su bucket público product-media, verifica su
hash al importar y las copia al Storage del proyecto de pruebas.

La importación admite únicamente la conexión directa PostgreSQL del proyecto
declarado en ATELIER_PREVIEW_SUPABASE_REF, rechaza la referencia real, exige TLS
verificado y una base sin catálogo, pedidos ni cuentas. Inserta el catálogo en
una transacción con triggers y restricciones activos y comprueba recuentos.
Sin --apply ejecuta el ensayo y revierte; no sube imágenes. Las secuencias
internas pueden avanzar aunque PostgreSQL revierta las filas.

Se conservan marcas, productos publicados, formatos activos, PVP, traducciones,
perfiles olfativos y procedencia pública de las imágenes. Se registra la fuente
de la captura sin leer product_sources, que tiene información restringida.

No se copian cuentas, clientes, pedidos, stock, costes, proveedores, promociones,
colas, mensajes, historial de precios ni configuración del negocio. Los precios
tachados se dejan vacíos: la regla Ómnibus exige un historial que no se exporta.
Los PVP actuales sí se conservan. Las operaciones ficticias se crean después
en el panel de pruebas. No es una restauración íntegra ni una réplica continua.

## 1. Crear y preparar el destino

1. Crear atelier-test en la cuenta del usuario, con PostgreSQL 17, región UE
   y coste revisado. Guardar su referencia; nunca reutilizar la real.
2. Aplicar todas las migraciones de supabase/migrations sobre ese proyecto
   nuevo. El repositorio tiene 36 migraciones hasta 20261025120000.
   Usar Supabase CLI autenticado, con credenciales exclusivas del destino:

   ```sh
   pnpm exec supabase link --project-ref <REFERENCIA_DE_PRUEBAS>
   pnpm exec supabase db push --linked --dry-run
   pnpm exec supabase db push --linked
   ```

   Antes de db push, comprobar que supabase/.temp/project-ref coincide con el
   destino. El guard del importador no protege comandos de CLI ejecutados fuera
   de él. No ejecutar db reset contra un proyecto remoto. No cargar
   supabase/data: contiene datos de negocio y enlaces a producción.

3. Comparar la lista de migraciones con el origen mediante lectura autorizada.
   Las migraciones reproducen el esquema versionado; no acreditan cambios
   manuales remotos. En §176 de DECISIONS constan diferencias históricas de RLS
   en internal: comprobarlas antes de afirmar paridad exacta.
4. Las migraciones crean product-media. No copiar Auth ni configurar SMTP,
   webhooks, crons, pagos live o Sendcloud reales. Configurar las plantillas de
   supabase/templates y las URLs de Auth para las previews aprobadas.

Las credenciales se introducen en los ajustes seguros del entorno o en un
archivo local ignorado. No pegarlas en la conversación, en comandos de shell
que queden en historial ni en la PR.

## 2. Capturar el catálogo y las imágenes

Preparar un archivo ignorado .env.catalog-export.local con
SOURCE_SUPABASE_PUBLISHABLE_KEY: la clave pública del origen, nunca service_role.
La herramienta fija la URL del origen y solo efectúa lecturas. La captura no es
una instantánea transaccional entre tablas: realizarla sin ediciones simultáneas
del catálogo y revisar los recuentos.

```sh
mkdir -p output
node --env-file=.env.catalog-export.local scripts/preview-catalog.ts export output/catalogo-pruebas
```

El directorio debe ser nuevo. catalog.json solo se escribe tras una exportación
completa; si falla una descarga, conservar o retirar manualmente la carpeta
incompleta y repetir con otra. No subir output ni las capturas a Git.

Se admiten imágenes de product-media en el origen y rutas /media/ del mismo
checkout. Las rutas locales conservan sus archivos versionados; las remotas
se descargan sin redirecciones, con límite de 8 MiB y tipos JPEG, PNG, WebP o AVIF.
Otras fuentes requieren revisión explícita; no se descargan URLs arbitrarias.
Si faltan relaciones o un producto publicado carece de formato con PVP, se
rechaza la captura.

## 3. Ensayar e importar

Se necesita psql disponible, conectividad directa al host de PostgreSQL y su
certificado verificable. Configurar PGSSLROOTCERT con el certificado CA oficial
de Supabase cuando lo requiera la instalación. No desactivar verificación TLS.
La conexión directa puede necesitar IPv6 o la opción IPv4 del proveedor.
Los poolers no están admitidos por este importador.

En .env.catalog-import.local, ignorado:

- ATELIER_PREVIEW_SUPABASE_REF: referencia del proyecto nuevo.
- PREVIEW_DATABASE_URL: URI de conexión directa del destino, usuario postgres,
  base postgres, puerto 5432, sin parámetros ni fragmentos; contraseña codificada
  como URI. Nunca la conexión real.
- PREVIEW_SUPABASE_SECRET_KEY: clave privilegiada exclusiva del destino para
  subir las imágenes. No es necesaria para el simulacro.

```sh
node --env-file=.env.catalog-import.local scripts/preview-catalog.ts import output/catalogo-pruebas
node --env-file=.env.catalog-import.local scripts/preview-catalog.ts import output/catalogo-pruebas --apply
```

El ensayo debe pasar primero. --apply repite el ensayo, sube imágenes bajo
preview-catalog/<sha256> y confirma el catálogo dentro de una transacción.
Se ejecuta antes de crear cuentas. No admite refrescar una base que ya tenga
catálogo; para otra captura, usar un nuevo proyecto vacío o planificar su
reconstrucción separadamente.

Storage y PostgreSQL no comparten transacción. Si falla la carga final, el
catálogo revierte pero pueden quedar imágenes sin referencias en ese prefijo
del destino. Repetir con la misma captura y destino vacío reutiliza sus nombres
por hash. No borrar imágenes ni resetear el proyecto automáticamente.

## 4. Conectar exclusivamente los despliegues de pruebas

En Vercel atelier-web, configurar solo el destino **Preview**:

| Variable                             | Valor                                                            |
| ------------------------------------ | ---------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL             | URL del proyecto de pruebas                                      |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Clave pública del proyecto de pruebas                            |
| ATELIER_PREVIEW_SUPABASE_REF         | Referencia del proyecto de pruebas                               |
| SUPABASE_SECRET_KEY                  | Clave exclusiva del destino, solo si los recorridos la necesitan |
| NEXT_PUBLIC_SITE_URL                 | Origen de la preview de pruebas                                  |

Si una variable actual se comparte entre Production y Preview, conservar su
valor en Production y crear la asignación distinta para Preview. Revisar también
las excepciones por rama. No copiar las variables operativas de Production.

Mantener fuera de Preview RESEND_API_KEY, SENDER_API_TOKEN, CRON_SECRET,
SUPABASE_BACKUPS_TOKEN y SENDCLOUD_*. El build las rechaza. Dejar
ANTHROPIC_API_KEY sin configurar salvo pruebas explícitas del asistente.
Mantener SEO_INDEXING apagado y WEB_CHECKOUT, CUSTOMER_ACCOUNTS y CONTACT_FORM
apagados inicialmente; activarlos solo para los recorridos que se vayan a probar.
El TPV, si se configura, debe ser Redsys test, con sus claves de pruebas.

Crear cuentas de pruebas independientes desde Supabase Auth y conceder solo
los permisos necesarios; configurar MFA como en el panel real. No copiar
contraseñas, tokens ni sesiones. Crear stock y operaciones ficticias desde el
panel; nunca cargar los archivos de compras reales de supabase/data.
Ver supabase/README.md para las concesiones de personal y control_owners.

Usar una preview estable protegida para trabajo compartido. Varias previews
conectadas al mismo proyecto comparten sus cambios; para PR con migraciones
incompatibles, usar otro proyecto o branch aislado. No ejecutar migraciones
remotas automáticamente desde builds de PR.

Crear el despliegue de la rama solo después de revisar estas asignaciones.
Los despliegues antiguos conservan su configuración: retirarlos o reconstruirlos
y comprobar que ya no escriben en la base real. No revocar credenciales compartidas
con Production como atajo.

## 5. Criterios de aceptación y evidencia

- Migraciones del destino contrastadas; pgTAP, tipos y lint de base correctos.
- Catálogo y recuentos comprobados; imágenes remotas servidas desde el Storage
  de pruebas. Registro del proyecto y commit, sin claves.
- /api/health responde ok y ?check=readiness responde ready en la preview.
- Login/MFA y permisos del panel; editar un producto, stock y pedido ficticio
  cambia solo el destino. Sin correos, cobros, etiquetas o crons reales.
- Probar es/ca/en y diseño móvil/escritorio. Los cambios de código van por PR;
  fusionar código no promueve datos de pruebas.
- Comprobar con lecturas autorizadas antes/después que no se modificó la base
  real y que las previews antiguas quedaron aisladas.

Validación del código de esta entrega y bloqueos: STATUS.md. El workflow db.yml
incluye check-preview-catalog.ts: carga sintética sobre Supabase local, verifica
publicación, PVP, procedencia y visibilidad anon con RLS, y revierte. No prueba
la provisión remota, la conectividad PostgreSQL ni las claves de Storage.
