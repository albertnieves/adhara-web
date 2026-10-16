/** Dos conexiones PostgreSQL reales; SOLO contenedor de pruebas. Requiere base local limpia. */
import { spawn, execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const container = 'supabase_db_adhara-admin-delivery';
function query(sql: string): Promise<{ code: number; text: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', [
      'exec',
      '-i',
      container,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ]);
    let text = '';
    child.stdout.on('data', (x) => (text += x));
    child.stderr.on('data', (x) => (text += x));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, text }));
    child.stdin.end(sql);
  });
}
const config = execFileSync(
  './node_modules/.bin/supabase',
  ['status', '-o', 'json'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
);
assert.match(
  JSON.parse(config).API_URL,
  /^http:\/\/(127\.0\.0\.1|localhost):54321$/,
);
const empty = await query('select count(*) from public.staff_members;');
assert.equal(
  empty.text.trim(),
  '0',
  'Ejecuta db reset --local antes: requiere base local vacía',
);
const owner = randomUUID(),
  other = randomUUID(),
  brand = randomUUID(),
  product = randomUUID(),
  variant = randomUUID(),
  one = randomUUID(),
  two = randomUUID(),
  location = randomUUID(),
  request = randomUUID();
const setup =
  await query(`insert into auth.users(id,email) values('${owner}','concurrency-owner@test.invalid'),('${other}','concurrency-other@test.invalid');
insert into public.staff_members(user_id,role) values('${owner}','system_admin'),('${other}','system_admin');
insert into public.brands(id,slug,name) values('${brand}','concurrency-test','Prueba local');
insert into public.products(id,brand_id,slug,name) values('${product}','${brand}','concurrency-test','Prueba local');
insert into public.product_variants(id,product_id,size_ml,retail_price_cents) values('${variant}','${product}',100,5000);
insert into public.product_media(id,product_id,url,role,origin) values('${one}','${product}','https://example.invalid/1.jpg','hero','own_photo'),('${two}','${product}','https://example.invalid/2.jpg','gallery','own_photo');
insert into public.stock_locations(id,code,name,kind) values('${location}','concurrency-test','Prueba local','store');`);
assert.equal(setup.code, 0, setup.text);
const as = (id: string, sql: string) =>
  `begin; set local role authenticated; select set_config('request.jwt.claims','{"sub":"${id}","aal":"aal2","role":"authenticated"}',true); ${sql}; commit;`;
const reviews = await query(
  as(
    owner,
    `select public.admin_review_price(id,updated_at,5500,null,null,'{}') from public.product_variants where id='${variant}'; select public.admin_review_price(id,updated_at,6000,null,null,'{}') from public.product_variants where id='${variant}'`,
  ),
);
const ids = reviews.text
  .split('\n')
  .filter((line) => /^[a-f0-9-]{36}$/.test(line));
assert.equal(ids.length, 2, reviews.text);
const prices = await Promise.all(
  ids.map((id) =>
    query(
      as(
        owner,
        `select public.admin_apply_price_review('${id}','{}'); select pg_sleep(0.2)`,
      ),
    ),
  ),
);
assert.equal(
  prices.filter((x) => x.code === 0).length,
  1,
  JSON.stringify(prices),
);
assert.ok(prices.some((x) => x.text.includes('edit_conflict')));
const media = await Promise.all(
  [one, two].map((id) =>
    query(
      as(
        owner,
        `select public.admin_set_primary_media('${product}','${id}'); select pg_sleep(0.2)`,
      ),
    ),
  ),
);
assert.ok(
  media.every((x) => x.code === 0),
  JSON.stringify(media),
);
assert.equal(
  (
    await query(
      `select count(*) from public.product_media where product_id='${product}' and role='hero'`,
    )
  ).text.trim(),
  '1',
);
const input = JSON.stringify({
  kind: 'movement',
  variantId: variant,
  locationId: location,
  type: 'PURCHASE_RECEIPT',
  quantity: 5,
});
const stock = await Promise.all(
  [1, 2].map(() =>
    query(
      as(
        owner,
        `select public.admin_inventory_once('${request}','${input}'); select pg_sleep(0.2)`,
      ),
    ),
  ),
);
assert.ok(
  stock.every((x) => x.code === 0),
  JSON.stringify(stock),
);
assert.equal(
  (
    await query(
      `select on_hand from public.inventory_levels where variant_id='${variant}'`,
    )
  ).text.trim(),
  '5',
);
const staff = await Promise.all(
  [owner, other].map((id) =>
    query(
      as(
        id,
        `update public.staff_members set active=false where user_id='${id}'; select pg_sleep(0.2)`,
      ),
    ),
  ),
);
assert.equal(
  staff.filter((x) => x.code === 0).length,
  1,
  JSON.stringify(staff),
);
assert.ok(staff.some((x) => x.text.includes('last_admin')));
assert.equal(
  (
    await query(
      "select count(*) from public.staff_members where role='system_admin' and active",
    )
  ).text.trim(),
  '1',
);
// Pedidos web (PLAN_PEDIDOS_WEB, P02): solo el servidor, con la clave privilegiada.
const server = (sql: string) =>
  `begin; set local role service_role; select set_config('request.jwt.claims','{"role":"service_role"}',true); ${sql}; commit;`;
const shopBrand = randomUUID(),
  shopProduct = randomUUID(),
  lastUnit = randomUUID(),
  lateUnit = randomUUID();
const shop =
  await query(`insert into public.brands(id,slug,name) values('${shopBrand}','concurrency-orders','Prueba local');
insert into public.products(id,brand_id,slug,name) values('${shopProduct}','${shopBrand}','concurrency-orders','Prueba local');
insert into public.product_variants(id,product_id,size_ml,retail_price_cents) values('${lastUnit}','${shopProduct}',100,5000),('${lateUnit}','${shopProduct}',50,3000);
update public.products set status='published' where id='${shopProduct}';
insert into public.inventory_levels(variant_id,location_id,on_hand) values('${lastUnit}','${location}',1),('${lateUnit}','${location}',1);`);
assert.equal(shop.code, 0, shop.text);
const createOrder = (variantId: string) =>
  server(
    `select public.web_order_create('${randomUUID()}','es','click_collect','${location}','[{"variant_id":"${variantId}","quantity":1}]'::jsonb,'{"full_name":"Prueba","email":"prueba@test.invalid"}'::jsonb,'redsys',30); select pg_sleep(0.2)`,
  );
const level = async (variantId: string) =>
  (
    await query(
      `select on_hand || '/' || reserved from public.inventory_levels where variant_id='${variantId}'`,
    )
  ).text.trim();
const reference = async (variantId: string) =>
  (
    await query(
      `select a.reference from public.order_payment_attempts a join public.order_lines l on l.order_id=a.order_id where l.variant_id='${variantId}'`,
    )
  ).text.trim();
// 1. La última unidad y 12 compras simultáneas: un solo pedido la reserva.
const buyers = await Promise.all(
  Array.from({ length: 12 }, () => query(createOrder(lastUnit))),
);
assert.equal(
  buyers.filter((x) => x.code === 0).length,
  1,
  JSON.stringify(buyers),
);
assert.equal(
  buyers.filter((x) => x.text.includes('insufficient_stock')).length,
  11,
);
assert.equal(await level(lastUnit), '1/1');
// 2. La misma notificación del banco 8 veces a la vez: una sola confirmación.
const lastRef = await reference(lastUnit);
const notices = await Promise.all(
  Array.from({ length: 8 }, () =>
    query(
      server(
        `select public.web_order_record_payment('redsys','${lastRef}','tx-concurrency','succeeded',5000,'EUR') ->> 'action'; select pg_sleep(0.2)`,
      ),
    ),
  ),
);
assert.ok(
  notices.every((x) => x.code === 0),
  JSON.stringify(notices),
);
const actions = notices.map((x) =>
  x.text.split('\n').find((line) => line === 'confirm' || line === 'ignore'),
);
assert.equal(actions.filter((x) => x === 'confirm').length, 1);
assert.equal(actions.filter((x) => x === 'ignore').length, 7);
assert.equal(
  (
    await query(
      `select count(*) || '/' || (select count(*) from public.order_events e join public.order_lines l on l.order_id=e.order_id where l.variant_id='${lastUnit}' and e.kind='payment_confirmed') from public.order_payments where transaction_id='tx-concurrency'`,
    )
  ).text.trim(),
  '1/1',
);
// 3. Cobro y caducidad a la vez: o pagado con la reserva, o incidencia sin ella.
const late = await query(createOrder(lateUnit));
assert.equal(late.code, 0, late.text);
const lateRef = await reference(lateUnit);
await query(
  `update public.orders o set reserved_until = now() - interval '1 minute' from public.order_lines l where l.order_id=o.id and l.variant_id='${lateUnit}'`,
);
const race = await Promise.all([
  query(
    server(`select public.web_order_release_expired(); select pg_sleep(0.2)`),
  ),
  query(
    server(
      `select public.web_order_record_payment('redsys','${lateRef}','tx-late','succeeded',3000,'EUR'); select pg_sleep(0.2)`,
    ),
  ),
]);
assert.ok(
  race.every((x) => x.code === 0),
  JSON.stringify(race),
);
const lateState = (
  await query(
    `select o.status || '/' || o.reservation from public.orders o join public.order_lines l on l.order_id=o.id where l.variant_id='${lateUnit}'`,
  )
).text.trim();
assert.ok(
  ['paid/committed', 'needs_attention/released'].includes(lateState),
  lateState,
);
assert.equal(
  await level(lateUnit),
  lateState === 'paid/committed' ? '1/1' : '1/0',
);
// 4. Mensajes (A6.1): el límite de 3 consultas por email y hora es exacto
// con envíos a la vez, el mismo formulario repetido crea una sola consulta y
// dos respuestas con la misma revisión guardan una.
const contactEmail = `concurrency-${randomUUID().slice(0, 8)}@test.invalid`;
const submits = await Promise.all(
  Array.from({ length: 8 }, () =>
    query(
      server(
        `select public.web_contact_submit('${randomUUID()}','es','other','Prueba','${contactEmail}','Asunto','Mensaje'); select pg_sleep(0.1)`,
      ),
    ),
  ),
);
assert.equal(
  submits.filter((x) => x.code === 0).length,
  3,
  JSON.stringify(submits),
);
assert.ok(
  submits
    .filter((x) => x.code !== 0)
    .every((x) => x.text.includes('rate_limited')),
  JSON.stringify(submits),
);
const sameForm = randomUUID();
const repeated = await Promise.all(
  Array.from({ length: 6 }, () =>
    query(
      server(
        `select public.web_contact_submit('${sameForm}','es','order','Prueba','otra-${contactEmail}','Asunto','Mensaje'); select pg_sleep(0.1)`,
      ),
    ),
  ),
);
assert.ok(
  repeated.every((x) => x.code === 0),
  JSON.stringify(repeated),
);
const conversation = (
  await query(
    `select id || '/' || revision from public.conversations where request_id='${sameForm}'`,
  )
).text.trim();
assert.match(conversation, /^[a-f0-9-]{36}\/\d+$/, conversation);
const [conversationId, revision] = conversation.split('/');
// Cuenta propia: la prueba del último administrador deja a `owner` o a
// `other` sin acceso.
const replier = randomUUID();
const replierSetup = await query(
  `insert into auth.users(id,email) values('${replier}','concurrency-replier@test.invalid'); insert into public.staff_members(user_id,role) values('${replier}','store_admin');`,
);
assert.equal(replierSetup.code, 0, replierSetup.text);
const replies = await Promise.all(
  [0, 1].map(() =>
    query(
      as(
        replier,
        `select public.admin_reply_conversation('${conversationId}','Hola',${revision}); select pg_sleep(0.2)`,
      ),
    ),
  ),
);
assert.equal(
  replies.filter((x) => x.code === 0).length,
  1,
  JSON.stringify(replies),
);
assert.equal(
  (
    await query(
      `select count(*) from public.conversation_messages m join public.message_emails e on e.message_id=m.id where m.conversation_id='${conversationId}'`,
    )
  ).text.trim(),
  '1',
);
console.log(
  'Concurrencia real correcta: precio, imagen, recepción, último administrador, pedidos web y mensajes. Fixtures permanecen solo en el contenedor local hasta db reset.',
);
