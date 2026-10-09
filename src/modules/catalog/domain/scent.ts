/*
 * Perfil olfativo (catálogo olfativo de la tienda). Las notas se guardan como
 * claves de este vocabulario, que da su nombre en es, ca y en y su grupo para
 * la representación visual. Una nota nueva se añade aquí antes de usarla en
 * un perfil: la base de datos solo comprueba el formato de la clave y la
 * tienda omite las que no conoce. Los datos vienen de una fuente citada en
 * source_url; nunca se deducen (docs/PRODUCT_RESEARCH.md).
 */

export const SCENT_FAMILIES = [
  'citrus',
  'fresh',
  'aquatic',
  'floral',
  'fruity',
  'gourmand',
  'oriental',
  'amber',
  'woody',
  'aromatic',
  'spicy',
  'musky',
] as const;
export type ScentFamily = (typeof SCENT_FAMILIES)[number];

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Season = (typeof SEASONS)[number];

export const TIMES_OF_DAY = ['day', 'night'] as const;
export type TimeOfDay = (typeof TIMES_OF_DAY)[number];

/** Nombres en el panel (en la tienda vienen de messages/). */
export const SCENT_FAMILY_NAMES: Record<ScentFamily, string> = {
  citrus: 'Cítrica',
  fresh: 'Fresca',
  aquatic: 'Acuática',
  floral: 'Floral',
  fruity: 'Frutal',
  gourmand: 'Gourmand',
  oriental: 'Oriental',
  amber: 'Ambarada',
  woody: 'Amaderada',
  aromatic: 'Aromática',
  spicy: 'Especiada',
  musky: 'Almizclada',
};
export const SEASON_NAMES: Record<Season, string> = {
  spring: 'Primavera',
  summer: 'Verano',
  autumn: 'Otoño',
  winter: 'Invierno',
};
export const TIME_OF_DAY_NAMES: Record<TimeOfDay, string> = {
  day: 'Día',
  night: 'Noche',
};

/** Grupo de una nota: ordena la leyenda y da el símbolo de cada nota. */
export const NOTE_GROUPS = [
  'citrus',
  'fruity',
  'floral',
  'aromatic',
  'spicy',
  'gourmand',
  'woody',
  'amber',
  'leather',
  'musky',
  'aquatic',
] as const;
export type NoteGroup = (typeof NOTE_GROUPS)[number];

export type NoteName = { es: string; ca: string; en: string };
type NoteEntry = NoteName & { group: NoteGroup };

function note(group: NoteGroup, es: string, ca: string, en: string) {
  return { group, es, ca, en } satisfies NoteEntry;
}

