import { expect, test } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';
import {
  ALL_DENIED,
  ALL_GRANTED,
} from '../../src/modules/tracking/domain/consent';
import { consentState } from '../support/legal-consent';
import { readQueues, stubTrackers, TRACKING_ON } from '../support/tracking';

/*
 * Cookies de analítica y publicidad (DECISIONS §178) con los IDs de prueba de
 * e2e.yml: nada de Google, Meta ni TikTok se carga antes de aceptar,
 * «Rechazar» está en la primera capa con el mismo aspecto que «Aceptar» y la
 * elección se cambia o se retira desde el pie. Las etiquetas se sirven
 * vacías (stubTrackers): ninguna petición sale a esas empresas.
 */

test.skip(!TRACKING_ON, 'Solo con IDs de analítica y publicidad (e2e.yml)');

const GOOGLE = 'www.googletagmanager.com';
const META = 'connect.facebook.net';
const TIKTOK = 'analytics.tiktok.com';

async function cookie(context: BrowserContext, name: string) {
  return (await context.cookies()).find((item) => item.name === name)?.value;
}

test.describe('visitante nuevo', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('rechazar es tan fácil como aceptar y no carga nada de terceros', async ({
    page,
    context,
  }) => {
    const hosts = await stubTrackers(context);
    await page.goto('/es');
    const dialog = page.getByRole('dialog', { name: 'Antes de empezar' });
    await expect(dialog).toBeVisible();
    const reject = dialog.getByRole('button', { name: 'Rechazar' });
    const accept = dialog.getByRole('button', { name: 'Aceptar todas' });
    await expect(reject).toBeVisible();
    await expect(accept).toBeVisible();
    await expect(
      dialog.getByRole('button', { name: 'Configurar' }),
    ).toBeVisible();
    // Mismo aspecto y tamaño: ninguno se destaca sobre el otro.
    expect(await reject.getAttribute('class')).toBe(
      await accept.getAttribute('class'),
    );
    const [a, b] = [await reject.boundingBox(), await accept.boundingBox()];
    expect(a!.height).toBe(b!.height);
    expect(Math.abs(a!.width - b!.width)).toBeLessThanOrEqual(1);

    // Hay que contestar: Esc no lo cierra.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(hosts).toEqual([]);

    await reject.click();
    await expect(dialog).toBeHidden();
    expect(await cookie(context, 'atelier_cookies')).toMatch(
      /^\d{4}-\d{2}-\d{2}~00~[a-zA-Z0-9.]+~\d+$/,
    );
    expect(await cookie(context, 'atelier_aviso')).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );

    await page.goto('/ca/cataleg');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(hosts).toEqual([]);
    expect(await page.evaluate(readQueues)).toEqual({
      gtag: [],
      fbq: [],
      ttq: [],
    });
  });

  test('aceptar todas carga Google, Meta y TikTok con el consentimiento concedido', async ({
    page,
    context,
  }) => {
    const hosts = await stubTrackers(context);
    await page.goto('/en');
    await page
      .getByRole('dialog', { name: 'Before you start' })
      .getByRole('button', { name: 'Accept all' })
      .click();
    await expect.poll(() => [...hosts].sort()).toEqual([TIKTOK, META, GOOGLE]);
    const queues = await page.evaluate(readQueues);
    // Consent Mode: denegado por defecto y concedido al aceptar.
    expect(queues.gtag.filter((call) => call[0] === 'consent')).toEqual([
      [
        'consent',
        'default',
        {
          ad_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
          analytics_storage: 'denied',
        },
      ],
      [
        'consent',
        'update',
        {
          analytics_storage: 'granted',
          ad_storage: 'granted',
          ad_user_data: 'granted',
          ad_personalization: 'granted',
        },
      ],
    ]);
    expect(
      queues.gtag.filter((call) => call[0] === 'config').map((c) => c[1]),
    ).toEqual(['G-E2ETEST01', 'AW-100000001']);
    expect(queues.fbq.map((call) => call.slice(0, 2))).toEqual([
      ['set', 'autoConfig'],
      ['init', '1000000000000001'],
      ['track', 'PageView'],
    ]);
    expect(queues.ttq.map((call) => call[0])).toContain('page');
    expect(await cookie(context, 'atelier_cookies')).toMatch(/~11~/);
  });

  test('configurar: solo analítica', async ({ page, context }) => {
    const hosts = await stubTrackers(context);
    await page.goto('/es/catalogo');
    await page
      .getByRole('dialog', { name: 'Antes de empezar' })
      .getByRole('button', { name: 'Configurar' })
      .click();
    const settings = page.getByRole('dialog', { name: 'Configurar cookies' });
    await expect(settings).toBeVisible();
    // Apagadas hasta que se elijan; las técnicas, siempre.
    await expect(
      settings.getByLabel('Técnicas (siempre activas)'),
    ).toBeChecked();
    await expect(settings.getByLabel('Analítica')).not.toBeChecked();
    await expect(settings.getByLabel('Publicidad')).not.toBeChecked();
    await expect(
      settings.getByText(
        'Proveedores: Google Ads, Meta (Facebook, Instagram), TikTok.',
      ),
    ).toBeVisible();
    await settings.getByLabel('Analítica').check();
    await settings.getByRole('button', { name: 'Guardar mi elección' }).click();
    await expect(settings).toBeHidden();
    await expect.poll(() => hosts).toEqual([GOOGLE]);
    const queues = await page.evaluate(readQueues);
    expect(queues.gtag.find((call) => call[1] === 'update')).toEqual([
      'consent',
      'update',
      {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      },
    ]);
    expect(
      queues.gtag.filter((call) => call[0] === 'config').map((c) => c[1]),
    ).toEqual(['G-E2ETEST01']);
    expect(await cookie(context, 'atelier_cookies')).toMatch(/~10~/);
  });

  test('la política de cookies se lee sin el aviso y explica cada proveedor', async ({
    page,
  }) => {
    await page.goto('/es/cookies');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    for (const heading of ['Cookies de analítica', 'Cookies de publicidad'])
      await expect(
        page.getByRole('heading', { level: 2, name: heading }),
      ).toBeVisible();
    for (const name of ['atelier_cookies', '_ga', '_gcl_au', '_fbp', '_ttp'])
      await expect(
        page.locator('main code', { hasText: new RegExp(`^${name}$`) }),
      ).toBeVisible();
    await page
      .getByRole('main')
      .getByRole('button', { name: 'Configurar cookies' })
      .click();
    await expect(
      page.getByRole('dialog', { name: 'Configurar cookies' }),
    ).toBeVisible();
  });

  test('el aviso y la configuración, sin infracciones de accesibilidad', async ({
    page,
  }) => {
    await page.goto('/es');
    const dialog = page.getByRole('dialog', { name: 'Antes de empezar' });
    await expect(dialog).toBeVisible();
    const { default: AxeBuilder } = await import('@axe-core/playwright');
    const tags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
    expect(
      (
        await new AxeBuilder({ page })
          .include('dialog')
          .withTags(tags)
          .analyze()
      ).violations,
    ).toEqual([]);
    await dialog.getByRole('button', { name: 'Configurar' }).click();
    await expect(
      page.getByRole('dialog', { name: 'Configurar cookies' }),
    ).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .include('dialog')
          .withTags(tags)
          .analyze()
      ).violations,
    ).toEqual([]);
  });
});

