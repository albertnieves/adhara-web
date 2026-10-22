import { expect, test } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { admin, login, user } from './support';

/*
 * Bandeja de mensajes (PLAN_BANDEJA_MENSAJES, A6.1) contra Supabase local:
 * la consulta del formulario llega al panel, se responde, la cola entrega la
 * respuesta (aquí la toma la prueba, como haría el servidor con Resend) y la
 * contestación del cliente vuelve por el webhook firmado de Resend Inbound,
 * con la API de Resend simulada (tests/integration/fake-resend.ts).
 */

const FAKE_RESEND = 'http://localhost:3998';
const DOMAIN = process.env.INBOUND_EMAIL_DOMAIN!;

type Job = {
  id: number;
  number: number;
  locale: string;
  email: string;
  token: string;
  quoted: string | null;
  in_reply_to: string | null;
};

/** Evento email.received firmado como Svix, con el secreto del servidor. */
async function postInbound(
  request: APIRequestContext,
  emailId: string,
  to: string,
  from: string,
  { tamper = false } = {},
) {
  const body = JSON.stringify({
    type: 'email.received',
    created_at: new Date().toISOString(),
    data: {
      email_id: emailId,
      created_at: new Date().toISOString(),
      from,
      to: [to],
      cc: [],
      bcc: [],
      message_id: `<${emailId}@mail.example.test>`,
      subject: 'Re: consulta',
      attachments: [],
    },
  });
  const id = `msg_${randomUUID()}`;
  const timestamp = String(Math.floor(Date.now() / 1000));
  const key = Buffer.from(
    process.env.RESEND_WEBHOOK_SECRET!.slice('whsec_'.length),
    'base64',
  );
  const signature = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${tamper ? `${body} ` : body}`)
    .digest('base64');
  return request.post('/api/correo/entrante', {
    headers: {
      'content-type': 'application/json',
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': `v1,${signature}`,
    },
    data: body,
  });
}

async function conversationId(number: number) {
  const { data, error } = await admin
    .from('conversations')
    .select('id')
    .eq('number', number)
    .single();
  if (error) throw error;
  return String(data.id);
}

test('la consulta llega al panel, se responde y la contestación del cliente vuelve', async ({
  page,
  request,
}) => {
  const id = randomUUID().slice(0, 8);
  const customer = {
    name: `Clienta ${id}`,
    email: `clienta-${id}@test.invalid`,
  };

  // 1. Formulario en catalán, sin sesión.
  await page.goto('/ca/contacte');
  await expect(page.getByRole('heading', { name: 'Contacte' })).toBeVisible();
  await page.getByLabel('Nom', { exact: true }).fill(customer.name);
  await page
    .getByLabel('Correu electrònic', { exact: true })
    .fill(customer.email);
  await page
    .getByLabel('Missatge', { exact: true })
    .fill('Hola, encara no m’ha arribat la comanda.');
  await page.getByRole('button', { name: 'Envia el missatge' }).click();
  const received = page
    .getByRole('status')
    .filter({ hasText: 'Missatge rebut' });
  await expect(received).toBeVisible();
  const number = Number(
    /núm\. (\d+)/.exec((await received.innerText()) ?? '')?.[1],
  );
  expect(number).toBeGreaterThan(1000);
  const conversation = await conversationId(number);

  // 2. Panel: plantilla en catalán y respuesta con ella.
  await login(page, await user('store_admin'));
  await page.goto('/admin/mensajes/plantillas');
  await page.getByLabel('Título', { exact: true }).fill(`Enviament ${id}`);
  await page.getByLabel('Idioma', { exact: true }).selectOption('ca');
  await page
    .getByLabel('Texto', { exact: true })
    .fill('Bon dia, la comanda ja és en camí.');
  await page.getByRole('button', { name: 'Crear plantilla' }).click();
  await expect(page).toHaveURL(/guardada=1/);
  await expect(
    page.getByRole('link', { name: `Enviament ${id}` }),
  ).toBeVisible();

  await page.goto('/admin/mensajes');
  const row = page.getByRole('row').filter({ hasText: `Nº ${number}` });
  await expect(row).toContainText(customer.name);
  await expect(row).toContainText('Por responder');
  await row.getByRole('link').click();
  await expect(page).toHaveURL(new RegExp(`/admin/mensajes/${conversation}$`));
  await expect(page.getByText(customer.email)).toBeVisible();
  await expect(
    page.getByText('Hola, encara no m’ha arribat la comanda.'),
  ).toBeVisible();

  await page
    .getByLabel('Plantilla', { exact: true })
    .selectOption({ label: `Enviament ${id} (catalán)` });
  await expect(
    page.getByLabel('Respuesta al cliente', { exact: true }),
  ).toHaveValue('Bon dia, la comanda ja és en camí.');
  await page.getByRole('button', { name: 'Enviar respuesta' }).click();
  await expect(page.getByText(/respuesta guardada/)).toBeVisible();
  await expect(
    page.getByLabel('Respuesta al cliente', { exact: true }),
  ).toHaveValue('');
  await expect(page.getByText('En cola de envío')).toBeVisible();
  await expect(
    page.locator('dd').getByText('Esperando al cliente', { exact: true }),
  ).toBeVisible();

  // 3. La cola (como el servidor con Resend): la respuesta va al cliente,
  // en su idioma, con su mensaje citado y la clave de «Responder a».
  const claimed = await admin.rpc('web_message_emails_claim', { p_limit: 50 });
  if (claimed.error) throw claimed.error;
  const jobs = claimed.data as Job[];
  const job = jobs.find((j) => j.number === number);
  expect(job).toMatchObject({
    email: customer.email,
    locale: 'ca',
    quoted: 'Hola, encara no m’ha arribat la comanda.',
    in_reply_to: null,
  });
  for (const other of jobs)
    await admin.rpc('web_message_email_result', {
      p_message_id: other.id,
      p_ok: other.id === job!.id,
      ...(other.id === job!.id ? { p_provider_id: 'e2e' } : { p_error: 'e2e' }),
    });
  await page.reload();
  await expect(page.getByText('Enviada por email')).toBeVisible();

  // 4. El cliente contesta: el correo llega por el webhook firmado.
  const emailId = `e2e-${id}`;
  const to = `consulta-${job!.token}@${DOMAIN}`;
  await request.post(`${FAKE_RESEND}/__inbound`, {
    data: {
      id: emailId,
      from: customer.email,
      to: [to],
      subject: 'Re: Consulta sobre una comanda',
      text: `Moltes gràcies!\n\nEl dj., 16 d’oct. 2026 a les 10:00, L’Atelier du Désert <hola@example.test> va escriure:\n> Bon dia, la comanda ja és en camí.`,
      html: null,
      headers: { from: `${customer.name} <${customer.email}>` },
      message_id: `<${emailId}@mail.example.test>`,
      attachments: [{ id: 'a1', filename: 'foto.jpg' }],
      authentication: { spf: 'pass', dkim: 'pass', dmarc: 'pass' },
    },
  });
  const tampered = await postInbound(request, emailId, to, customer.email, {
    tamper: true,
  });
  expect(tampered.status()).toBe(400);
  const delivered = await postInbound(request, emailId, to, customer.email);
  expect(delivered.status()).toBe(200);
  expect(await delivered.json()).toEqual({ ok: true, action: 'appended' });
  const again = await postInbound(request, emailId, to, customer.email);
  expect(await again.json()).toEqual({ ok: true, action: 'duplicate' });

  await page.reload();
  await expect(
    page.getByText('Moltes gràcies!', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/va escriure/)).toHaveCount(0);
  await expect(page.getByText('1 adjunto no guardado')).toBeVisible();
  await expect(
    page.locator('dd').getByText('Por responder', { exact: true }),
  ).toBeVisible();

  // 5. Nota interna, estado y borrado.
  await page
    .getByLabel('Nota interna', { exact: true })
    .fill('Llamar si no llega mañana.');
  await page.getByRole('button', { name: 'Añadir nota' }).click();
  await expect(page.getByText('Llamar si no llega mañana.')).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como resuelta' }).click();
  await expect(
    page.locator('dd').getByText('Resuelta', { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.getByRole('button', { name: 'Borrar conversación' }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Borrar', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/mensajes\?borrada=1$/);
  await expect(page.getByText('Conversación borrada.')).toBeVisible();
  const gone = await admin
    .from('conversations')
    .select('id')
    .eq('id', conversation);
  expect(gone.data).toEqual([]);
  await admin.from('message_templates').delete().eq('title', `Enviament ${id}`);
});

test('encargado: lee la bandeja sin datos del cliente ni respuesta', async ({
  page,
}) => {
  const id = randomUUID().slice(0, 8);
  const customer = {
    name: `Cliente ${id}`,
    email: `cliente-${id}@test.invalid`,
  };
  const submitted = await admin.rpc('web_contact_submit', {
    p_request_id: randomUUID(),
    p_locale: 'es',
    p_topic: 'product',
    p_full_name: customer.name,
    p_email: customer.email,
    p_subject: `Consulta ${id}`,
    p_body: '¿Tendréis más unidades?',
  });
  if (submitted.error) throw submitted.error;
  const number = (submitted.data as { number: number }).number;
  const conversation = await conversationId(number);

  try {
    await login(page, await user('viewer'));
    await page.goto('/admin/mensajes');
    await expect(
      page.getByRole('link', { name: `Consulta ${id}` }),
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Cliente' }),
    ).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Plantillas' })).toHaveCount(0);

    await page.goto(`/admin/mensajes/${conversation}`);
    await expect(page.getByText('¿Tendréis más unidades?')).toBeVisible();
    await expect(
      page.getByText('Visible con permiso de clientes'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enviar respuesta' }),
    ).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toContain(customer.email);
    expect(html).not.toContain(customer.name);

    await page.goto('/admin/mensajes/plantillas');
    await expect(
      page.getByRole('heading', { name: '404', exact: true }),
    ).toBeVisible();
  } finally {
    await admin.from('conversations').delete().eq('id', conversation);
  }
});
