/**
 * grammY text-message handler.
 *
 * Each incoming Telegram text message is translated into an
 * `telegram.message.received` Inngest event with the active session id
 * looked up via the in-process `SessionMap`. The event's CEL filter
 * (`event.data.chatId == "<X>" && event.data.sessionId == "<S>"`) is
 * already set by PR 1's `step.waitForEvent`, so `chatId` + `sessionId`
 * must both be present on every dispatch.
 *
 * If the chat has no active session, the handler logs and returns
 * without dispatching — there is no Inngest function listening for
 * those events.
 *
 * The handler is `try/catch`-wrapped at the boundary so a single failure
 * (e.g. a flaky Inngest dispatch) does not blow up the grammY long-poll
 * loop and silently kill the bot.
 */

import type { Context } from 'grammy';

import type { Logger } from '@ncp/logger';

import type { SessionMap } from '../session-map.js';

const SOURCE = 'telegram_bot' as const;

export interface SendInngestEventFn {
  (payload: {
    name: 'telegram.message.received';
    data: {
      chatId: string;
      sessionId: string;
      text: string;
      messageType: 'text';
    };
  }): Promise<void>;
}

export interface CreateTextHandlerDeps {
  sessionMap: SessionMap;
  sendInngestEvent: SendInngestEventFn;
  logger: Logger;
}

/**
 * Minimal structural slice of grammY's `Context` for this handler — just
 * the fields we actually read. Tests inject a plain object with the same
 * shape so we don't depend on grammY's full surface in unit tests.
 */
export interface TextHandlerCtxLike {
  chat?: { id: number | string } | undefined;
  message?: { text?: string | undefined } | undefined;
}

export function createTextHandler(
  deps: CreateTextHandlerDeps,
): (ctx: TextHandlerCtxLike | Context) => Promise<void> {
  return async (ctx: TextHandlerCtxLike | Context): Promise<void> => {
    try {
      const chatRaw = ctx.chat?.id;
      const text = ctx.message?.text;
      if (chatRaw === undefined || typeof text !== 'string') {
        // Telegram occasionally delivers a chat-update without a message
        // body (edits, service messages). Ignore silently — these are
        // not interview answers.
        return;
      }
      const chatId = String(chatRaw);
      const active = deps.sessionMap.getActiveSessionForChat(chatId);
      if (active === undefined) {
        deps.logger.warn(
          {
            source: SOURCE,
            action: 'text_no_active_session',
            chatId,
          },
          'received text message with no active session for chat; ignoring',
        );
        return;
      }
      await deps.sendInngestEvent({
        name: 'telegram.message.received',
        data: {
          chatId,
          sessionId: active.sessionId,
          text,
          messageType: 'text',
        },
      });
    } catch (err) {
      deps.logger.error(
        {
          source: SOURCE,
          action: 'text_handler_threw',
          reason: err instanceof Error ? err.message : String(err),
        },
        'text handler caught an error; not propagating to grammY runtime',
      );
    }
  };
}
