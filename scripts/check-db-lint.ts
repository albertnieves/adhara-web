/**
 * `supabase db lint` (plpgsql_check) sobre la base local: falla con cualquier
 * error salvo los falsos positivos conocidos. plpgsql_check no ve las tablas
 * temporales que la propia función crea al ejecutarse.
 */
import { execFileSync } from 'node:child_process';

type Issue = { level: string; message: string };
type Result = { function: string; issues: Issue[] };

const TEMP_TABLES: Record<string, string> = {
  'public.admin_record_store_sale': 'sale_items',
  'public.admin_set_purchase_order_lines': 'new_lines',
  'public.admin_receive_purchase_order': 'receive_items',
};

const output = execFileSync(
  './node_modules/.bin/supabase',
  ['db', 'lint', '--local', '--level', 'error'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
).trim();
const { results = [] } = (output ? JSON.parse(output) : {}) as {
  results?: Result[];
};

const unexpected = results.flatMap((result) =>
  result.issues
    .filter(
      (issue) =>
        issue.message !==
        `relation "pg_temp.${TEMP_TABLES[result.function]}" does not exist`,
    )
    .map((issue) => `${result.function}: ${issue.message}`),
);
if (unexpected.length > 0)
  throw new Error(`Errores de plpgsql_check:\n${unexpected.join('\n')}`);
console.log(
  `db lint sin errores (${results.length} falsos positivos conocidos de tablas temporales).`,
);
