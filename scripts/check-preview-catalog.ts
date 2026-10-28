/** Ensayo sobre Supabase local vacío en CI; siempre revierte la transacción. */
import { spawnSync } from 'node:child_process';
import { catalogSql } from './preview-catalog.ts';
import { previewCatalogFixture } from '../tests/fixtures/preview-catalog.ts';

const sql = catalogSql(previewCatalogFixture(), 'abcdefghijklmnopqrst');
const assertions = `
do $$ begin
  if (select count(*) from public.products where status = 'published') <> 1
     or (select count(*) from public.product_variants where retail_price_cents = 4990 and compare_at_price_cents is null) <> 1
     or (select count(*) from public.product_sources) <> 1
     or exists(select 1 from public.orders)
     or exists(select 1 from auth.users)
     or exists(select 1 from internal.variant_cost_records) then
    raise exception 'El ensayo del catálogo no conserva el aislamiento';
  end if;
end $$;
set local role anon;
do $$ begin
  if (select count(*) from public.products) <> 1 then
    raise exception 'El catálogo no es visible bajo RLS';
  end if;
end $$;
reset role;
`;
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    'supabase_db_adhara-admin-delivery',
    'psql',
    '-X',
    '-q',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
  ],
  {
    input: sql.replace(/rollback;$/, assertions + '\nrollback;'),
    encoding: 'utf8',
  },
);
if (result.status !== 0) {
  console.error('Falló el ensayo de importación sobre Supabase local.');
  process.exit(1);
}
console.log(
  'Catálogo publicado, PVP, procedencia y lectura anon con RLS correctos; ensayo revertido.',
);
