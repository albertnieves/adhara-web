import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const generated = execFileSync(
  './node_modules/.bin/supabase',
  ['gen', 'types', '--local', '--schema', 'public'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);
const formatted = execFileSync(
  './node_modules/.bin/prettier',
  ['--stdin-filepath', 'src/lib/supabase/database.types.ts'],
  { input: generated, encoding: 'utf8' },
);
if (formatted !== readFileSync('src/lib/supabase/database.types.ts', 'utf8'))
  throw new Error(
    'Regenera los tipos de Supabase; difieren de las migraciones locales.',
  );
console.log('Tipos de Supabase sincronizados.');
