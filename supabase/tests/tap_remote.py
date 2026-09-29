"""Ejecuta un test pgTAP contra un proyecto remoto sin Docker.

Convierte supabase/tests/database/*.test.sql en un script que guarda cada
resultado y los devuelve dentro de una excepción final: la excepción revierte
toda la transacción, así que no quedan datos de prueba en la base.

Uso: python3 supabase/tests/tap_remote.py supabase/tests/database/02_catalog_inventory.test.sql
y ejecutar la salida con el conector de Supabase (execute_sql) o psql.
"""
import re, sys
src = open(sys.argv[1]).read()
out = []
for line in src.splitlines():
    s = line.strip()
    if s in ('begin;', 'rollback;'):
        continue
    if s == 'select * from finish();':
        out.append('insert into pg_temp.tap(line) select * from finish();')
        continue
    if re.match(r'select (plan|throws_ok|lives_ok|is|isnt|ok|is_empty|results_eq)\(', s):
        line = line.replace('select ', 'insert into pg_temp.tap(line) select ', 1)
    out.append(line)
body = '\n'.join(out)
body = body.replace("set search_path = public, extensions;",
  "set search_path = public, extensions;\ncreate temp table tap (line text, at timestamptz default clock_timestamp());\ngrant all on pg_temp.tap to public;", 1)
body += "\ndo $$ begin raise exception E'TAP\\n%', (select string_agg(line, E'\\n' order by at) from pg_temp.tap); end $$;\n"
print('begin;\n' + body)
