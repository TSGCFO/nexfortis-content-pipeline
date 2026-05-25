/**
 * Shared types for bot handlers.
 */

import type { IncomingReplyEvent } from '../../jobs/interview-session/types.js';

/**
 * Inngest event payload shape emitted by the bot's handlers. The Inngest
 * function's CEL filter expects every event to carry `chatId` and
 * `sessionId`, plus a `messageType` discriminator and the message-shape
 * specific fields.
 */
export type TelegramMessageEvent = {
  name: 'telegram.message.received';
  data: IncomingReplyEvent['data'];
};

/**
 * Structural type of the Inngest `step.sendEvent` / `inngest.send`
 * dispatch surface used by handlers. Tests inject a `vi.fn()` mock.
 */
export type SendInngestEvent = (event: TelegramMessageEvent) => Promise<void>;
