import { expect, test } from '@playwright/test';
import {
  AUDIT_WIDTHS,
  auditRoute,
  axeBaseline,
  formatFindings,
} from '../support/layout-audit';
import { admin, login, user } from './support';

/*
 * Red de seguridad del sistema de diseño (DS-01) en el panel: todas sus
 * pantallas con sesión de administrador del sistema y MFA, a 390, 768, 1280
 * y 1440 px. Desde DS-11 exige además controles de 44 px de alto
 * (criterio 8) y ninguna infracción de axe (criterio 6).
 */

const ROUTES = [
  '/admin',
  '/admin/mostrador',
  '/admin/catalogo',
  '/admin/catalogo/nuevo',
  '/admin/catalogo/etiquetas',
  '/admin/catalogo/importar',
  '/admin/catalogo/precios',
  '/admin/inventario',
  '/admin/movimientos',
  '/admin/reposicion',
  '/admin/compras',
  '/admin/compras/proveedores',
  '/admin/informes',
  '/admin/informes/inventario',
  '/admin/informes/rotacion',
  '/admin/informes/margenes',
  '/admin/informes/compras',
  '/admin/informes/auditoria',
  '/admin/contenido',
  '/admin/suscriptores',
  '/admin/configuracion',
  '/admin/equipo',
  '/admin/asistente',
  '/admin/diseno',
  '/admin/control',
  '/admin/control/negocio',
  '/admin/control/costes',
  '/admin/control/costes/nuevo',
  '/admin/control/tareas',
  '/admin/control/tareas/nueva',
  '/admin/control/entregas',
  '/admin/control/entregas/nueva',
];

test('panel: diseño sin solapes ni desbordes en todas sus pantallas', async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  await login(page, await user('system_admin'));

  const { data: product } = await admin
    .from('products')
    .select('id')
    .limit(1)
    .maybeSingle();
  const routes = [
    ...ROUTES,
    ...(product ? [`/admin/catalogo/${product.id}`] : []),
  ];

  const reports: string[] = [];
  const violations: string[] = [];
  for (const path of routes) {
    const name = `panel${path.replace(/^\/admin/, '').replace(/\//g, '-') || '-inicio'}`;
    await test.step(path, async () => {
      const results = await auditRoute(page, path, name, AUDIT_WIDTHS, 200, {
        minTarget: 44,
      });
      const report = formatFindings(name, results);
      if (report) reports.push(report);
      const axe = await axeBaseline(page, path, name);
      violations.push(
        ...axe.violations.map(
          (v) => `${path}: ${v.id} (${v.impact}, ${v.nodes}) ${v.help}`,
        ),
      );
    });
  }
  expect(reports.join('\n'), reports.join('\n')).toBe('');
  expect(violations, violations.join('\n')).toEqual([]);
});
