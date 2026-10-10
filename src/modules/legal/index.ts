export { LEGAL_COPY } from './content';
export {
  LEGAL_CONSENT_COOKIE,
  LEGAL_CONSENT_MAX_AGE,
  LEGAL_ENTITY,
  LEGAL_UPDATED_AT,
} from './domain/entity';
export { LegalConsent } from './ui/LegalConsent';
export type { LegalValue } from './domain/entity';
export {
  invalidTokens,
  parseLegalText,
  visibleSegments,
  resolveValue,
} from './domain/placeholders';
export type { LegalSegment } from './domain/placeholders';
export { LEGAL_PATHS } from './domain/routes';
export { LEGAL_DOCUMENTS, LEGAL_FIELDS } from './domain/types';
export type {
  LegalBlock,
  LegalCopy,
  LegalDocument,
  LegalDocumentKey,
  LegalField,
} from './domain/types';
