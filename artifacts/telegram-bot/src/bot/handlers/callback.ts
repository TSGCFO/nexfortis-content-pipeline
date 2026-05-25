/**
 * grammY callback-query handler. Parses the `cnfm:<idx>:<choice>` data
 * shape emitted by `buildConfirmationKeyboard` and dispatches a
 * `telegram.message.received` Inngest event with `messageType: 'callback'`
 * so the confirmation-loop can resolve the answer.
 *
 * Malformed or unknown callbacks are logged but never crash the bot.
 */

import type { Bot, Context } from 'grammy';
import type { Logger } from '@ncp/logger';

import { parseCallbackData } from '../../lib/parse-callback-data.js';
import type { SessionMap } from '../session-map.js';
import type { SendInngestEvent } from './types.js';

const SOURCE = 'telegram_bot' as const;

export interface HandleCallbackInput {
  chatId: string;
  callbackData: string;
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEvent;
  logger: Logger;
}

export async function handleCallback(
  input: HandleCallbackInput,
): Promise<void> {
  const { chatId, callbackData, sessionMap, sendInngestEvent, logger } = input;
  const parsed = parseCallbackData(callbackData);
  if (!parsed.ok) {
    logger.warn(
      {
        source: SOURCE,
        action: 'callback_data_invalid',
        chatId,
        callbackData,
        reason: parsed.error,
      },
      'invalid callback_data; ignoring',
    );
    return;
  }
  const session = sessionMap.getActiveSessionForChat(chatId);
  if (session === undefined) {
    logger.warn(
      {
        source: SOURCE,
        action: 'callback_no_active_session',
        chatId,
        callbackData,
      },
      'received callback but no active interview session for chat',
    );
    return;
  }
  await sendInngestEvent({
    name: 'telegram.message.received',
    data: {
      chatId,
      sessionId: session.sessionId,
      messageType: 'callback',
      text: parsed.parsed.choice,
      callbackData,
    },
  });
}

export interface RegisterCallbackHandlerInput {
  bot: Bot;
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEvent;
  logger: Logger;
}

export function registerCallbackHandler(
  input: RegisterCallbackHandlerInput,
): void {
  input.bot.on('callback_query:data', async (ctx: Context) => {
    const chatId = ctx.chat?.id;
    const data = ctx.callbackQuery?.data;
    if (chatId === undefined || typeof data !== 'string') return;
    // Always answerCallbackQuery so the loading spinner clears. Errors
    // here are non-fatal — Telegram tolerates missed acks.
    try {
      await ctx.answerCallbackQuery();
    } catch (err) {
      input.logger.warn(
        {
          source: SOURCE,
          action: 'answer_callback_query_failed',
          chatId,
          reason: err instanceof Error ? err.message : String(err),
        },
        'answerCallbackQuery failed; continuing',
      );
    }
    await handleCallback({
      chatId: String(chatId),
      callbackData: data,
      sessionMap: input.sessionMap,
      sendInngestEvent: input.sendInngestEvent,
      logger: input.logger,
    });
  });
}
