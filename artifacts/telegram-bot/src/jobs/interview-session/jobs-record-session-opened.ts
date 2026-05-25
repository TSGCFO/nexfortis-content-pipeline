/**
 * Inngest function that records freshly-opened interview sessions into
 * the bot process's in-memory `SessionMap`.
 *
 * Listens for the `interview.session.opened` event dispatched by
 * `runInterviewSession`'s PR 2 backport (see
 * `jobs/interview-session/index.ts`). On each event, calls
 * `sessionMap.recordOpened(chatId, ...)` so subsequent Telegram messages
 * for that chat resolve to the right session id.
 *
 * The function shares the same `Inngest` client + `SessionMap` singleton
 * as the grammY bot (both live in `src/index.ts`), so the mutation is
 * visible to the long-poll handlers immediately.
 *
 * If the bot is restarted between session-open and the first reply,
 * `SessionMap.loadFromDb` repopulates the map on boot — this Inngest
 * function only covers the live-process delta.
 */

import type { Inngest, InngestFunction } from 'inngest';

import { createLogger, type Logger } from '@ncp/logger';

import type { SessionMap } from '../../bot/session-map.js';

const SOURCE = 'telegram_bot' as const;

export interface CreateRecordSessionOpenedJobDeps {
  inngest: Inngest.Any;
  sessionMap: SessionMap;
  /** Injectable for tests; defaults to `createLogger({ source })`. */
  logger?: Logger;
  /** Injectable for tests; defaults to `new Date()` per dispatch. */
  now?: () => Date;
}

export function createRecordSessionOpenedJob(
  deps: CreateRecordSessionOpenedJobDeps,
): InngestFunction.Any {
  const logger = deps.logger ?? createLogger({ source: SOURCE });
  const nowFn = deps.now ?? (() => new Date());
  return deps.inngest.createFunction(
    {
      id: 'record-session-opened',
      name: 'Record opened interview session into bot session map',
    },
    { event: 'interview.session.opened' },
    async ({ event }) => {
      const data = event.data as {
        chatId?: unknown;
        sessionId?: unknown;
        candidateId?: unknown;
      };
      const chatId = data.chatId;
      const sessionId = data.sessionId;
      const candidateId = data.candidateId;
      if (
        typeof chatId !== 'string' ||
        typeof sessionId !== 'string' ||
        typeof candidateId !== 'string'
      ) {
        logger.warn(
          {
            source: SOURCE,
            action: 'session_opened_payload_invalid',
            payload: data,
          },
          'interview.session.opened payload missing string fields; ignoring',
        );
        return { recorded: false };
      }
      deps.sessionMap.recordOpened(chatId, {
        sessionId,
        candidateId,
        openedAt: nowFn(),
      });
      logger.debug(
        {
          source: SOURCE,
          action: 'session_recorded_in_map',
          chatId,
          sessionId,
          candidateId,
        },
        'recorded interview.session.opened in in-memory map',
      );
      return { recorded: true };
    },
  );
}
