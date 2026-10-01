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
console.log(
  'Concurrencia real correcta: precio, imagen, recepción y último administrador. Fixtures permanecen solo en el contenedor local hasta db reset.',
);
