import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import {
  AUDIT_WIDTHS,
  DESKTOP_WIDTHS,
  auditRoute,
  axeBaseline,
  formatFindings,
} from '../support/layout-audit';
import { admin, login, makeControlOwner, psql, user } from './support';

/*
 * Red de seguridad del sistema de diseño (DS-01) en el panel: todas sus
 * pantallas con sesión de administrador del sistema y MFA, a 390, 768, 1280
 * y 1440 px. Desde DS-11 exige además controles de 44 px de alto
 * (criterio 8) y ninguna infracción de axe (criterio 6). La consola del
 * titular (/admin/control) es solo para escritorio: sus pantallas se auditan
 * a 1280 y 1440 px, y el aviso que la sustituye por debajo, a 390 y 768.
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
  '/admin/pedidos',
  '/admin/informes',
  '/admin/informes/inventario',
  '/admin/informes/rotacion',
  '/admin/informes/margenes',
  '/admin/informes/compras',
  '/admin/informes/auditoria',
  '/admin/contenido',
  '/admin/suscriptores',
  '/admin/descuentos',
  '/admin/descuentos/nuevo',
  '/admin/configuracion',
  '/admin/equipo',
  '/admin/asistente',
  '/admin/diseno',
];

const CONSOLE_ROUTES = [
  '/admin/control',
  '/admin/control/negocio',
  '/admin/control/productos',
  '/admin/control/atencion',
  '/admin/control/costes',
  '/admin/control/costes/nuevo',
  '/admin/control/tareas',
  '/admin/control/tareas/nueva',
  '/admin/control/entregas',
  '/admin/control/entregas/nueva',
  '/admin/control/sistema',
  '/admin/control/copias',
  '/admin/control/asistente',
  '/admin/control/calidad',
];

/** Un producto cualquiera para auditar las fichas (rutas dinámicas). */
async function anyProductId() {
  const { data: product } = await admin
    .from('products')
    .select('id')
    .limit(1)
    .maybeSingle();
  return product ? String(product.id) : undefined;
}

/**
 * Un pedido web ya cobrado, si hay (los crea admin-orders.spec.ts, que corre
 * antes): su ficha enseña pagos, devoluciones y correos.
 */
async function anyOrderId() {
  const { data: order } = await admin
    .from('orders')
    .select('id')
    .neq('status', 'pending_payment')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return order ? String(order.id) : undefined;
}

/** Un código de descuento, si hay (los crea discounts.spec.ts, que corre antes). */
async function anyDiscountCodeId() {
  const { data: code } = await admin
    .from('discount_codes')
    .select('id')
    .limit(1)
    .maybeSingle();
  return code ? String(code.id) : undefined;
}

/**
 * Audita rutas a unas anchuras y devuelve los informes y lo que dice axe.
 * `after` comprueba algo más en la última anchura de cada ruta.
 */
