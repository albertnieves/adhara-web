-- Carga inicial del control (/admin/control), 10/10/2026.
-- Procedencia: docs/STATUS.md («Pendiente del usuario» y el historial de
-- entregas) y las PR de github.com/albertnieves/adhara-web. Sin importes ni
-- estado de facturación: no constan en ningún documento y se completan desde
-- el panel. Sin costes: ninguno tiene importe documentado. Los responsables
-- son una propuesta editable: «client» cuando el dato o la gestión dependen
-- del negocio (banco, asesoría, cuentas del personal de la tienda).
-- Idempotente: cada fila se inserta solo si no existe otra con el mismo título.

insert into internal.control_tasks (title, area, status, priority, owner, notes)
select v.title, v.area, 'pending', v.priority, v.owner, v.notes
from (values
  ('Aplicar en adhara-dev las migraciones del catálogo olfativo y la suscripción',
   'project', 'high', 'me',
   'Migraciones 20261009150000 y 20261009150100 y la carga 20261009_perfiles_olfativos.sql, con autorización.'),
  ('Aplicar en adhara-dev la migración del control del negocio',
   'project', 'high', 'me',
   'Migración 20261010120000_business_control.sql: permiso, precio cobrado en el mostrador y tablas del control.'),
  ('Crear el token de API de Sender y el grupo «Web» y configurarlos en Vercel',
   'project', 'normal', 'me',
   'SENDER_API_TOKEN y SENDER_GROUP_ID, solo servidor. Activar en Sender la doble confirmación o un correo de bienvenida.'),
  ('Configurar en Vercel las claves del asistente',
   'project', 'normal', 'me',
   'ANTHROPIC_API_KEY, CRON_SECRET y SUPABASE_SECRET_KEY, solo servidor, en Production y Preview. Nunca por chat.'),
  ('Proteger main en GitHub',
   'project', 'normal', 'me',
   'PR obligatoria y CI, Database y E2E en verde.'),
  ('Importar el CSV del catálogo desde Panel → Catálogo → Importar',
   'project', 'normal', 'me',
   'Indicar si los precios del PDF llevan IVA. Revisar después las marcas «por revisar», los 6 perfumes sin marca y las fotos.'),
  ('Revisión visual de la Fase 2 en la Preview',
   'project', 'normal', 'me',
   '/admin/diseno, tonos de colección y capturas del artefacto auditoria-visual; se aprueba por escrito en la PR de cierre.'),
  ('Decidir cuándo abrir la web al cliente',
   'project', 'normal', 'me',
   'Con Vercel Authentication solo entra quien tiene cuenta en el equipo de Vercel.'),
  ('Configurar la verificación en dos pasos del administrador de la tienda',
   'business', 'high', 'client', 'La pide el primer acceso al panel.'),
  ('Pedir al banco el TPV virtual (Redsys) para cobrar con tarjeta en la web',
   'business', 'high', 'client',
   'FUC, terminal, claves de firma de pruebas y real (en Vercel, nunca por chat), integración por redirección con EMV 3DS y acceso al portal de Redsys.'),
  ('Decidir recogida en tienda o envíos, pagos sin stock y quién emite las facturas',
   'business', 'normal', 'client',
   'Zonas, tarifas, envío gratis y transportista si hay envíos; devolución automática o manual si llega un pago sin stock.'),
  ('Datos legales para vender online',
   'business', 'high', 'client',
   'Titular, NIF, domicilio, teléfono, email y datos registrales; con ellos, aviso legal, privacidad, cookies, condiciones de venta y devoluciones, a revisar por la asesoría.'),
  ('Correo transaccional para pedidos y avisos',
   'project', 'normal', 'me',
   'Recomendado Resend; acceso al DNS del dominio para SPF y DKIM y el remitente.'),
  ('Dar de alta los proveedores reales',
   'business', 'normal', 'client', 'Compras → Proveedores, para que Reposición proponga cantidades.'),
  ('Preparar producción',
   'project', 'normal', 'me',
   'Dominio con acceso a su DNS, plan Pro de Vercel, proyecto adhara-prod en Supabase con copias diarias y derechos de las fotos.')
) as v(title, area, priority, owner, notes)
where not exists (select 1 from internal.control_tasks t where t.title = v.title);

insert into internal.control_deliveries (title, status, due_on, delivered_on, reference, description)
select v.title, v.status, v.due_on::date, v.delivered_on::date, v.reference, v.description
from (values
  ('Tienda física, reposición e informes (fases R y S)', 'delivered', null, '2026-10-01',
   'https://github.com/albertnieves/adhara-web/pull/9',
   'Mostrador, reposición, compras, proveedores e informes de existencias, rotación, márgenes, compras y auditoría.'),
  ('Acceso, edición y control de versiones del panel', 'delivered', null, '2026-10-01',
   'https://github.com/albertnieves/adhara-web/pull/10',
   'Portada y configuración, invitación y recuperación, MFA en escrituras, revisiones de precios e idempotencia de stock.'),
  ('Panel más cómodo y asistente de inventario', 'delivered', null, '2026-10-02',
   'https://github.com/albertnieves/adhara-web/pull/11',
   'Informe diario y chat de solo lectura con los datos del panel.'),
  ('Cierre de la Fase 1', 'delivered', null, '2026-10-02',
   'https://github.com/albertnieves/adhara-web/pull/12',
   'CI en tres workflows, garantías de seguridad probadas y documentación de la fase.'),
  ('Fase 2: sistema de diseño', 'delivered', null, '2026-10-04',
   'https://github.com/albertnieves/adhara-web/pull/27',
   'DS-01 a DS-12. Falta la revisión visual del cliente.'),
  ('Catálogo olfativo y suscripción a promociones', 'delivered', null, '2026-10-09',
   'https://github.com/albertnieves/adhara-web/pull/29',
   'Pendiente de aplicar sus migraciones en adhara-dev.'),
  ('Control del negocio y del proyecto', 'in_progress', null, null, null,
   'Panel /admin/control: ventas, costes, beneficio, tareas y entregas; precio cobrado en el mostrador.'),
  ('Checkout con pago con tarjeta', 'planned', null, null, null,
   'Espera los datos del TPV virtual del banco.')
) as v(title, status, due_on, delivered_on, reference, description)
where not exists (select 1 from internal.control_deliveries d where d.title = v.title);