export const NOTES = {
  // Cítricos
  bergamot: note('citrus', 'Bergamota', 'Bergamota', 'Bergamot'),
  lemon: note('citrus', 'Limón', 'Llimona', 'Lemon'),
  lime: note('citrus', 'Lima', 'Llima', 'Lime'),
  orange: note('citrus', 'Naranja', 'Taronja', 'Orange'),
  'blood-orange': note(
    'citrus',
    'Naranja sanguina',
    'Taronja sanguina',
    'Blood orange',
  ),
  mandarin: note('citrus', 'Mandarina', 'Mandarina', 'Mandarin orange'),
  grapefruit: note('citrus', 'Pomelo', 'Aranja', 'Grapefruit'),
  neroli: note('citrus', 'Neroli', 'Nerolí', 'Neroli'),
  citrus: note('citrus', 'Cítricos', 'Cítrics', 'Citrus notes'),
  // Frutales
  apple: note('fruity', 'Manzana', 'Poma', 'Apple'),
  pear: note('fruity', 'Pera', 'Pera', 'Pear'),
  peach: note('fruity', 'Melocotón', 'Préssec', 'Peach'),
  pineapple: note('fruity', 'Piña', 'Pinya', 'Pineapple'),
  blackcurrant: note(
    'fruity',
    'Grosella negra',
    'Grosella negra',
    'Blackcurrant',
  ),
  raspberry: note('fruity', 'Frambuesa', 'Gerd', 'Raspberry'),
  strawberry: note('fruity', 'Fresa', 'Maduixa', 'Strawberry'),
  blackberry: note('fruity', 'Mora', 'Móra', 'Blackberry'),
  pomegranate: note('fruity', 'Granada', 'Magrana', 'Pomegranate'),
  lychee: note('fruity', 'Lichi', 'Litxi', 'Lychee'),
  melon: note('fruity', 'Melón', 'Meló', 'Melon'),
  mango: note('fruity', 'Mango', 'Mango', 'Mango'),
  coconut: note('fruity', 'Coco', 'Coco', 'Coconut'),
  'passion-fruit': note(
    'fruity',
    'Fruta de la pasión',
    'Fruita de la passió',
    'Passion fruit',
  ),
  dates: note('fruity', 'Dátiles', 'Dàtils', 'Dates'),
  prune: note('fruity', 'Ciruela pasa', 'Pruna seca', 'Prune'),
  berries: note('fruity', 'Bayas', 'Baies', 'Berries'),
  'red-fruits': note('fruity', 'Frutos rojos', 'Fruits vermells', 'Red fruits'),
  'tropical-fruits': note(
    'fruity',
    'Frutas tropicales',
    'Fruites tropicals',
    'Tropical fruits',
  ),
  'fruity-notes': note(
    'fruity',
    'Notas afrutadas',
    'Notes afruitades',
    'Fruity notes',
  ),
  // Florales
  rose: note('floral', 'Rosa', 'Rosa', 'Rose'),
  'turkish-rose': note('floral', 'Rosa turca', 'Rosa turca', 'Turkish rose'),
  'bulgarian-rose': note(
    'floral',
    'Rosa de Bulgaria',
    'Rosa de Bulgària',
    'Bulgarian rose',
  ),
  jasmine: note('floral', 'Jazmín', 'Gessamí', 'Jasmine'),
  tuberose: note('floral', 'Tuberosa', 'Tuberosa', 'Tuberose'),
  peony: note('floral', 'Peonía', 'Peònia', 'Peony'),
  iris: note('floral', 'Iris', 'Iris', 'Iris'),
  violet: note('floral', 'Violeta', 'Violeta', 'Violet'),
  'lily-of-the-valley': note(
    'floral',
    'Lirio de los valles',
    'Lliri de maig',
    'Lily of the valley',
  ),
  'ylang-ylang': note('floral', 'Ylang-ylang', 'Ylang-ylang', 'Ylang-ylang'),
  cyclamen: note('floral', 'Ciclamen', 'Ciclamen', 'Cyclamen'),
  geranium: note('floral', 'Geranio', 'Gerani', 'Geranium'),
  orchid: note('floral', 'Orquídea', 'Orquídia', 'Orchid'),
  heliotrope: note('floral', 'Heliotropo', 'Heliotropi', 'Heliotrope'),
  'orange-blossom': note(
    'floral',
    'Flor de azahar',
    'Flor de taronger',
    'Orange blossom',
  ),
  'cherry-blossom': note(
    'floral',
    'Flor de cerezo',
    'Flor de cirerer',
    'Cherry blossom',
  ),
  tagetes: note('floral', 'Tagetes', 'Tagetes', 'Tagetes'),
  mahonial: note('floral', 'Mahonial', 'Mahonial', 'Mahonial'),
  'white-flowers': note(
    'floral',
    'Flores blancas',
    'Flors blanques',
    'White flowers',
  ),
  'transparent-flowers': note(
    'floral',
    'Flores transparentes',
    'Flors transparents',
    'Transparent flowers',
  ),
  'floral-notes': note(
    'floral',
    'Notas florales',
    'Notes florals',
    'Floral notes',
  ),
  // Aromáticas y verdes
  rosemary: note('aromatic', 'Romero', 'Romaní', 'Rosemary'),
  sage: note('aromatic', 'Salvia', 'Sàlvia', 'Sage'),
  mint: note('aromatic', 'Menta', 'Menta', 'Mint'),
  basil: note('aromatic', 'Albahaca', 'Alfàbrega', 'Basil'),
  lavandin: note('aromatic', 'Lavandín', 'Lavandí', 'Lavandin'),
  juniper: note('aromatic', 'Enebro', 'Ginebre', 'Juniper'),
  galbanum: note('aromatic', 'Gálbano', 'Gàlban', 'Galbanum'),
  grass: note('aromatic', 'Hierba fresca', 'Herba fresca', 'Fresh grass'),
  'violet-leaf': note(
    'aromatic',
    'Hoja de violeta',
    'Fulla de violeta',
    'Violet leaf',
  ),
  'green-notes': note(
    'aromatic',
    'Notas verdes',
    'Notes verdes',
    'Green notes',
  ),
  'blue-tea': note('aromatic', 'Té azul', 'Te blau', 'Blue tea'),
  // Especias
  saffron: note('spicy', 'Azafrán', 'Safrà', 'Saffron'),
  'black-pepper': note(
    'spicy',
    'Pimienta negra',
    'Pebre negre',
    'Black pepper',
  ),
  'pink-pepper': note('spicy', 'Pimienta rosa', 'Pebre rosa', 'Pink pepper'),
  'white-pepper': note(
    'spicy',
    'Pimienta blanca',
    'Pebre blanc',
    'White pepper',
  ),
  cinnamon: note('spicy', 'Canela', 'Canyella', 'Cinnamon'),
  nutmeg: note('spicy', 'Nuez moscada', 'Nou moscada', 'Nutmeg'),
  cardamom: note('spicy', 'Cardamomo', 'Cardamom', 'Cardamom'),
  ginger: note('spicy', 'Jengibre', 'Gingebre', 'Ginger'),
  coriander: note('spicy', 'Cilantro', 'Coriandre', 'Coriander'),
  anise: note('spicy', 'Anís', 'Anís', 'Anise'),
  spices: note('spicy', 'Especias', 'Espècies', 'Spices'),
  // Gourmand y licores
  vanilla: note('gourmand', 'Vainilla', 'Vainilla', 'Vanilla'),
  tonka: note('gourmand', 'Haba tonka', 'Fava tonka', 'Tonka bean'),
  caramel: note('gourmand', 'Caramelo', 'Caramel', 'Caramel'),
  praline: note('gourmand', 'Praliné', 'Praliné', 'Praline'),
  toffee: note('gourmand', 'Toffee', 'Toffee', 'Toffee'),
  'dulce-de-leche': note(
    'gourmand',
    'Dulce de leche',
    'Dolç de llet',
    'Dulce de leche',
  ),
  honey: note('gourmand', 'Miel', 'Mel', 'Honey'),
  coffee: note('gourmand', 'Café', 'Cafè', 'Coffee'),
  cocoa: note('gourmand', 'Cacao', 'Cacau', 'Cocoa'),
  sesame: note('gourmand', 'Sésamo', 'Sèsam', 'Sesame'),
  'sugar-cane': note(
    'gourmand',
    'Caña de azúcar',
    'Canya de sucre',
    'Sugar cane',
  ),
  'lactonic-notes': note(
    'gourmand',
    'Notas lácteas',
    'Notes làctiques',
    'Lactonic notes',
  ),
  'gourmand-accord': note(
    'gourmand',
    'Acorde gourmand',
    'Acord gourmand',
    'Gourmand accord',
  ),
  rum: note('gourmand', 'Ron', 'Rom', 'Rum'),
  whisky: note('gourmand', 'Whisky', 'Whisky', 'Whisky'),
  bourbon: note('gourmand', 'Bourbon', 'Bourbon', 'Bourbon'),
  vodka: note('gourmand', 'Vodka', 'Vodka', 'Vodka'),
  // Maderas
  cedar: note('woody', 'Cedro', 'Cedre', 'Cedar'),
  sandalwood: note('woody', 'Sándalo', 'Sàndal', 'Sandalwood'),
  vetiver: note('woody', 'Vetiver', 'Vetiver', 'Vetiver'),
  patchouli: note('woody', 'Pachulí', 'Patxuli', 'Patchouli'),
  oud: note('woody', 'Oud', 'Oud', 'Oud'),
  amberwood: note('woody', 'Madera de ámbar', 'Fusta d’ambre', 'Amberwood'),
  cashmeran: note(
    'woody',
    'Madera de cachemira',
    'Fusta de caixmir',
    'Cashmere wood',
  ),
  cypriol: note('woody', 'Cipriol', 'Cipriol', 'Cypriol'),
  akigalawood: note('woody', 'Akigalawood', 'Akigalawood', 'Akigalawood'),
  birch: note('woody', 'Abedul', 'Bedoll', 'Birch'),
  'cut-wood': note('woody', 'Madera cortada', 'Fusta tallada', 'Cut wood'),
  'dry-woods': note('woody', 'Maderas secas', 'Fustes seques', 'Dry woods'),
  'woody-notes': note(
    'woody',
    'Notas amaderadas',
    'Notes llenyoses',
    'Woody notes',
  ),
  oakmoss: note('woody', 'Musgo de roble', 'Molsa de roure', 'Oakmoss'),
  moss: note('woody', 'Musgo', 'Molsa', 'Moss'),
  // Ámbares, resinas y bálsamos
  amber: note('amber', 'Ámbar', 'Ambre', 'Amber'),
  ambergris: note('amber', 'Ámbar gris', 'Ambre gris', 'Ambergris'),
  ambroxan: note('amber', 'Ambroxan', 'Ambroxan', 'Ambroxan'),
  labdanum: note('amber', 'Ládano', 'Làdan', 'Labdanum'),
  benzoin: note('amber', 'Benjuí', 'Benjuí', 'Benzoin'),
  myrrh: note('amber', 'Mirra', 'Mirra', 'Myrrh'),
  incense: note('amber', 'Incienso', 'Encens', 'Incense'),
  styrax: note('amber', 'Estoraque', 'Estorac', 'Styrax'),
  resins: note('amber', 'Resinas', 'Resines', 'Resins'),
  'fir-resin': note('amber', 'Resina de abeto', 'Resina d’avet', 'Fir resin'),
  'fir-balsam': note(
    'amber',
    'Bálsamo de abeto',
    'Bàlsam d’avet',
    'Fir balsam',
  ),
  // Cuero y tabaco
  tobacco: note('leather', 'Tabaco', 'Tabac', 'Tobacco'),
  leather: note('leather', 'Cuero', 'Cuir', 'Leather'),
  // Almizcles
  musk: note('musky', 'Almizcle', 'Mesc', 'Musk'),
  'white-musk': note('musky', 'Almizcle blanco', 'Mesc blanc', 'White musk'),
  // Marinas y luminosas
  'marine-notes': note(
    'aquatic',
    'Notas marinas',
    'Notes marines',
    'Marine notes',
  ),
  'aquatic-notes': note(
    'aquatic',
    'Notas acuáticas',
    'Notes aquàtiques',
    'Aquatic notes',
  ),
  'sea-salt': note('aquatic', 'Sal marina', 'Sal marina', 'Sea salt'),
  'solar-notes': note(
    'aquatic',
    'Notas solares',
    'Notes solars',
    'Solar notes',
  ),
} satisfies Record<string, NoteEntry>;

