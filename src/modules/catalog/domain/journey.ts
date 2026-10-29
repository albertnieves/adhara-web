import type { StorefrontProduct } from './product';
import type {
  NoteKey,
  ScentFamily,
  ScentProfile,
  Season,
  TimeOfDay,
} from './scent';
import {
  allNotes,
  isNoteKey,
  SCENT_FAMILIES,
  SEASONS,
  TIMES_OF_DAY,
} from './scent';

/**
 * Recorrido olfativo (roadmap 6, DECISIONS §182): propone perfumes de la
 * colección según lo que el visitante elige (familias, estación, momento y
 * notas) y explica por qué. Reglas fijas y reproducibles sobre los perfiles
 * con fuente; sin IA, sin datos deducidos: un perfume sin perfil olfativo no
 * se propone.
 */

export type JourneyDocument = {
  product: StorefrontProduct;
  profile: ScentProfile | null;
};

export type JourneyAnswers = {
  families: ScentFamily[];
  seasons: Season[];
  times: TimeOfDay[];
  /** Notas que le gustan. */
  likes: NoteKey[];
  /** Notas que prefiere evitar: el perfume que las tiene no se propone. */
  avoid: NoteKey[];
};

export const NO_ANSWERS: JourneyAnswers = {
  families: [],
  seasons: [],
  times: [],
  likes: [],
  avoid: [],
};

export type JourneyMatch = {
  product: StorefrontProduct;
  profile: ScentProfile;
  score: number;
  /** Lo que coincide con lo elegido: la explicación de la propuesta. */
  reasons: {
    families: ScentFamily[];
    seasons: Season[];
    times: TimeOfDay[];
    notes: NoteKey[];
  };
};

/** Peso de cada coincidencia: la familia y las notas dicen más que el momento. */
export const JOURNEY_WEIGHTS = {
  family: 3,
  note: 2,
  season: 1,
  time: 1,
} as const;

export const MAX_FAMILIES = 3;
export const MAX_RESULTS = 6;

export function hasAnswers(answers: JourneyAnswers): boolean {
  return (
    answers.families.length +
      answers.seasons.length +
      answers.times.length +
      answers.likes.length >
    0
  );
}

/**
 * Las propuestas, de más a menos coincidencias. Hace falta al menos una
 * coincidencia con lo elegido (evitar notas, por sí solo, no propone nada); a
 * igual puntuación, el orden de la colección.
 */
export function recommend(
  documents: readonly JourneyDocument[],
  answers: JourneyAnswers,
  limit: number = MAX_RESULTS,
): JourneyMatch[] {
  if (!hasAnswers(answers)) return [];
  const avoid = new Set(answers.avoid);
  const matches = documents.flatMap((doc, index) => {
    const profile = doc.profile;
    if (!profile) return [];
    const notes = allNotes(profile);
    if (notes.some((note) => avoid.has(note))) return [];
    const reasons = {
      families: answers.families.filter((f) => profile.families.includes(f)),
      seasons: answers.seasons.filter((s) => profile.seasons.includes(s)),
      times: answers.times.filter((t) => profile.times.includes(t)),
      notes: answers.likes.filter((n) => notes.includes(n)),
    };
    const score =
      reasons.families.length * JOURNEY_WEIGHTS.family +
      reasons.notes.length * JOURNEY_WEIGHTS.note +
      reasons.seasons.length * JOURNEY_WEIGHTS.season +
      reasons.times.length * JOURNEY_WEIGHTS.time;
    if (score === 0) return [];
    return [{ product: doc.product, profile, score, reasons, index }];
  });
  matches.sort((a, b) => b.score - a.score || a.index - b.index);
  return matches.slice(0, limit).map((match) => ({
    product: match.product,
    profile: match.profile,
    score: match.score,
    reasons: match.reasons,
  }));
}

/** Lo que se puede elegir: solo lo que tiene algún perfume de la colección. */
export function journeyOptions(
  documents: readonly JourneyDocument[],
  noteLimit = 18,
) {
  const profiles = documents.flatMap((doc) =>
    doc.profile ? [doc.profile] : [],
  );
  const counts = new Map<NoteKey, number>();
  for (const profile of profiles)
    for (const note of allNotes(profile))
      counts.set(note, (counts.get(note) ?? 0) + 1);
  return {
    families: SCENT_FAMILIES.filter((f) =>
      profiles.some((p) => p.families.includes(f)),
    ),
    seasons: SEASONS.filter((s) => profiles.some((p) => p.seasons.includes(s))),
    times: TIMES_OF_DAY.filter((t) =>
      profiles.some((p) => p.times.includes(t)),
    ),
    /** Las notas más frecuentes, para que la lista sea corta y útil. */
    notes: [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, noteLimit)
      .map(([note]) => note),
    /** Perfumes con perfil: los únicos que se pueden proponer. */
    covered: profiles.length,
    total: documents.length,
  };
}

const LIST = /^[a-z0-9-]+(,[a-z0-9-]+)*$/;

function listParam<T extends string>(
  value: string | null,
  valid: (item: string) => item is T,
  max = 12,
): T[] {
  if (!value || !LIST.test(value)) return [];
  return [...new Set(value.split(','))].filter(valid).slice(0, max);
}

const isFamily = (v: string): v is ScentFamily =>
  (SCENT_FAMILIES as readonly string[]).includes(v);
const isSeason = (v: string): v is Season =>
  (SEASONS as readonly string[]).includes(v);
const isTime = (v: string): v is TimeOfDay =>
  (TIMES_OF_DAY as readonly string[]).includes(v);

/** Las respuestas en la URL: `?familias=woody,amber&estaciones=winter&momento=night&notas=vanilla&evitar=rose`. */
export function answersFromSearch(search: string): JourneyAnswers {
  const params = new URLSearchParams(search);
  const likes = listParam(params.get('notas'), isNoteKey);
  return {
    families: listParam(params.get('familias'), isFamily, MAX_FAMILIES),
    seasons: listParam(params.get('estaciones'), isSeason),
    times: listParam(params.get('momento'), isTime),
    likes,
    // Una nota no puede gustar y evitarse a la vez: manda «me gusta».
    avoid: listParam(params.get('evitar'), isNoteKey).filter(
      (note) => !likes.includes(note),
    ),
  };
}

export function answersToSearch(answers: JourneyAnswers): string {
  const params = new URLSearchParams();
  const set = (key: string, values: readonly string[]) => {
    if (values.length) params.set(key, values.join(','));
  };
  set('familias', answers.families);
  set('estaciones', answers.seasons);
  set('momento', answers.times);
  set('notas', answers.likes);
  set('evitar', answers.avoid);
  const text = params.toString().replace(/%2C/g, ',');
  return text ? `?${text}` : '';
}
