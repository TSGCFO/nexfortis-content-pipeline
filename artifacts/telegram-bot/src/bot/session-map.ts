/**
 * In-memory `chatId → ActiveSession` registry consumed by the grammY
 * handlers and mutated by:
 *
 *   1. `loadFromDb`, called once on bot startup, to rehydrate
 *      non-terminal sessions opened before the current bot process
 *      booted (i.e. survive a restart mid-interview).
 *   2. `recordOpened`, called by the `interview.session.opened` Inngest
 *      function each time `runInterviewSession` inserts a new session row.
 *
 * Stale-entry policy (PR 2): NO automatic eviction when a session reaches
 * a terminal state. Stale entries self-correct on the next bot restart
 * (rehydrate only pulls non-terminal sessions). This trade-off is safe
 * because the bot is single-replica (long-polling forces this) and PR 3
 * will introduce explicit close-event handling.
 */

import { and, inArray } from 'drizzle-orm';

import { interviewSessions, type Database } from '@ncp/db';

export interface ActiveSession {
  sessionId: string;
  candidateId: string;
  openedAt: Date;
}

/** Non-terminal session statuses — the only ones we hydrate on boot. */
const ACTIVE_STATUSES = ['preview_sent', 'confirming', 'follow_up'] as const;
type ActiveStatus = (typeof ACTIVE_STATUSES)[number];

const ACTIVE_STATUS_SET: ReadonlySet<string> = new Set(ACTIVE_STATUSES);

export class SessionMap {
  private readonly map = new Map<string, ActiveSession>();

  recordOpened(chatId: string, session: ActiveSession): void {
    this.map.set(chatId, session);
  }

  recordClosed(chatId: string): void {
    this.map.delete(chatId);
  }

  getActiveSessionForChat(chatId: string): ActiveSession | undefined {
    return this.map.get(chatId);
  }

  /** Number of entries currently tracked — useful for tests/logging. */
  size(): number {
    return this.map.size;
  }

  /**
   * Replace the map's contents with the most-recent non-terminal session
   * per chat ID. Returns the number of entries loaded.
   *
   * If multiple non-terminal sessions exist for the same chat (a state
   * the rest of the pipeline should not produce, but which we guard
   * against here defensively), the one with the latest `startedAt` wins.
   */
  async loadFromDb(input: {
    db: Database;
    chatIds: readonly string[];
  }): Promise<number> {
    this.map.clear();
    if (input.chatIds.length === 0) {
      return 0;
    }
    const rows = await input.db
      .select({
        id: interviewSessions.id,
        candidateId: interviewSessions.candidateId,
        chatId: interviewSessions.telegramChatId,
        startedAt: interviewSessions.startedAt,
        status: interviewSessions.status,
      })
      .from(interviewSessions)
      .where(
        and(
          inArray(interviewSessions.telegramChatId, [...input.chatIds]),
          inArray(interviewSessions.status, [...ACTIVE_STATUSES]),
        ),
      );

    for (const r of rows) {
      if (!ACTIVE_STATUS_SET.has(r.status)) continue;
      const existing = this.map.get(r.chatId);
      const openedAt = r.startedAt ?? new Date(0);
      if (existing === undefined || existing.openedAt < openedAt) {
        this.map.set(r.chatId, {
          sessionId: r.id,
          candidateId: r.candidateId,
          openedAt,
        });
      }
    }
    return this.map.size;
  }
}

export type { ActiveStatus };