export type NoteKey = keyof typeof NOTES;

export function isNoteKey(value: string): value is NoteKey {
  return Object.hasOwn(NOTES, value);
}

export type ScentProfile = {
  top: NoteKey[];
  heart: NoteKey[];
  base: NoteKey[];
  /** Notas sin pirámide: cuando la fuente no las separa en salida, corazón y fondo. */
  key: NoteKey[];
  families: ScentFamily[];
  seasons: Season[];
  times: TimeOfDay[];
  sourceUrl: string;
};

function known<T extends string>(values: readonly T[], items: string[]): T[] {
  return items.filter((item): item is T => values.includes(item as T));
}

/** Fila de la base → perfil; omite claves que el vocabulario no conoce. */
export function toScentProfile(row: {
  top_notes: string[];
  heart_notes: string[];
  base_notes: string[];
  key_notes: string[];
  families: string[];
  seasons: string[];
  times_of_day: string[];
  source_url: string;
}): ScentProfile {
  return {
    top: row.top_notes.filter(isNoteKey),
    heart: row.heart_notes.filter(isNoteKey),
    base: row.base_notes.filter(isNoteKey),
    key: row.key_notes.filter(isNoteKey),
    families: known(SCENT_FAMILIES, row.families),
    seasons: known(SEASONS, row.seasons),
    times: known(TIMES_OF_DAY, row.times_of_day),
    sourceUrl: row.source_url,
  };
}

