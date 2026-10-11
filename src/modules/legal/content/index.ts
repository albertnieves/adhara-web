import type { LegalCopy } from '../domain/types';
import { ca } from './ca';
import { en } from './en';
import { es } from './es';

export const LEGAL_COPY: Record<'es' | 'ca' | 'en', LegalCopy> = { es, ca, en };
