import 'server-only';

export { mailConfig } from './server/config';
export { sendOrderEmails } from './server/outbox';
export type { OutboxResult } from './server/outbox';