export function noteName(key: NoteKey, locale: string): string {
  const entry = NOTES[key];
  return locale === 'ca' || locale === 'en' ? entry[locale] : entry.es;
}

/** Todas las notas del perfil, sin repetir, en orden de pirámide. */
export function allNotes(profile: ScentProfile): NoteKey[] {
  return [
    ...new Set([
      ...profile.top,
      ...profile.heart,
      ...profile.base,
      ...profile.key,
    ]),
  ];
}

export function hasNotes(profile: ScentProfile): boolean {
  return allNotes(profile).length > 0;
}

/** Buscar sin tildes ni mayúsculas en los nombres de las notas (los tres idiomas). */
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export function profileMatchesNote(
  profile: ScentProfile,
  query: string,
): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return allNotes(profile).some((key) => {
    const entry = NOTES[key];
    return [entry.es, entry.ca, entry.en].some((name) =>
      normalizeSearch(name).includes(q),
    );
  });
}

/** Lista de claves válidas a partir de texto del panel («rose, white-musk»). */
export function parseNoteList(text: string): {
  notes: NoteKey[];
  unknown: string[];
} {
  const items = text
    .split(/[,\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const notes: NoteKey[] = [];
  const unknown: string[] = [];
  for (const item of items) {
    if (isNoteKey(item)) {
      if (!notes.includes(item)) notes.push(item);
    } else unknown.push(item);
  }
  return { notes, unknown };
}
