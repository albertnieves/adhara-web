import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  NOTES,
  NOTE_GROUPS,
  SCENT_FAMILIES,
  SEASONS,
  TIMES_OF_DAY,
  allNotes,
  noteName,
  parseNoteList,
  profileMatchesNote,
  toScentProfile,
} from '../../src/modules/catalog/domain/scent';
import es from '../../messages/es.json';

const DATA = new URL(
  '../../supabase/data/20261009_perfiles_olfativos.sql',
  import.meta.url,
);
const MIGRATION = new URL(
  '../../supabase/migrations/20261009161818_scent_profiles.sql',
  import.meta.url,
);

/** Filas del archivo de datos: slug y los siete arrays en orden. */
function dataRows() {
  const sql = readFileSync(DATA, 'utf8');
  return [
    ...sql.matchAll(/\('([a-z0-9-]+)', ((?:'\{[^}]*\}', ){6}'\{[^}]*\}')/g),
  ].map((m) => ({
    slug: m[1]!,
    arrays: [...m[2]!.matchAll(/'\{([^}]*)\}'/g)].map((a) =>
      a[1] ? a[1].split(',') : [],
    ),
  }));
}

describe('vocabulario de notas', () => {
  it('cada nota tiene clave válida, grupo conocido y nombre en es, ca y en', () => {
    for (const [key, entry] of Object.entries(NOTES)) {
      expect(key).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(NOTE_GROUPS).toContain(entry.group);
      for (const locale of ['es', 'ca', 'en'] as const)
        expect(entry[locale].trim()).not.toBe('');
    }
  });

  it('familias, estaciones y momentos coinciden con la migración', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    for (const value of [...SCENT_FAMILIES, ...SEASONS, ...TIMES_OF_DAY])
      expect(sql).toContain(`'${value}'`);
  });

  it('las familias, estaciones, momentos y grupos tienen texto en la tienda', () => {
    for (const f of SCENT_FAMILIES) expect(es.family[f]).toBeTruthy();
    for (const s of SEASONS) expect(es.season[s]).toBeTruthy();
    for (const t of TIMES_OF_DAY) expect(es.timeOfDay[t]).toBeTruthy();
    for (const g of NOTE_GROUPS) expect(es.noteGroup[g]).toBeTruthy();
  });
});

describe('datos de perfiles olfativos', () => {
  const rows = dataRows();

  it('el archivo trae los 47 perfiles investigados, sin repetir', () => {
    expect(rows).toHaveLength(47);
    expect(new Set(rows.map((r) => r.slug)).size).toBe(rows.length);
  });

  it('solo usa notas del vocabulario y valores conocidos', () => {
    for (const { slug, arrays } of rows) {
      const [top, heart, base, key, families, seasons, times] = arrays;
      for (const note of [...top!, ...heart!, ...base!, ...key!])
        expect(Object.keys(NOTES), `${slug}: ${note}`).toContain(note);
      for (const f of families!) expect(SCENT_FAMILIES).toContain(f);
      for (const s of seasons!) expect(SEASONS).toContain(s);
      for (const t of times!) expect(TIMES_OF_DAY).toContain(t);
    }
  });

  it('cada perfil cita una fuente https', () => {
    const sql = readFileSync(DATA, 'utf8');
    const urls = [...sql.matchAll(/^ {3}'(https:\/\/[^']+)'/gm)];
    expect(urls).toHaveLength(rows.length);
  });
});

describe('perfil olfativo', () => {
  const profile = toScentProfile({
    top_notes: ['bergamot', 'inventada'],
    heart_notes: ['rose'],
    base_notes: ['amber', 'rose'],
    key_notes: [],
    families: ['floral', 'marina'],
    seasons: ['spring', 'monzón'],
    times_of_day: ['night'],
    source_url: 'https://example.invalid',
  });

  it('omite claves que el vocabulario no conoce', () => {
    expect(profile.top).toEqual(['bergamot']);
    expect(profile.families).toEqual(['floral']);
    expect(profile.seasons).toEqual(['spring']);
  });

  it('lista las notas sin repetir y las nombra en cada idioma', () => {
    expect(allNotes(profile)).toEqual(['bergamot', 'rose', 'amber']);
    expect(noteName('amber', 'es')).toBe('Ámbar');
    expect(noteName('amber', 'ca')).toBe('Ambre');
    expect(noteName('amber', 'en')).toBe('Amber');
    expect(noteName('amber', 'fr')).toBe('Ámbar');
  });

  it('busca notas sin tildes en los tres idiomas', () => {
    expect(profileMatchesNote(profile, 'AMBAR')).toBe(true);
    expect(profileMatchesNote(profile, 'bergamote')).toBe(false);
    expect(profileMatchesNote(profile, 'rosa')).toBe(true);
    expect(profileMatchesNote(profile, '')).toBe(true);
  });

  it('lee listas de notas del panel y separa las desconocidas', () => {
    expect(parseNoteList('Rose, white-musk\nrose, oud-raro')).toEqual({
      notes: ['rose', 'white-musk'],
      unknown: ['oud-raro'],
    });
  });
});
