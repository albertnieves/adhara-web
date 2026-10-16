export {
  CHANNELS,
  CONVERSATION_STATUSES,
  MANUAL_STATUS_CHANGES,
  MESSAGE_KINDS,
  RESPONSE_TARGET_MINUTES,
  TOPICS,
  canSetStatus,
  isOverdue,
  requiresHumanReview,
  statusAfterMessage,
} from './domain/conversations';
export type {
  Channel,
  ConversationClock,
  ConversationStatus,
  MessageAuthor,
  MessageKind,
  Topic,
} from './domain/conversations';
export {
  CHANNEL_LABELS,
  CONVERSATION_STATUS_LABELS,
  INBOX_VIEWS,
  INBOX_VIEW_LABELS,
  MESSAGE_ERRORS,
  MESSAGE_KIND_LABELS,
  TOPIC_LABELS,
  conversationNumberLabel,
  conversationStatusBadge,
  inboxViewHref,
  matchesInboxView,
  messageEmailBadge,
  overdue,
  parseInboxView,
  statusActions,
} from './domain/labels';
export type {
  InboxFacts,
  InboxView,
  MessageEmailStatus,
  StatusAction,
} from './domain/labels';
export {
  CONTACT_ERRORS,
  CONTACT_MESSAGE_MAX,
  contactFieldErrors,
  contactInput,
} from './domain/contact';
export type {
  ContactError,
  ContactField,
  ContactInput,
  ContactState,
} from './domain/contact';
export {
  INBOUND_BODY_MAX,
  bareAddress,
  displayName,
  findReplyToken,
  htmlToText,
  parseReceivedEvent,
  readReceivedEmail,
  replyAddress,
  stripQuotedReply,
} from './domain/inbound';
export type { InboundEmail, ReceivedEmailEvent } from './domain/inbound';