test.describe('quien ya aceptó', () => {
  test.use({ storageState: consentState(ALL_GRANTED) });

  test('retira el permiso desde el pie: se borran sus cookies y no se vuelve a cargar nada', async ({
    page,
    context,
  }) => {
    const hosts = await stubTrackers(context);
    await context.addCookies(
      ['_ga', '_ga_E2ETEST01', '_gcl_au', '_fbp', '_ttp'].map((name) => ({
        name,
        value: 'prueba',
        domain: 'localhost',
        path: '/',
      })),
    );
    await page.goto('/es');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => hosts.length).toBe(3);

    await page
      .getByRole('contentinfo')
      .getByRole('button', { name: 'Configurar cookies' })
      .click();
    const settings = page.getByRole('dialog', { name: 'Configurar cookies' });
    await expect(settings.getByLabel('Analítica')).toBeChecked();
    await expect(settings.getByLabel('Publicidad')).toBeChecked();
    // Se puede cerrar sin cambiar nada.
    await settings.getByRole('button', { name: 'Cerrar' }).click();
    await expect(settings).toBeHidden();

    await page
      .getByRole('contentinfo')
      .getByRole('button', { name: 'Configurar cookies' })
      .click();
    hosts.length = 0;
    await Promise.all([
      page.waitForEvent('load'),
      settings.getByRole('button', { name: 'Rechazar todas' }).click(),
    ]);
    const names = (await context.cookies()).map((item) => item.name);
    for (const name of ['_ga', '_ga_E2ETEST01', '_gcl_au', '_fbp', '_ttp'])
      expect(names, name).not.toContain(name);
    expect(await cookie(context, 'atelier_cookies')).toMatch(/~00~/);
    await page.goto('/en/catalog');
    expect(hosts).toEqual([]);
  });
});

test.describe('quien rechazó', () => {
  test.use({ storageState: consentState(ALL_DENIED) });

  test('no se le vuelve a preguntar ni se carga nada', async ({
    page,
    context,
  }) => {
    const hosts = await stubTrackers(context);
    await page.goto('/es/catalogo');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(hosts).toEqual([]);
  });
});
