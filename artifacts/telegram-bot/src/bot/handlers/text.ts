/**
 * grammY text-message handler.
 *
 * Receives every non-command text message and translates it into a
 * `telegram.message.received` Inngest event so PR 1's `step.waitForEvent`
 * (and PR 2's confirmation-loop wait) can consume it.
 *
 * Active-session lookup: pulled from the in-memory `SessionMap`. If no
 * session is open for the chat, the handler logs a warning and drops the
 * message — Telegram users will get no response. Future PR 3 commands
 * like `/status` will use a different code path.
 *
 * Pure handler logic is exported as `handleTextMessage` for testing;
 * `registerTextHandler` glues it into grammY.
 */

import type { Bot, Context } from 'grammy';
import type { Logger } from '@ncp/logger';

import type { SessionMap } from '../session-map.js';
import type { SendInngestEvent } from './types.js';

const SOURCE = 'telegram_bot' as const;

export interface HandleTextMessageInput {
  chatId: string;
  text: string;
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEvent;
  logger: Logger;
}

export async function handleTextMessage(
  input: HandleTextMessageInput,
): Promise<void> {
  const { chatId, text, sessionMap, sendInngestEvent, logger } = input;
  const session = sessionMap.getActiveSessionForChat(chatId);
  if (session === undefined) {
    logger.warn(
      {
        source: SOURCE,
        action: 'text_message_no_active_session',
        chatId,
      },
      'received text message but no active interview session for chat',
    );
    return;
  }
  await sendInngestEvent({
    name: 'telegram.message.received',
    data: {
      chatId,
      sessionId: session.sessionId,
      messageType: 'text',
      text,
    },
  });
}

export interface RegisterTextHandlerInput {
  bot: Bot;
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEvent;
  logger: Logger;
}

export function registerTextHandler(input: RegisterTextHandlerInput): void {
  input.bot.on('message:text', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const text = ctx.message?.text;
    if (chatId === undefined || typeof text !== 'string') return;
    await handleTextMessage({
      chatId: String(chatId),
      text,
      sessionMap: input.sessionMap,
      sendInngestEvent: input.sendInngestEvent,
      logger: input.logger,
    });
  });
}
