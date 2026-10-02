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
 * y 1440 px. axe guarda su línea base sin hacer fallar la prueba.
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
  '/admin/configuracion',
  '/admin/equipo',
  '/admin/asistente',
  '/admin/diseno',
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
  let violations = 0;
  for (const path of routes) {
    const name = `panel${path.replace(/^\/admin/, '').replace(/\//g, '-') || '-inicio'}`;
    await test.step(path, async () => {
      const results = await auditRoute(page, path, name, AUDIT_WIDTHS);
      const report = formatFindings(name, results);
      if (report) reports.push(report);
      violations += (await axeBaseline(page, path, name)).violations.length;
    });
  }
  test.info().annotations.push({
    type: 'axe',
    description: `${violations} reglas incumplidas en ${routes.length} pantallas`,
  });
  expect(reports.join('\n'), reports.join('\n')).toBe('');
});