async function auditAll(
  page: Page,
  routes: string[],
  widths: readonly number[],
  { suffix = '', after }: { suffix?: string; after?: () => Promise<void> } = {},
) {
  const reports: string[] = [];
  const violations: string[] = [];
  for (const path of routes) {
    const name = `panel${path.replace(/^\/admin/, '').replace(/\//g, '-') || '-inicio'}${suffix}`;
    await test.step(path, async () => {
      const results = await auditRoute(page, path, name, widths, 200, {
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
      await after?.();
    });
  }
  return { reports, violations };
}

test('panel: diseño sin solapes ni desbordes en todas sus pantallas', async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  // Titular: el pie del menú enseña también el acceso a la consola.
  const email = await user('system_admin');
  makeControlOwner(email);
  await login(page, email);

  const [product, order, discount] = await Promise.all([
    anyProductId(),
    anyOrderId(),
    anyDiscountCodeId(),
  ]);
  const routes = [
    ...ROUTES,
    ...(product ? [`/admin/catalogo/${product}`] : []),
    ...(order ? [`/admin/pedidos/${order}`] : []),
    ...(discount ? [`/admin/descuentos/${discount}`] : []),
  ];
  const { reports, violations } = await auditAll(page, routes, AUDIT_WIDTHS);
  expect(reports.join('\n'), reports.join('\n')).toBe('');
  expect(violations, violations.join('\n')).toEqual([]);
});

/** Formato con el coste centinela de la base de pruebas (9.876,54 € sin IVA). */
const SENTINEL_VARIANT = '00000000-0000-4000-8000-00000000ce03';

test('inicio: «Stock a coste» cabe en su tarjeta con importes de seis cifras', async ({
  page,
}) => {
  test.setTimeout(5 * 60_000);
  await login(page, await user('system_admin'));
  const { data: store, error } = await admin
    .from('stock_locations')
    .select('id')
    .eq('active', true)
    .eq('kind', 'store')
    .order('created_at')
    .limit(1)
    .single();
  if (error) throw error;
  const { data: before } = await admin
    .from('inventory_levels')
    .select('on_hand, reserved')
    .eq('variant_id', SENTINEL_VARIANT)
    .eq('location_id', store.id)
    .maybeSingle();
  const vars = { variant: SENTINEL_VARIANT, location: String(store.id) };
  // 12 unidades libres del centinela: más de 118.000 € a coste. Directo en la
  // base local, sin movimientos, y se deja como estaba al terminar.
  psql(
    `insert into public.inventory_levels (variant_id, location_id, on_hand)
       values (:'variant', :'location', 12)
     on conflict (variant_id, location_id)
       do update set on_hand = 12 + public.inventory_levels.reserved;`,
    vars,
  );
  try {
    const { reports, violations } = await auditAll(
      page,
      ['/admin'],
      AUDIT_WIDTHS,
      {
        suffix: '-stock-a-coste',
        after: async () => {
          await expect(page.getByText(/^\d{3}\.\d{3},\d{2}\s€$/)).toBeVisible();
        },
      },
    );
    expect(reports.join('\n'), reports.join('\n')).toBe('');
    expect(violations, violations.join('\n')).toEqual([]);
  } finally {
    psql(
      before
        ? `update public.inventory_levels
             set on_hand = :'on_hand', reserved = :'reserved'
           where variant_id = :'variant' and location_id = :'location';`
        : `delete from public.inventory_levels
           where variant_id = :'variant' and location_id = :'location';`,
      before
        ? {
            ...vars,
            on_hand: String(before.on_hand),
            reserved: String(before.reserved),
          }
        : vars,
    );
  }
});

test('consola: escritorio sin solapes ni desbordes y aviso por debajo de 1280 px', async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  const email = await user('system_admin');
  makeControlOwner(email);
  await login(page, email);

  const product = await anyProductId();
  const routes = [
    ...CONSOLE_ROUTES,
    ...(product ? [`/admin/control/productos/${product}`] : []),
  ];
  const nav = page.getByRole('navigation', { name: 'Secciones de la consola' });
  const notice = page.getByText(
    'La consola se usa en ordenador, a partir de 1280 px de ancho.',
  );
  const desktop = await auditAll(page, routes, DESKTOP_WIDTHS, {
    after: async () => {
      // A 1440 px (la última anchura): menú a la vista y sin el aviso.
      await expect(nav).toBeVisible();
      await expect(notice).toBeHidden();
    },
  });

  // Por debajo de 1280 px, la misma URL (200, sin redirigir) da el aviso con
  // el enlace al panel de la tienda; el contenido de la consola no se ve.
  const reports = [...desktop.reports];
  const violations = [...desktop.violations];
  for (const width of [390, 768]) {
    const small = await auditAll(page, ['/admin/control'], [width], {
      suffix: `-aviso-${width}`,
      after: async () => {
        await expect(notice).toBeVisible();
        const back = page.getByRole('link', { name: 'Panel de la tienda' });
        await expect(back).toBeVisible();
        await expect(back).toHaveAttribute('href', '/admin');
        const box = await back.boundingBox();
        expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
        await expect(nav).toBeHidden();
      },
    });
    reports.push(...small.reports);
    violations.push(...small.violations);
  }
  expect(reports.join('\n'), reports.join('\n')).toBe('');
  expect(violations, violations.join('\n')).toEqual([]);
});
