/** Solo entorno efímero local: nunca obtiene ni imprime credenciales remotas. */
import { execFileSync, spawnSync } from 'node:child_process';
const status = JSON.parse(
  execFileSync('./node_modules/.bin/supabase', ['status', '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }),
);
if (!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(status.API_URL))
  throw new Error('Solo Supabase local en 54321');
const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error('Falta comando');
const result = spawnSync(command, args, {
  stdio: 'inherit',
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY,
    SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    ADHARA_LOCAL_TEST: '1',
  },
});
process.exit(result.status ?? 1);
