import 'server-only';

export { mailConfig, resendApiBase } from './server/config';
export { sendOrderEmails } from './server/outbox';
export type { OutboxResult } from './server/outbox';
export { sendWithResend } from './server/resend';
