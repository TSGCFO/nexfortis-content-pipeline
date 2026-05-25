/**
 * In-memory map of `chatId → ActiveSession` used by the grammY long-poller
 * to attach a `sessionId` to every outbound `telegram.message.received`
 * event.
 *
 * Why in-memory: Telegram does not know about our `sessionId`. The
 * Inngest waitForEvent filter needs `event.data.sessionId == "<id>"`, so
 * the bot must annotate every event with the session id of the open
 * interview for that chat. Querying the DB on every keystroke would add
 * round-trip latency that Hassan would feel.
 *
 * Survival across restarts: `loadFromDb` re-hydrates the map by scanning
 * `interview_sessions` for any row whose `status` is in the open set
 * (`preview_sent` / `confirming` / `follow_up`). The bot calls this on
 * boot before starting the long-poll, so a restart mid-interview loses
 * no state.
 *
 * Why not multi-session-per-chat: PR 2 supports exactly one open session
 * per chat. `recordOpened` is last-write-wins on collision (PR 1 only
 * ever opens one session per chat per week anyway). If a future PR adds
 * a `@nexfortis_team` channel, this map's keying may need to become
 * `(chatId, candidateId)`.
 */

import { eq, inArray } from 'drizzle-orm';

import { interviewSessions, type Database } from '@ncp/db';

import type { ActiveSession } from '../jobs/interview-session/types.js';

const OPEN_STATUSES = ['preview_sent', 'confirming', 'follow_up'] as const;
type OpenStatus = (typeof OPEN_STATUSES)[number];
const OPEN_STATUS_LIST: readonly OpenStatus[] = OPEN_STATUSES;

export interface SessionMap {
  /** Records (or replaces) the active session for a chat. */
  recordOpened(chatId: string, session: ActiveSession): void;
  /** Removes any active-session entry for the chat. */
  recordClosed(chatId: string): void;
  /** Reads the active session for a chat, or `undefined`. */
  getActiveSessionForChat(chatId: string): ActiveSession | undefined;
  /** Snapshot of all (chatId, session) pairs for diagnostics / tests. */
  snapshot(): ReadonlyArray<{ chatId: string; session: ActiveSession }>;
}

interface SessionMapInternal extends SessionMap {
  loadFromDb(opts: { db: Database; chatId?: string }): Promise<void>;
}

export function createSessionMap(): SessionMapInternal {
  const map = new Map<string, ActiveSession>();
  return {
    recordOpened(chatId, session) {
      map.set(chatId, session);
    },
    recordClosed(chatId) {
      map.delete(chatId);
    },
    getActiveSessionForChat(chatId) {
      return map.get(chatId);
    },
    snapshot() {
      return [...map.entries()].map(([chatId, session]) => ({
        chatId,
        session,
      }));
    },
    async loadFromDb({ db, chatId }) {
      const rows = await db
        .select({
          id: interviewSessions.id,
          candidateId: interviewSessions.candidateId,
          telegramChatId: interviewSessions.telegramChatId,
          startedAt: interviewSessions.startedAt,
          status: interviewSessions.status,
        })
        .from(interviewSessions)
        .where(
          chatId !== undefined
            ? eq(interviewSessions.telegramChatId, chatId)
            : inArray(interviewSessions.status, [...OPEN_STATUS_LIST]),
        );
      for (const row of rows) {
        if (!OPEN_STATUS_LIST.includes(row.status as OpenStatus)) continue;
        const opened: ActiveSession = {
          sessionId: row.id,
          candidateId: row.candidateId,
          openedAt: row.startedAt ?? new Date(0),
        };
        map.set(row.telegramChatId, opened);
      }
    },
  };
}

export type { SessionMapInternal };
