export {
  productStructuredData,
  serializeJsonLd,
} from './domain/structured-data';
export {
  GOOGLE_PERFUME_CATEGORY,
  merchantFeedItems,
  merchantFeedXml,
} from './domain/merchant-feed';
export type { FeedItem } from './domain/merchant-feed';
export {
  AUDIENCES,
  AVAILABILITY,
  CONCENTRATIONS,
  CONCENTRATION_NAMES,
  MEDIA_ORIGINS,
  PRODUCT_STATUSES,
  groupByBrand,
  heroMedia,
  isAudience,
  isConcentration,
  lowestPrice,
  slugify,
  variantLabel,
} from './domain/product';
export type {
  Audience,
  Availability,
  Concentration,
  MediaOrigin,
  ProductMedia,
  ProductStatus,
  ProductVariant,
  StorefrontBrand,
  StorefrontProduct,
} from './domain/product';
export {
  NOTES,
  NOTE_GROUPS,
  SCENT_FAMILIES,
  SCENT_FAMILY_NAMES,
  SEASONS,
  SEASON_NAMES,
  TIMES_OF_DAY,
  TIME_OF_DAY_NAMES,
  allNotes,
  hasNotes,
  isNoteKey,
  noteName,
  normalizeSearch,
  parseNoteList,
  profileMatchesNote,
  toScentProfile,
} from './domain/scent';
export type {
  NoteGroup,
  NoteKey,
  ScentFamily,
  ScentProfile,
  Season,
  TimeOfDay,
} from './domain/scent';
