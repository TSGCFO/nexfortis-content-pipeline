/**
 * grammY callback-query handler for the three confirmation buttons.
 *
 * Parses `cnfm:<idx>:<y|a|s>` callback_data via `parseCallbackData`,
 * dispatches an Inngest `telegram.message.received` event with the
 * structured choice, and silently dismisses Telegram's loading spinner
 * via `answerCallbackQuery`.
 *
 * For consumers that only inspect `text` (legacy text-handler-shaped
 * code paths), the dispatched event also sets `text` to the canonical
 * choice spelling (`'yes' | 'anon' | 'skip'`) so they still see a
 * matching string. The `callbackData` field carries the structured form
 * that the confirmation loop actually uses.
 *
 * Malformed callback data (the regex doesn't match — possible from a
 * third-party Telegram client or a stale message after a deploy) is
 * logged and silently ignored; never crashes the handler.
 */

import type { Context } from 'grammy';

import type { Logger } from '@ncp/logger';

import { parseCallbackData } from '../../lib/parse-callback-data.js';
import type { SessionMap } from '../session-map.js';

const SOURCE = 'telegram_bot' as const;

export interface CallbackSendInngestFn {
  (payload: {
    name: 'telegram.message.received';
    data: {
      chatId: string;
      sessionId: string;
      text: string;
      messageType: 'callback';
      callbackData: {
        questionIndex: number;
        choice: 'yes' | 'anon' | 'skip';
      };
    };
  }): Promise<void>;
}

export interface CreateCallbackHandlerDeps {
  sessionMap: SessionMap;
  sendInngestEvent: CallbackSendInngestFn;
  logger: Logger;
}

export interface CallbackHandlerCtxLike {
  chat?: { id: number | string } | undefined;
  callbackQuery?: { data?: string | undefined } | undefined;
  /** grammY's `ctx.answerCallbackQuery()`. */
  answerCallbackQuery?: () => Promise<unknown>;
}

export function createCallbackHandler(
  deps: CreateCallbackHandlerDeps,
): (ctx: CallbackHandlerCtxLike | Context) => Promise<void> {
  return async (ctx: CallbackHandlerCtxLike | Context): Promise<void> => {
    try {
      const chatRaw = ctx.chat?.id;
      const raw = ctx.callbackQuery?.data;
      if (chatRaw === undefined || typeof raw !== 'string') {
        return;
      }
      const chatId = String(chatRaw);
      const parsed = parseCallbackData(raw);
      if (!parsed.ok) {
        deps.logger.warn(
          {
            source: SOURCE,
            action: 'callback_invalid_data',
            chatId,
            rawLength: raw.length,
          },
          'received malformed callback_data; ignoring',
        );
        if (typeof ctx.answerCallbackQuery === 'function') {
          // Always dismiss the spinner so Telegram doesn't show a stuck
          // hourglass on Hassan's phone.
          try {
            await ctx.answerCallbackQuery();
          } catch {
            // ignore — best effort
          }
        }
        return;
      }
      const active = deps.sessionMap.getActiveSessionForChat(chatId);
      if (active === undefined) {
        deps.logger.warn(
          {
            source: SOURCE,
            action: 'callback_no_active_session',
            chatId,
          },
          'received callback with no active session for chat; ignoring',
        );
        if (typeof ctx.answerCallbackQuery === 'function') {
          try {
            await ctx.answerCallbackQuery();
          } catch {
            // ignore
          }
        }
        return;
      }
      // Dispatch BEFORE acknowledging the callback so a flaky Inngest
      // doesn't leave the spinner spinning indefinitely.
      await deps.sendInngestEvent({
        name: 'telegram.message.received',
        data: {
          chatId,
          sessionId: active.sessionId,
          text: parsed.parsed.choice,
          messageType: 'callback',
          callbackData: parsed.parsed,
        },
      });
      if (typeof ctx.answerCallbackQuery === 'function') {
        try {
          await ctx.answerCallbackQuery();
        } catch (ackErr) {
          deps.logger.warn(
            {
              source: SOURCE,
              action: 'callback_ack_failed',
              chatId,
              reason:
                ackErr instanceof Error ? ackErr.message : String(ackErr),
            },
            'answerCallbackQuery failed; spinner may persist briefly on Telegram client',
          );
        }
      }
    } catch (err) {
      deps.logger.error(
        {
          source: SOURCE,
          action: 'callback_handler_threw',
          reason: err instanceof Error ? err.message : String(err),
        },
        'callback handler caught an error; not propagating to grammY runtime',
      );
    }
  };
}
